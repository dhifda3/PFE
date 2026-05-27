import { db } from './src/infrastructure/db/index.js';
import { sql } from 'drizzle-orm';

await db.execute(sql.raw(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false`));

await db.execute(sql.raw(`
  CREATE TABLE IF NOT EXISTS "two_factor" (
    "id" text PRIMARY KEY,
    "secret" text NOT NULL,
    "backup_codes" text NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
  )
`));

console.log('Done');
process.exit(0);
