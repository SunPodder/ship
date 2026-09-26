import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProject } from '../src/commands/create';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ship-create-'));
  process.chdir(dir);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('ship create', () => {
  it('scaffolds the full project tree with name substitution', async () => {
    const dest = await createProject('my-app');

    await expect(readFile(join(dest, 'package.json'), 'utf8')).resolves.toContain(
      '"my-app"',
    );
    await expect(readFile(join(dest, 'ship.config.ts'), 'utf8')).resolves.toContain(
      'defineConfig',
    );
    await expect(
      readFile(join(dest, 'apps/api/src/index.ts'), 'utf8'),
    ).resolves.toContain('createApp');
    await expect(
      readFile(join(dest, 'apps/web/src/app/page.tsx'), 'utf8'),
    ).resolves.toContain('Ship');
    await expect(readFile(join(dest, '.env.example'), 'utf8')).resolves.toContain(
      'my-app',
    );
  });

  it('refuses to overwrite an existing directory', async () => {
    await expect(createProject('my-app')).rejects.toThrow('already exists');
  });

  it('rejects invalid project names', async () => {
    await expect(createProject('bad/name')).rejects.toThrow('Invalid project name');
  });
});
