// Media gateway (Phase 4) — the media counterpart to the publish gate. It admits the session, resolves the
// connection SERVER-SIDE, and uploads the bytes to X inside vault.withToken (the token never crosses back).
// It does NOT run casserole: per the locked decision (STATE §5.10), capx does not inspect media — the
// caption text is guarded at the publish gate; the asset passes by default. The AI-content label is the
// skill's responsibility (set on the post/caption), not enforced here. Returns a media id the caller then
// attaches to a post via post_now { mediaIds }.
import type { Admission } from '../admission/index.ts';
import type { Vault } from '../vault/index.ts';
import type { XMediaUploader } from '../xclient/index.ts';

export interface MediaGatewayDeps {
  admission: Admission;
  vault: Vault;
  upload: XMediaUploader;
  now: () => number;
}

export interface MediaUploadResult {
  mediaId?: string;
  rejected?: string;
}

/** Guardrail-free by design (media is not moderated), but still fully admission- and token-gated. */
export class MediaGateway {
  readonly #admission: Admission;
  readonly #vault: Vault;
  readonly #upload: XMediaUploader;
  readonly #now: () => number;

  constructor(deps: MediaGatewayDeps) {
    this.#admission = deps.admission;
    this.#vault = deps.vault;
    this.#upload = deps.upload;
    this.#now = deps.now;
  }

  async uploadMedia(input: { bearer: string; bytes: Uint8Array; mediaType: string; category: string }): Promise<MediaUploadResult> {
    if (!input.bytes.length) return { rejected: 'empty media' };
    const now = this.#now();
    const adm = await this.#admission.admit(input.bearer, now);
    if (!adm.admitted || !adm.emailHash) return { rejected: adm.reason ?? 'not admitted' };
    const vaultRef = await this.#vault.refByEmailHash(adm.emailHash);
    if (!vaultRef) return { rejected: 'no connected X account — run connect_x first' };
    if (await this.#vault.needsReauth(vaultRef)) return { rejected: 'connection needs re-auth — run connect_x again' };
    // The token is decrypted ONLY inside withToken, handed to the uploader, and never returned outward.
    const { mediaId } = await this.#vault.withToken(vaultRef, async (accessToken) =>
      this.#upload({ accessToken, bytes: input.bytes, mediaType: input.mediaType, category: input.category }),
    );
    return { mediaId };
  }
}
