import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const directUrl = process.env.DIRECT_URL?.trim();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Generate does not need a datasource, which keeps DIRECT_URL out of normal
  // Vercel builds. Migration/introspection commands require this block and
  // Prisma will reject those commands when the administrative URL is absent.
  ...(directUrl ? { datasource: { url: directUrl } } : {}),
});
