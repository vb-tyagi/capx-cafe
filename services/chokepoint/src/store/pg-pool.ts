// Production pool factory — the only place that imports the real `pg`. Kept separate so postgres.ts
// (the driver) depends only on the minimal SqlPool shape and stays testable against pg-mem offline.
import { Pool } from 'pg';
import type { SqlPool } from './postgres.ts';

export function createPgPool(connectionString: string): SqlPool {
  return new Pool({ connectionString }) as unknown as SqlPool;
}
