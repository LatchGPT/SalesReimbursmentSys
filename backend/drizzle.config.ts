import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default defineConfig({
  // This config runs from backend/ (directly or through npm workspaces).
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // drizzle-kit only reads this for `push`/`studio` (live-DB commands);
    // `generate` works entirely from schema.ts and needs no connection.
    url: process.env.DATABASE_URL || '',
  },
});
