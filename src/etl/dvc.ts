import { spawnSync } from 'child_process';
import path from 'path';
import logger from './logger';

const DVC_CMD = process.env.DVC_CMD || 'dvc';

export function dvcRun(args: string[], cwd?: string) {
  logger.info('Running dvc %s', args.join(' '));
  const res = spawnSync(DVC_CMD, args, { stdio: 'inherit', cwd: cwd || process.cwd(), shell: true });
  if (res.error) {
    logger.error('DVC command error: %s', res.error.message);
    throw res.error;
  }
  return res.status === 0;
}

export function dvcAdd(filePath: string) {
  return dvcRun(['add', filePath], process.cwd());
}

export function dvcPush() {
  return dvcRun(['push'], process.cwd());
}

export function dvcCommit(msg = 'add dataset') {
  // DVC usually uses git for metadata; this helper just runs git add/commit for the .dvc files
  try {
    spawnSync('git', ['add', '-A'], { stdio: 'inherit', shell: true });
    spawnSync('git', ['commit', '-m', msg], { stdio: 'inherit', shell: true });
    return true;
  } catch (e) {
    logger.warn('Git commit for DVC failed: %s', (e as Error).message);
    return false;
  }
}
