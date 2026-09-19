import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { serverEnv } from '../../../src/config/env';

// npm workspace commands run from backend/, while integration tests run from
// the repository root. This avoids import.meta.url so the production CommonJS
// bundle works on Render too.
const workingDir = process.cwd();
const projectRoot = fs.existsSync(path.join(workingDir, 'src', 'server'))
  ? path.resolve(workingDir, '..')
  : workingDir;
dotenv.config({ path: path.join(projectRoot, '.env') });

export const config = {
  port: serverEnv.port,
  nodeEnv: serverEnv.nodeEnv,
  isProduction: serverEnv.isProduction,
  demoMode: serverEnv.demoMode,
  authMode: serverEnv.authMode,
  enableDemoLogin: serverEnv.enableDemoLogin,
  autoSeed: serverEnv.autoSeed,
  projectRoot,
  databaseUrl: serverEnv.databaseUrl,
  uploadDir: serverEnv.uploadDir || path.join(projectRoot, 'backend', 'uploads'),
};
