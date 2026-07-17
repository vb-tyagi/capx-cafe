// Admission — the transformed captain: the chokepoint's server-side "is this send allowed right now?"
// layer, BEFORE casserole. Hashed-email allowlist + short-TTL session (with grace) + kill-list whose
// resolve() emits casserole's exact { global, handle } shape (reused from @capx-cafe/captain). Workspace /
// RLS / Membership / invite machinery is stripped (Option B has no multi-tenant user DB). See §4/§5.
import { resolveKillSwitch as captainResolve, emptyKillSwitch } from '@capx-cafe/captain';
import type { KillSwitch } from '@capx-cafe/core';
import { HmacSessionSigner } from './session.ts';

/** Persistence port for admission state (implemented by InMemoryStore / PostgresStore). */
export interface AdmissionStore {
  isAllowlisted(emailHash: string): Promise<boolean>;
  addAllowlisted(emailHash: string): Promise<void>;
  isGlobalKill(): Promise<boolean>;
  isHandleKill(key: string): Promise<boolean>;
  setGlobalKill(on: boolean): Promise<void>;
  setHandleKill(key: string, on: boolean): Promise<void>;
}

export interface AdmissionResult {
  admitted: boolean;
  reason?: string;
  emailHash?: string;
  inGrace?: boolean;
}

export class Admission {
  readonly #store: AdmissionStore;
  readonly #signer: HmacSessionSigner;

  constructor(store: AdmissionStore, signer: HmacSessionSigner) {
    this.#store = store;
    this.#signer = signer;
  }

  issueSession(emailHash: string, now: number): string {
    return this.#signer.issue(emailHash, now);
  }

  /** Is this email-hash on the license allowlist? (Gate for issuing a session at /session.) */
  async isAllowlisted(emailHash: string): Promise<boolean> {
    return this.#store.isAllowlisted(emailHash);
  }

  /** The global kill-switch, for server-driven paths (the loop tick) that have no session to admit. */
  async isGlobalKilled(): Promise<boolean> {
    return this.#store.isGlobalKill();
  }

  /** License gate: valid signature -> usable (live | in-grace) -> allowlisted -> not globally killed. */
  async admit(bearer: string, now: number): Promise<AdmissionResult> {
    const v = this.#signer.verify(bearer, now);
    if (!v) return { admitted: false, reason: 'invalid session signature' };
    if (!v.validation.valid && !v.validation.inGrace) return { admitted: false, reason: 'session expired (past grace)' };
    if (!(await this.#store.isAllowlisted(v.handle.emailHash))) return { admitted: false, reason: 'not allowlisted' };
    if (await this.#store.isGlobalKill()) return { admitted: false, reason: 'global kill-switch active' };
    return { admitted: true, emailHash: v.handle.emailHash, inGrace: v.validation.inGrace };
  }

  /** The live kill-switch in casserole's exact { global, handle } shape (reuses captain.resolveKillSwitch). */
  async resolveKillSwitch(emailHash?: string, handleKey?: string): Promise<KillSwitch> {
    const reg = emptyKillSwitch();
    reg.global = await this.#store.isGlobalKill();
    const key = handleKey ?? emailHash;
    if (key && (await this.#store.isHandleKill(key))) reg.handles.add(key);
    return captainResolve(reg, undefined, key);
  }

  async revoke(scope: { global?: boolean; handleKey?: string }): Promise<void> {
    if (scope.global !== undefined) await this.#store.setGlobalKill(scope.global);
    if (scope.handleKey) await this.#store.setHandleKill(scope.handleKey, true);
  }

  /** MoR webhook -> hashed-email allowlist. P1: signature verify is STUBBED (ship-gate; founder-seeded). */
  async ingestAllowlist(emailHash: string, signatureValid: boolean): Promise<void> {
    if (!signatureValid) throw new Error('MoR webhook signature invalid');
    await this.#store.addAllowlisted(emailHash);
  }
}
