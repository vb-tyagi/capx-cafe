// One place to choose the seam from config: FakePlatformClient (dev/test) or HttpPlatformClient (real).
// canteen depends only on the PlatformClient interface, so flipping mode is an env change, not a code change.
import type { PlatformClient } from './index.ts';
import { FakePlatformClient } from './index.ts';
import { HttpPlatformClient } from './http.ts';

export interface PlatformClientConfig {
  mode: 'fake' | 'http';
  baseUrl?: string;
  serviceToken?: string;
  postsPath?: string;
}

export function createPlatformClient(cfg: PlatformClientConfig): PlatformClient {
  if (cfg.mode === 'http') {
    if (!cfg.baseUrl) throw new Error('createPlatformClient: http mode requires baseUrl (PLATFORM_API_URL)');
    return new HttpPlatformClient(cfg.baseUrl, { serviceToken: cfg.serviceToken, postsPath: cfg.postsPath });
  }
  return new FakePlatformClient();
}
