// The publish gate — THE unbypassable boundary. A server-side port of canteen.runLoopTick: the ONLY
// code path to a send. It admits (license gate) -> resolves the connection server-side -> takes a
// per-handle lock -> normalizes the draft -> runs casserole with a REQUIRED live kill-switch -> hands
// off to the x-adapter ONLY when verdict===PASS && !requiresHumanReview. Nothing here decrypts a token
// (that is the x-adapter/vault). Manual post_now runs with ctx.loop undefined (spacing-exempt). See §4.
import { Verdict, Platform, Lane, OutboxState, TweetType } from '@capx-cafe/core';
import type { Handle, LoopConfig } from '@capx-cafe/core';
import type { LoopRecord } from '../loops/index.ts';
import { runGauntlet } from '@capx-cafe/casserole';
import type { GauntletContext } from '@capx-cafe/casserole';
import type { PlatformClient } from '@capx-cafe/platform-client';
import type { Admission } from '../admission/index.ts';
import type { Vault } from '../vault/index.ts';
import type { Metering } from '../metering/index.ts';
import type { RecentPosts } from '../recent/index.ts';
import type { Outbox } from '../outbox/index.ts';
import { KeyedMutex } from '../outbox/mutex.ts';
import { normalizeDraft } from './draft.ts';

export type PostOutcome = 'published' | 'blocked' | 'held' | 'regenerate' | 'rejected' | 'publish_failed';

export interface PostResult {
  outcome: PostOutcome;
  verdict?: Verdict;
  requiresHumanReview?: boolean;
  finalReasons: string[];
  platformPostId?: string;
}

export interface PostNowInput {
  bearer: string;
  text: string;
  aiGenerated?: boolean;
  idempotencyKey: string;
  /** thread chaining: the platform post id this post replies to (from a prior post_now's platformPostId). */
  inReplyToId?: string;
}

/** casserole verdict for a draft WITHOUT sending — powers the draft-review skill. */
export interface PreviewResult {
  verdict: Verdict;
  requiresHumanReview: boolean;
  finalReasons: string[];
  /** true iff a real post_now would actually send it (PASS && !requiresHumanReview). */
  wouldSend: boolean;
  rejected?: string;
}

/** One durable send-history row for the audit-trail skill. */
export interface AuditEntry {
  idempotencyKey: string;
  text: string;
  state: OutboxState;
  aiGenerated: boolean;
  lane: Lane;
  scheduledAtMs: number;
  createdAtMs: number;
}
export interface AuditResult {
  entries: AuditEntry[];
  rejected?: string;
}

export interface GateDeps {
  admission: Admission;
  vault: Vault;
  client: PlatformClient; // S3: FakePlatformClient; S4: the vault-backed x-adapter
  now: () => number;
  mutex?: KeyedMutex;
  metering?: Metering; // lane-B (capx-app) cost cap; unused on the BYO lane
  recentPosts?: RecentPosts; // per-handle history feeding casserole L2/L3 (dedup + ceiling)
  outbox?: Outbox; // durable at-most-once send: idempotent on idempotencyKey
}

/** A manual per-day cap (the loop 1/day + 5-min spacing do not apply to manual posts). */
const MANUAL_DAILY_CEILING = 25;

export class PublishGate {
  readonly #admission: Admission;
  readonly #vault: Vault;
  readonly #client: PlatformClient;
  readonly #now: () => number;
  readonly #mutex: KeyedMutex;
  readonly #metering?: Metering;
  readonly #recent?: RecentPosts;
  readonly #outbox?: Outbox;

  constructor(deps: GateDeps) {
    this.#admission = deps.admission;
    this.#vault = deps.vault;
    this.#client = deps.client;
    this.#now = deps.now;
    this.#mutex = deps.mutex ?? new KeyedMutex();
    this.#metering = deps.metering;
    this.#recent = deps.recentPosts;
    this.#outbox = deps.outbox;
  }

