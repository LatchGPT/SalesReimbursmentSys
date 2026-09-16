import 'dotenv/config';
import * as path from 'path';
import * as os from 'os';

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
  databaseUrl: process.env.DATABASE_URL || '',
  uploadDir: process.env.UPLOAD_DIR || (
    process.env.VERCEL
      ? path.join(os.tmpdir(), 'uploads')
      : path.join(process.cwd(), 'uploads')
  ),
  distDir: path.join(process.cwd(), 'dist'),
};
