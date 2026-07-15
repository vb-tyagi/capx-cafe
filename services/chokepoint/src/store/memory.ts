// In-memory Store — the DEFAULT driver for tests + local dev. The PostgresStore (the real "one
// Postgres" of §1) implements the SAME ports at S3/S4; nothing above the port cares which is wired.
// This is why `pnpm verify` needs no database.
import type { VaultStore, VaultRow } from '../vault/index.ts';
import type { SealedToken } from '../vault/crypto.ts';

export class InMemoryStore implements VaultStore {
  readonly #vault = new Map<string, VaultRow>(); // vaultRef -> row
  readonly #vaultByEmail = new Map<string, string>(); // emailHash -> vaultRef

  async put(row: VaultRow): Promise<void> {
    this.#vault.set(row.vaultRef, row);
    this.#vaultByEmail.set(row.emailHash, row.vaultRef);
  }

  async getByRef(vaultRef: string): Promise<VaultRow | null> {
    return this.#vault.get(vaultRef) ?? null;
  }

  async getByEmailHash(emailHash: string): Promise<VaultRow | null> {
    const ref = this.#vaultByEmail.get(emailHash);
    return ref ? (this.#vault.get(ref) ?? null) : null;
  }

  async updateTokens(vaultRef: string, access: SealedToken, refresh: SealedToken, rotatedAt: number): Promise<void> {
    const row = this.#vault.get(vaultRef);
    if (!row) throw new Error(`vault: no row ${vaultRef}`);
    this.#vault.set(vaultRef, { ...row, access, refresh, refreshRotatedAt: rotatedAt });
  }
}