  /** Manual path: the agent is present and holds a session. */
  async postNow(input: PostNowInput): Promise<PostResult> {
    const now = this.#now();

    // 1. ADMISSION — license gate (session valid/grace, allowlisted, not globally killed).
    const adm = await this.#admission.admit(input.bearer, now);
    if (!adm.admitted || !adm.emailHash) {
      return { outcome: 'rejected', finalReasons: [adm.reason ?? 'not admitted'] };
    }
    return this.#publish({ emailHash: adm.emailHash, text: input.text, aiGenerated: input.aiGenerated, idempotencyKey: input.idempotencyKey, now, inReplyToId: input.inReplyToId });
  }

  /**
   * Dry-run: run the SAME admission + draft-normalize + casserole a real post_now would, but do NOT send,
   * meter, or record anything. Read-only (no mutex, no outbox). Powers the draft-review skill — "here is
   * why this would be blocked/held" — before the user schedules or posts.
   */
  async preview(input: { bearer: string; text: string; aiGenerated?: boolean }): Promise<PreviewResult> {
    const now = this.#now();
    const adm = await this.#admission.admit(input.bearer, now);
    if (!adm.admitted || !adm.emailHash) return { verdict: Verdict.BLOCK, requiresHumanReview: false, finalReasons: [], wouldSend: false, rejected: adm.reason ?? 'not admitted' };
    const emailHash = adm.emailHash;
    const vaultRef = await this.#vault.refByEmailHash(emailHash);
    if (!vaultRef) return { verdict: Verdict.BLOCK, requiresHumanReview: false, finalReasons: [], wouldSend: false, rejected: 'no connected X account' };
    const conn = await this.#vault.getMetadata(vaultRef);
    if (!conn) return { verdict: Verdict.BLOCK, requiresHumanReview: false, finalReasons: [], wouldSend: false, rejected: 'connection metadata missing' };

    const norm = normalizeDraft(input.text, { aiGenerated: input.aiGenerated ?? false });
    if (norm.problems.length) return { verdict: Verdict.BLOCK, requiresHumanReview: false, finalReasons: norm.problems, wouldSend: false };

    const history = this.#recent ? await this.#recent.recent(emailHash, now) : [];
    const killSwitch = await this.#admission.resolveKillSwitch(emailHash, conn.xUserId);
    const ageDays = conn.createdAtMs > 0 ? Math.floor((now - conn.createdAtMs) / 86_400_000) : 0;
    const handle: Handle = { id: conn.xUserId, workspaceId: '', platform: Platform.X, username: conn.username, verified: conn.verified, ageDays, standing: conn.standing, connectedAt: conn.createdAtMs };
    const g = runGauntlet(norm.draft, { tier: 'SOLO', handle, history, now, accountDailyCeiling: MANUAL_DAILY_CEILING, killSwitch });
    return { verdict: g.verdict, requiresHumanReview: g.requiresHumanReview, finalReasons: g.finalReasons, wouldSend: g.verdict === Verdict.PASS && !g.requiresHumanReview };
  }

