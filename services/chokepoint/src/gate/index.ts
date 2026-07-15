// The publish gate — THE unbypassable boundary. A server-side port of canteen.runLoopTick: the ONLY
// code path to a send. It admits (license gate) -> resolves the connection server-side -> takes a
// per-handle lock -> normalizes the draft -> runs casserole with a REQUIRED live kill-switch -> hands
// off to the x-adapter ONLY when verdict===PASS && !requiresHumanReview. Nothing here decrypts a token
// (that is the x-adapter/vault). Manual post_now runs with ctx.loop undefined (spacing-exempt). See §4.
import { Verdict, Platform, Lane } from '@capx/core';
import type { Handle } from '@capx/core';
import { runGauntlet } from '@capx/casserole';
import type { GauntletContext } from '@capx/casserole';
import type { PlatformClient } from '@capx/platform-client';
import type { Admission } from '../admission/index.ts';
import type { Vault } from '../vault/index.ts';
import type { Metering } from '../metering/index.ts';
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
}

export interface GateDeps {
  admission: Admission;
  vault: Vault;
  client: PlatformClient; // S3: FakePlatformClient; S4: the vault-backed x-adapter
  now: () => number;
  mutex?: KeyedMutex;
  metering?: Metering; // lane-B (capx-app) cost cap; unused on the BYO lane
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

  constructor(deps: GateDeps) {
    this.#admission = deps.admission;
    this.#vault = deps.vault;
    this.#client = deps.client;
    this.#now = deps.now;
    this.#mutex = deps.mutex ?? new KeyedMutex();
    this.#metering = deps.metering;
  }

  async postNow(input: PostNowInput): Promise<PostResult> {
    const now = this.#now();

    // 1. ADMISSION — license gate (session valid/grace, allowlisted, not globally killed).
    const adm = await this.#admission.admit(input.bearer, now);
    if (!adm.admitted || !adm.emailHash) {
      return { outcome: 'rejected', finalReasons: [adm.reason ?? 'not admitted'] };
    }
    const emailHash = adm.emailHash;

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
      // 3. DRAFT — real hasLink + X weighted-length preflight.
      const norm = normalizeDraft(input.text, { aiGenerated: input.aiGenerated ?? false });
      if (norm.problems.length) return { outcome: 'rejected', finalReasons: norm.problems };

      // 4. CTX — manual (no loop => spacing-exempt); killSwitch REQUIRED (populated live).
      //    history/health come from the recent-post cache; that wiring lands at S7, so P1 passes [].
      const killSwitch = await this.#admission.resolveKillSwitch(emailHash, conn.xUserId);
      const handle: Handle = {
        id: conn.xUserId,
        workspaceId: '',
        platform: Platform.X,
        username: conn.username,
        verified: false,
        ageDays: 0,
        standing: conn.standing,
        connectedAt: 0,
      };
      const ctx: GauntletContext = {
        tier: 'SOLO',
        handle,
        history: [],
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

      // 7. SEND via the x-adapter. channelId = vaultRef: the adapter maps it to the vaulted token
      //    server-side (S4). The token never crosses this gate.
      try {
        const pub = await this.#client.publish({
          channelId: vaultRef,
          text: norm.draft.text,
          scheduledAtMs: g.scheduledAtMs ?? now,
          aiLabel: norm.draft.aiGenerated,
        });
        if (conn.lane === Lane.CAPX_APP && this.#metering) await this.#metering.record(emailHash, now);
        return {
          outcome: 'published',
          verdict: g.verdict,
          requiresHumanReview: false,
          finalReasons: g.finalReasons,
          platformPostId: pub.platformPostId,
        };
      } catch {
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
