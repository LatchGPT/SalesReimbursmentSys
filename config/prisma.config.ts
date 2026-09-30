import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const directUrl = process.env.DIRECT_URL?.trim();

export default defineConfig({
  schema: '../prisma/schema.prisma',
  migrations: {
    path: '../prisma/migrations',
  },
  // Generate does not need a valid datasource URL, but Prisma 7 will hang or error
  // if no URL is provided at all. We provide a dummy URL if DIRECT_URL is absent
  // (e.g. during Vercel builds where secrets are not exposed).
  datasource: { url: directUrl || 'postgresql://dummy:dummy@localhost:5432/dummy' },
});
