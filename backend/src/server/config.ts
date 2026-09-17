import dotenv from 'dotenv';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..', '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isVercel: Boolean(process.env.VERCEL),
  demoMode: process.env.DEMO_MODE !== 'false',
  authMode: process.env.AUTH_MODE || 'demo',
  enableDemoLogin: process.env.ENABLE_DEMO_LOGIN !== 'false',
  autoSeed: process.env.AUTO_SEED !== 'false',
  logLevel: process.env.LOG_LEVEL || 'info',
  projectRoot,
  databaseUrl: process.env.DATABASE_URL || '',
  uploadDir: process.env.UPLOAD_DIR || (
    process.env.VERCEL
      ? path.join(os.tmpdir(), 'uploads')
      : path.join(projectRoot, 'backend', 'uploads')
  ),
  distDir: path.join(projectRoot, 'frontend', 'dist'),
};
