/**
 * Task runner — `dev`/`build`/`sail` map to Turborepo tasks in the project.
 * The spawned child inherits stdio and stays referenced, so long-running dev
 * servers keep the CLI process alive until interrupted.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';

export type RunTask = 'dev' | 'build' | 'start';

export interface RunOptions {
  spawnFn?: typeof spawn;
}

/** Resolve to the child's exit code (null if killed by a signal). */
export async function runTask(
  task: RunTask,
  options: RunOptions = {},
): Promise<number | null> {
  const spawnFn = options.spawnFn ?? spawn;
  const child: ChildProcess = spawnFn('bunx', ['turbo', 'run', task], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  const [code] = (await once(child, 'close')) as [
    number | null,
    NodeJS.Signals | null,
  ];
  return code;
}
