import dotenv from 'dotenv';
import * as path from 'path';
import { serverEnv } from '../config/env';

const projectRoot = process.cwd();
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
  uploadDir: serverEnv.uploadDir || path.join(projectRoot, 'uploads'),
};
