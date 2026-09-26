/**
 * `ship create <name>` — copies the embedded project templates into a new
 * directory, substituting `{{name}}`/`{{pm}}` placeholders. With `link`
 * (default, since `@ship/*` is unpublished), `@ship/*` dependencies are
 * stripped from every `package.json` and re-wired through `node_modules/@ship/*`
 * symlinks into this repo (via `.ship/packages/` and a `postinstall` script),
 * so a fresh project installs without an npm publish.
 */
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'templates',
);

/** Absolute path to this repo's `packages/` directory. */
const PACKAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** File extensions copied verbatim (no `{{...}}` substitution). */
const BINARY_EXTENSIONS = new Set([
  '.webp',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.ico',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.mp4',
  '.webm',
  '.mp3',
  '.wav',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
]);

const LINK_SCRIPT = `// Symlinks node_modules/@ship/* -> .ship/packages/* so a fresh project
// resolves the local @ship packages without an npm publish.
import { mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const linkDir = join(root, '.ship', 'packages');
const nmDir = join(root, 'node_modules', '@ship');
mkdirSync(nmDir, { recursive: true });

for (const name of readdirSync(linkDir)) {
  const target = join(nmDir, name);
  rmSync(target, { recursive: true, force: true });
  symlinkSync(join(linkDir, name), target, 'dir');
}

// Expose the ship bin so \`bunx ship <cmd>\` works.
const binDir = join(root, 'node_modules', '.bin');
mkdirSync(binDir, { recursive: true });
const bin = join(binDir, 'ship');
rmSync(bin, { force: true });
symlinkSync(join('..', '@ship', 'cli', 'src', 'cli.ts'), bin);
`;

export interface CreateOptions {
  pm?: string;
  /** Link `@ship/*` deps to the local repo (pre-publish). Defaults to true. */
  link?: boolean;
}

/** Scaffold a new project and return its absolute path. */
export async function createProject(
  name: string,
  options: CreateOptions = {},
): Promise<string> {
  validateName(name);

  const dest = join(process.cwd(), name);

  try {
    await stat(dest);
    throw new Error(`Directory already exists: ${dest}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Directory already exists')) {
      throw err;
    }
    // ENOENT — path is free, fall through to scaffold.
  }

  await copyTemplateDir(TEMPLATES_DIR, dest, { name, pm: options.pm ?? 'bun' });

  if (options.link ?? true) {
    await linkShipDeps(dest);
  }

  return dest;
}

function validateName(name: string): void {
  if (!name || /[/\\]/.test(name) || /^\s|\s$/.test(name)) {
    throw new Error(`Invalid project name: "${name}"`);
  }
}

async function copyTemplateDir(
  src: string,
  dest: string,
  vars: Record<string, string>,
): Promise<void> {
  await mkdir(dest, { recursive: true });

  for (const entry of await readdir(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyTemplateDir(srcPath, destPath, vars);
    } else if (entry.isFile()) {
      await copyTemplateFile(srcPath, destPath, vars);
    }
  }
}

async function copyTemplateFile(
  src: string,
  dest: string,
  vars: Record<string, string>,
): Promise<void> {
  // Binary assets carry no `{{...}}` placeholders and must not be decoded as
  // UTF-8 (that corrupts them); copy them verbatim.
  if (BINARY_EXTENSIONS.has(extname(src).toLowerCase())) {
    await copyFile(src, dest);
    return;
  }

  let content = await readFile(src, 'utf8');

  for (const [key, value] of Object.entries(vars)) {
    content = content.split(`{{${key}}}`).join(value);
  }

  await writeFile(dest, content, 'utf8');
}

/**
 * Strip every `@ship/*` dependency from the project's `package.json` files,
 * symlink each package into `.ship/packages/`, and add a `postinstall` that
 * symlinks `node_modules/@ship/*` back to those local packages. This sidesteps
 * bun `file:` resolution entirely.
 */
async function linkShipDeps(projectDir: string): Promise<void> {
  const linkDir = join(projectDir, '.ship', 'packages');
  await mkdir(linkDir, { recursive: true });

  const linked = new Set<string>();
  const pkgFiles = ['package.json', 'apps/api/package.json', 'apps/web/package.json'];

  for (const rel of pkgFiles) {
    const path = join(projectDir, rel);
    const pkg = JSON.parse(await readFile(path, 'utf8'));

    let changed = false;
    for (const section of ['dependencies', 'devDependencies'] as const) {
      const deps = pkg[section];
      if (!deps || typeof deps !== 'object') continue;

      for (const key of Object.keys(deps)) {
        if (!key.startsWith('@ship/')) continue;

        const name = key.slice('@ship/'.length);
        if (!linked.has(name)) {
          await symlink(join(PACKAGES_DIR, name), join(linkDir, name), 'dir');
          linked.add(name);
        }

        delete deps[key];
        changed = true;
      }
    }

    if (rel === 'package.json') {
      pkg.scripts ??= {};
      pkg.scripts.postinstall = 'node scripts/link-ship.mjs';
    }

    if (changed || rel === 'package.json') {
      await writeFile(path, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    }
  }

  await mkdir(join(projectDir, 'scripts'), { recursive: true });
  await writeFile(join(projectDir, 'scripts', 'link-ship.mjs'), LINK_SCRIPT, 'utf8');
}
