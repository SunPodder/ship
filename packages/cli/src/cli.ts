#!/usr/bin/env bun
/**
 * `ship` CLI — scaffold (`create`), develop (`dev`), build (`build`), and
 * serve (`sail`) a Ship project. `dev`/`build`/`sail` delegate to the
 * project's own Turborepo so the CLI stays thin.
 */
import { cac } from 'cac';
import { createProject } from './commands/create';
import { loadModels, planGeneratePages, runGenerate } from './commands/generate';
import { runTask } from './commands/run';
import { dim, printLogo } from './term';

const VERSION = '0.1.0';

const cli = cac('ship');

cli.version(VERSION);

cli
  .command('create <name>', 'Scaffold a new Ship project')
  .option('--pm <pm>', 'Package manager: bun | pnpm | npm', { default: 'bun' })
  .option('--link', 'Link @ship/* to the local repo (default true)', { default: true })
  .action(async (name: string, options: { pm?: string; link?: boolean }) => {
    printLogo(VERSION);
    await createProject(name, { pm: options.pm ?? 'bun', link: options.link });
  });

cli
  .command('dev', 'Start the dev servers (API + web)')
  .action(async () => {
    console.log(dim('ship dev — starting API + web…'));
    const code = await runTask('dev');
    if (code) process.exit(code);
  });

cli
  .command('build', 'Build the project for production')
  .action(async () => {
    console.log(dim('ship build — building for production…'));
    const code = await runTask('build');
    if (code) process.exit(code);
  });

cli
  .command('sail', 'Serve the built app in production')
  .action(async () => {
    console.log(dim('ship sail — serving the built app…'));
    const code = await runTask('start');
    if (code) process.exit(code);
  });

cli
  .command('generate', 'Generate SDK + admin pages from ship.config.ts')
  .option('--dry-run', 'Preview without writing')
  .action(async (options: { dryRun?: boolean }) => {
    if (options.dryRun) {
      const models = await loadModels(process.cwd());
      console.log('Would write:');
      for (const rel of planGeneratePages(models)) {
        console.log(`  ${rel}`);
      }
    } else {
      await runGenerate();
    }
  });

cli.help();
cli.parse();
