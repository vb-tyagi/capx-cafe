// Lane-B (capx-app) metering seam — the slim `counter` revival (decision §5.2). On the capx-app lane
// capx's OWN X app posts on behalf of creators, so capx eats the X API cost and must cap it; the BYO
// lane is uncapped (the user pays X directly). P1 meters a per-day post COUNT as the cost proxy; the
// full @capx-cafe/counter credit/cost model plugs in at this same seam at P4. Only ACTUAL sends are metered
// (a casserole-blocked post never reaches X, so never counts).
export interface MeteringStore {
  postsToday(emailHash: string, dayIndex: number): Promise<number>;
  recordPost(emailHash: string, dayIndex: number): Promise<void>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MeteringCheck {
  allowed: boolean;
  used: number;
  cap: number;
}

export class Metering {
  readonly #store: MeteringStore;
  readonly #dailyCap: number;

  constructor(store: MeteringStore, dailyCap: number) {
    this.#store = store;
    this.#dailyCap = dailyCap;
  }

  async check(emailHash: string, now: number): Promise<MeteringCheck> {
    const used = await this.#store.postsToday(emailHash, Math.floor(now / DAY_MS));
    return { allowed: used < this.#dailyCap, used, cap: this.#dailyCap };
  }

  async record(emailHash: string, now: number): Promise<void> {
    await this.#store.recordPost(emailHash, Math.floor(now / DAY_MS));
  }
}
