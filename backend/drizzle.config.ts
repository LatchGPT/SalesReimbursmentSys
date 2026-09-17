import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';
import path from 'path';

export default defineConfig({
  schema: path.resolve(__dirname, 'src/db/schema.ts'),
  out: path.resolve(__dirname, 'drizzle'),
  dialect: 'postgresql',
  dbCredentials: {
    // drizzle-kit only reads this for `push`/`studio` (live-DB commands);
    // `generate` works entirely from schema.ts and needs no connection.
    url: process.env.DATABASE_URL || '',
  },
});
