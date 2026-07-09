// @capx/config — dependency-free environment validation. Parsed once at boot; fails fast,
// aggregating ALL problems so a misconfigured deploy surfaces every issue at once.

export type EnvVarType = 'string' | 'number' | 'boolean' | 'url';

export interface EnvVarSpec {
  type: EnvVarType;
  /** defaults to true; set false for genuinely optional vars. */
  required?: boolean;
  default?: string;
  description?: string;
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
  switch (spec.type) {
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        problems.push(`${key} must be a number (got "${raw}")`);
        return 0;
      }
      return n;
    }
    case 'boolean': {
      const v = raw.toLowerCase();
      if (v === 'true' || v === '1') return true;
      if (v === 'false' || v === '0') return false;
      problems.push(`${key} must be a boolean true/false/1/0 (got "${raw}")`);
      return false;
    }
    case 'url': {
      try {
        new URL(raw);
        return raw;
      } catch {
        problems.push(`${key} must be a valid URL (got "${raw}")`);
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
