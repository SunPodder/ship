/**
 * Terminal styling helpers + the Ship logo. Kept separate from command logic
 * so the ASCII art and ANSI escapes stay in one place.
 */

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
} as const;

/** Small, colorized hull + mast. `Ship` sits on the hull line. */
const SHIP_LOGO = [
  `${c.cyan}    __|__${c.reset}`,
  `${c.cyan}   /     \\${c.reset}`,
  `${c.cyan}  |  ${c.bold}${c.blue}Ship${c.reset}${c.cyan}  |${c.reset}`,
  `${c.cyan}  |_______|${c.reset}`,
  `${c.cyan}   \\     /${c.reset}`,
  `${c.cyan}    \\___/${c.reset}`,
].join('\n');

export function printLogo(version: string): void {
  process.stdout.write(`${SHIP_LOGO}\n`);
  process.stdout.write(
    `${c.dim}  ship ${version} — schema-first full-stack CMS${c.reset}\n\n`,
  );
}

export function bold(msg: string): string {
  return `${c.bold}${msg}${c.reset}`;
}

export function success(msg: string): string {
  return `${c.green}${msg}${c.reset}`;
}

export function info(msg: string): string {
  return `${c.cyan}${msg}${c.reset}`;
}

export function warn(msg: string): string {
  return `${c.yellow}${msg}${c.reset}`;
}

export function error(msg: string): string {
  return `${c.red}${msg}${c.reset}`;
}

export function dim(msg: string): string {
  return `${c.dim}${msg}${c.reset}`;
}
