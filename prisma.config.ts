import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig, env } from 'prisma/config';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prisma CLI operations use the direct/session-mode administrative URL.
    // The long-running Render service uses pooled DATABASE_URL at runtime.
    url: env('DIRECT_URL'),
  },
});
