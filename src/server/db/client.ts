import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getServerEnv } from '@/server/env';
import * as schema from '@/server/db/schema';

const globalForDb = globalThis as typeof globalThis & {
  paperBoyfriendPool?: Pool;
  paperBoyfriendDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function createPool() {
  return new Pool({
    connectionString: getServerEnv().DATABASE_URL,
  });
}

const pool = globalForDb.paperBoyfriendPool ?? createPool();

export const db = globalForDb.paperBoyfriendDb ?? drizzle(pool, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.paperBoyfriendPool = pool;
  globalForDb.paperBoyfriendDb = db;
}
