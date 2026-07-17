// Per-key async mutex. run()s with the SAME key serialize (each waits for the prior to settle);
// different keys run concurrently. In-process analogue of the Postgres per-handle advisory lock that
// the gate takes around read-history -> runGauntlet -> send -> write-cache, so two concurrent
// post_now for one handle cannot both read a stale history and both pass L2/L3 (review fix #5).
export class KeyedMutex {
  readonly #tails = new Map<string, Promise<unknown>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.#tails.get(key) ?? Promise.resolve();
    const result = prev.then(() => fn(), () => fn()); // run after the prior holder settles (ok or not)
    this.#tails.set(
      key,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  }
}
