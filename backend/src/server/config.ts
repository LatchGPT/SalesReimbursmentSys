import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// npm workspace commands run from backend/, while integration tests run from
// the repository root. This avoids import.meta.url so the production CommonJS
// bundle works on Render too.
const workingDir = process.cwd();
const projectRoot = fs.existsSync(path.join(workingDir, 'src', 'server'))
  ? path.resolve(workingDir, '..')
  : workingDir;
dotenv.config({ path: path.join(projectRoot, '.env') });

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  demoMode: process.env.DEMO_MODE !== 'false',
  authMode: process.env.AUTH_MODE || 'demo',
  enableDemoLogin: process.env.ENABLE_DEMO_LOGIN !== 'false',
  autoSeed: process.env.AUTO_SEED !== 'false',
  logLevel: process.env.LOG_LEVEL || 'info',
  projectRoot,
  databaseUrl: process.env.DATABASE_URL || '',
  uploadDir: process.env.UPLOAD_DIR || path.join(projectRoot, 'backend', 'uploads'),
};
