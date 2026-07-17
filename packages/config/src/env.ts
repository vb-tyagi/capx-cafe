// @capx/config — dependency-free environment validation. Parsed once at boot; fails fast,
// aggregating ALL problems so a misconfigured deploy surfaces every issue at once.

export type EnvVarType = 'string' | 'number' | 'boolean' | 'url';

export interface EnvVarSpec {
  type: EnvVarType;
  /** defaults to true; set false for genuinely optional vars. */
  required?: boolean;
  default?: string;
  description?: string;
  /** constrain a string/url value to a fixed set (enum). */
  oneOf?: string[];
  /** for type:'url' — reject any scheme other than https: (e.g. the hosted OAuth callback). */
  httpsOnly?: boolean;
  /** mark a value sensitive: its raw contents are NEVER echoed into problem strings / logs. */
  secret?: boolean;
}

export type EnvSchema = Record<string, EnvVarSpec>;
export type EnvValue = string | number | boolean;

export class EnvValidationError extends Error {
  problems: string[];
  constructor(problems: string[]) {
    super(`Invalid environment:\n- ${problems.join('\n- ')}`);
    this.name = 'EnvValidationError';
    this.problems = problems;
  }
}

function coerce(key: string, spec: EnvVarSpec, raw: string, problems: string[]): EnvValue {
  // Never echo a secret's raw value into an error message (which may be logged).
  const shown = spec.secret ? '<redacted>' : `"${raw}"`;
  if (spec.oneOf && !spec.oneOf.includes(raw)) {
    problems.push(`${key} must be one of ${spec.oneOf.join(' | ')} (got ${shown})`);
  }
  switch (spec.type) {
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        problems.push(`${key} must be a number (got ${shown})`);
        return 0;
      }
      return n;
    }
    case 'boolean': {
      const v = raw.toLowerCase();
      if (v === 'true' || v === '1') return true;
      if (v === 'false' || v === '0') return false;
      problems.push(`${key} must be a boolean true/false/1/0 (got ${shown})`);
      return false;
    }
    case 'url': {
      try {
        const u = new URL(raw);
        if (spec.httpsOnly && u.protocol !== 'https:') {
          problems.push(`${key} must be an https:// URL (got ${shown})`);
        }
        return raw;
      } catch {
        problems.push(`${key} must be a valid URL (got ${shown})`);
        return raw;
      }
    }
    default:
      return raw;
  }
}

export function parseEnv(
  schema: EnvSchema,
  source: Record<string, string | undefined> = process.env,
): Record<string, EnvValue> {
  const problems: string[] = [];
  const out: Record<string, EnvValue> = {};
  for (const key of Object.keys(schema)) {
    const spec = schema[key];
    const fromEnv = source[key];
    const raw = fromEnv !== undefined && fromEnv !== '' ? fromEnv : spec.default;
    if (raw === undefined) {
      if (spec.required !== false) problems.push(`${key} is required`);
      continue;
    }
    out[key] = coerce(key, spec, raw, problems);
  }
  if (problems.length) throw new EnvValidationError(problems);
  return out;
}

/**
 * Host-agnostic layered resolution: merge ordered sources, FIRST-defined-non-empty wins per key.
 * Pass sources in precedence order, highest first — e.g. [process.env, fileConfig, sessionConfig].
 * Pure + injectable: an absent ~/.capx/config.json is simply an omitted/empty source, so first run
 * does not fail (the connect flow writes it later). Secrets must never live in the file layer —
 * keep them in env / the chokepoint session only.
 */
export function mergeSources(
  ...sources: Array<Record<string, string | undefined> | undefined>
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const src of sources) {
    if (!src) continue;
    for (const key of Object.keys(src)) {
      const v = src[key];
      if ((out[key] === undefined || out[key] === '') && v !== undefined && v !== '') out[key] = v;
    }
  }
  return out;
}
