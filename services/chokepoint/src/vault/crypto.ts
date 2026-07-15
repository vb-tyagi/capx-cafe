// Envelope encryption for X tokens. A random per-token DEK encrypts the plaintext (AES-256-GCM);
// the KMS wraps the DEK. The stored SealedToken contains NO plaintext and no unwrapped key, so a
// dump of the vault table / any log line reveals nothing usable. Decryption is the ONLY way back,
// and it lives behind the vault module's withToken() (single plaintext-lifetime boundary).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Kms, WrappedKey } from './kms.ts';

/** An encrypted token at rest. All binary fields base64; contains NO plaintext. */
export interface SealedToken {
  ciphertext: string;
  iv: string;
  tag: string;
  wrappedDek: WrappedKey;
}

const ALG = 'aes-256-gcm';

export async function sealToken(plaintext: string, kms: Kms): Promise<SealedToken> {
  const dek = randomBytes(32);
  const iv = randomBytes(12);
  const c = createCipheriv(ALG, dek, iv);
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  const wrappedDek = await kms.wrapDek(dek);
  return {
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    tag: c.getAuthTag().toString('base64'),
    wrappedDek,
  };
}

/** Reverse of sealToken. Throws on tamper (GCM auth failure) or a wrong master key. */
export async function openToken(sealed: SealedToken, kms: Kms): Promise<string> {
  const dek = await kms.unwrapDek(sealed.wrappedDek);
  const d = createDecipheriv(ALG, dek, Buffer.from(sealed.iv, 'base64'));
  d.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(sealed.ciphertext, 'base64')), d.final()]).toString('utf8');
}
