// KMS abstraction for the token vault's envelope encryption.
// The chokepoint only ever asks the KMS to WRAP / UNWRAP a per-row data-encryption key (DEK) —
// the master key never leaves the KMS boundary. Hosted uses a cloud KMS; self-host uses LocalKeyKms
// with a 32-byte master key from KMS_KEY_ID. One interface, two drivers, zero code delta (§1/§8).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** A DEK wrapped (encrypted) by the master key. All fields base64. Contains no plaintext key. */
export interface WrappedKey {
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface Kms {
  wrapDek(dek: Buffer): Promise<WrappedKey>;
  unwrapDek(wrapped: WrappedKey): Promise<Buffer>;
}

const ALG = 'aes-256-gcm';

/** Self-host / test driver: wraps DEKs under a 32-byte master key (KMS_KEY_ID, base64-encoded). */
export class LocalKeyKms implements Kms {
  readonly #masterKey: Buffer;

  constructor(masterKeyBase64: string) {
    const key = Buffer.from(masterKeyBase64, 'base64');
    if (key.length !== 32) {
      throw new Error(`LocalKeyKms: KMS_KEY_ID must decode to 32 bytes (got ${key.length})`);
    }
    this.#masterKey = key;
  }

  async wrapDek(dek: Buffer): Promise<WrappedKey> {
    const iv = randomBytes(12);
    const c = createCipheriv(ALG, this.#masterKey, iv);
    const ct = Buffer.concat([c.update(dek), c.final()]);
    return { ciphertext: ct.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') };
  }

  async unwrapDek(w: WrappedKey): Promise<Buffer> {
    const d = createDecipheriv(ALG, this.#masterKey, Buffer.from(w.iv, 'base64'));
    d.setAuthTag(Buffer.from(w.tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(w.ciphertext, 'base64')), d.final()]);
  }

  /** Fresh 32-byte master key (base64) — for tests and self-host bootstrap. */
  static generateMasterKey(): string {
    return randomBytes(32).toString('base64');
  }
}