  /**
   * Read-only audit: the durable send history for the caller's own handle (most recent first). Powers
   * the audit-trail skill — "everything capx has posted / attempted on your behalf, and its delivery
   * state." Requires the outbox (the durable record); returns empty without it. Blocked/held drafts are
   * surfaced live at post/preview time and are not persisted here.
   */
  async audit(input: { bearer: string; limit?: number }): Promise<AuditResult> {
    const now = this.#now();
    const adm = await this.#admission.admit(input.bearer, now);
    if (!adm.admitted || !adm.emailHash) return { entries: [], rejected: adm.reason ?? 'not admitted' };
    if (!this.#outbox) return { entries: [] };
    const limit = Math.min(Math.max(1, input.limit ?? 50), 200);
    const jobs = await this.#outbox.history(adm.emailHash, limit);
    return {
      entries: jobs.map((j) => ({
        idempotencyKey: j.idempotencyKey,
        text: j.text,
        state: j.state,
        aiGenerated: j.aiGenerated,
        lane: j.lane,
        scheduledAtMs: j.scheduledAtMs,
        createdAtMs: j.createdAtMs,
      })),
    };
  }

  /**
   * Loop path: fired by the server's tick, so there is no session to admit — the loop's existence is the
   * authorisation, and it was created by an admitted session. Everything AFTER admission is identical to
   * post_now (same #publish body): same kill-switch, same casserole, same vault, same x-adapter. A loop
   * gets NO shortcut to X — it just arrives with ctx.loop set, which makes casserole STRICTER (L1
   * eligibility + L2 one-per-day + spacing).
   */
  async postFromLoop(input: { emailHash: string; loop: LoopRecord; text: string; idempotencyKey: string; now: number }): Promise<PostResult> {
    // The kill-switch still applies: resolveKillSwitch runs inside #publish and casserole L1 blocks on it.
    if (await this.#admission.isGlobalKilled()) {
      return { outcome: 'rejected', finalReasons: ['global kill-switch active'] };
    }
    return this.#publish({
      emailHash: input.emailHash,
      text: input.text,
      // Option-C: the AI-assist label is the user's choice, captured on the loop at create (default false).
      // capx does not presume the flag even though the agent drafted the buffer — the user owns the label.
      aiGenerated: input.loop.aiGenerated ?? false,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
      loop: input.loop,
    });
  }

  async #publish(input: { emailHash: string; text: string; aiGenerated?: boolean; idempotencyKey: string; now: number; loop?: LoopRecord; inReplyToId?: string }): Promise<PostResult> {
    const now = input.now;
    const emailHash = input.emailHash;

    // 2. Resolve the connection SERVER-SIDE from the session identity (never client input).
    const vaultRef = await this.#vault.refByEmailHash(emailHash);
    if (!vaultRef) return { outcome: 'rejected', finalReasons: ['no connected X account — run connect_x first'] };
    const conn = await this.#vault.getMetadata(vaultRef);
    if (!conn) return { outcome: 'rejected', finalReasons: ['connection metadata missing'] };
    if (await this.#vault.needsReauth(vaultRef)) {
      return { outcome: 'rejected', finalReasons: ['connection needs re-auth — run connect_x again'] };
    }

    // Serialize the read-history -> gauntlet -> send critical section per handle (review fix #5).
    return this.#mutex.run(emailHash, async () => {
      // 2b. IDEMPOTENCY — a retried post_now with the same key that already SENT short-circuits here,
      //     before re-evaluation, so a network retry never double-posts (the mutex makes this race-free).
      if (this.#outbox) {
        const prior = await this.#outbox.find(input.idempotencyKey);
        if (prior && prior.state === OutboxState.SENT) {
          return { outcome: 'published', requiresHumanReview: false, finalReasons: ['idempotent replay — already posted'] };
        }
      }

      // 3. DRAFT — real hasLink + X weighted-length preflight.
      const norm = normalizeDraft(input.text, { aiGenerated: input.aiGenerated ?? false });
      if (norm.problems.length) return { outcome: 'rejected', finalReasons: norm.problems };

      // 4. CTX — manual (no loop => spacing-exempt); killSwitch REQUIRED (populated live).
      //    history comes from the per-handle recent-post cache (read inside the lock) so casserole
      //    L2 (daily ceiling) + L3 (near-duplicate dedup) enforce on real history.
      const history = this.#recent ? await this.#recent.recent(emailHash, now) : [];
      const killSwitch = await this.#admission.resolveKillSwitch(emailHash, conn.xUserId);
      // Real account facts from X (captured at connect), NOT placeholders: casserole L1 gates Loops on
      // verified + ageDays, so hardcoding them would either block every loop or wave through a brand-new
      // account. createdAtMs 0 (X didn't grant the field) => ageDays 0 => loops fail closed.
      const ageDays = conn.createdAtMs > 0 ? Math.floor((now - conn.createdAtMs) / 86_400_000) : 0;
      const handle: Handle = {
        id: conn.xUserId,
        workspaceId: '',
        platform: Platform.X,
        username: conn.username,
        verified: conn.verified,
        ageDays,
        standing: conn.standing,
        connectedAt: conn.createdAtMs,
      };
      // A loop post carries ctx.loop, which makes casserole STRICTER, not looser: L1 eligibility
      // (verified / >=30d / GOOD standing) and L2's one-per-loop-per-day + 5-min spacing all switch on.
      // The chef-era fields (model/category/brief/styleSources) are vestigial under the pre-generated
      // buffer — the agent already wrote the text — but L6 records them in the audit, so pass honest values.
      const loopCfg: LoopConfig | undefined = input.loop
        ? {
            id: input.loop.id,
            handleId: conn.xUserId,
            timeOfDayMinutes: input.loop.timeOfDayMinutes,
            daysOfWeek: input.loop.daysOfWeek,
            type: TweetType.TEXT,
            model: 'agent-authored', // capx runs no model; the user's harness wrote this
            category: '',
            tags: [],
            brief: '',
            styleSources: [],
            autonomy: input.loop.autonomy,
            trainingWheelsRemaining: input.loop.trainingWheelsRemaining,
          }
        : undefined;
      const ctx: GauntletContext = {
        tier: 'SOLO',
        handle,
        loop: loopCfg,
        history,
        now,
        accountDailyCeiling: MANUAL_DAILY_CEILING,
        killSwitch,
      };

      // 5. CASSEROLE — the unbypassable gate. Defense-in-depth: never run without a kill-switch.
      if (!ctx.killSwitch) throw new Error('gate: killSwitch must be populated before runGauntlet');
      const g = runGauntlet(norm.draft, ctx);
      if (g.verdict === Verdict.BLOCK) {
        return { outcome: 'blocked', verdict: g.verdict, requiresHumanReview: g.requiresHumanReview, finalReasons: g.finalReasons };
      }
      if (g.requiresHumanReview) {
        return { outcome: 'held', verdict: g.verdict, requiresHumanReview: true, finalReasons: g.finalReasons };
      }
      if (g.verdict === Verdict.REGENERATE) {
        return { outcome: 'regenerate', verdict: g.verdict, requiresHumanReview: false, finalReasons: g.finalReasons };
      }

      // 6. METER (lane B only) — capx eats the capx-app-lane X cost, so cap it. Meter ACTUAL sends:
      //    checked after casserole PASS, before the call. BYO lane is uncapped (user pays X directly).
      if (conn.lane === Lane.CAPX_APP && this.#metering) {
        const m = await this.#metering.check(emailHash, now);
        if (!m.allowed) {
          return {
            outcome: 'rejected',
            verdict: g.verdict,
            requiresHumanReview: false,
            finalReasons: [...g.finalReasons, `capx-app daily cap reached (${m.used}/${m.cap})`],
          };
        }
      }

      // 7. SEND via the x-adapter, durably. Enqueue PENDING -> SENDING -> (SENT | PUBLISH_FAILED).
      //    channelId = vaultRef: the adapter maps it to the vaulted token server-side (S4). The token
      //    never crosses this gate.
      let jobId: string | null = null;
      if (this.#outbox) {
        const enq = await this.#outbox.enqueue({
          id: input.idempotencyKey,
          idempotencyKey: input.idempotencyKey,
          emailHash,
          vaultRef,
          text: norm.draft.text,
          aiGenerated: norm.draft.aiGenerated,
          lane: conn.lane,
          state: OutboxState.PENDING,
          scheduledAtMs: g.scheduledAtMs ?? now,
          createdAtMs: now,
        });
        jobId = enq.job.id;
        await this.#outbox.markSending(jobId);
      }
      try {
        const pub = await this.#client.publish({
          channelId: vaultRef,
          text: norm.draft.text,
          scheduledAtMs: g.scheduledAtMs ?? now,
          aiLabel: norm.draft.aiGenerated,
          inReplyToId: input.inReplyToId,
        });
        if (this.#outbox && jobId) await this.#outbox.markSent(jobId);
        if (conn.lane === Lane.CAPX_APP && this.#metering) await this.#metering.record(emailHash, now);
        // record into the recent-post cache (still inside the lock) so the next post dedups against it.
        if (this.#recent) await this.#recent.record(emailHash, { text: norm.draft.text, postedAt: now });
        return {
          outcome: 'published',
          verdict: g.verdict,
          requiresHumanReview: false,
          finalReasons: g.finalReasons,
          platformPostId: pub.platformPostId,
        };
      } catch {
        if (this.#outbox && jobId) await this.#outbox.markFailed(jobId);
        return {
          outcome: 'publish_failed',
          verdict: g.verdict,
          requiresHumanReview: false,
          finalReasons: [...g.finalReasons, 'publish failed at the X boundary'],
        };
      }
    });
  }
}
