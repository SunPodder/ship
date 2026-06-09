#!/usr/bin/env bun
import { loadConfig } from "./config";
import { sail } from "./commands/sail";
import { inspect } from "./commands/inspect";
import { scaffoldCollection, scaffoldInit } from "./commands/scaffold";

function printHelp(): void {
	console.log(`
  ship — CLI for the Ship framework

  Usage:
    ship <command> [options]

  Commands:
    sail              Start the HTTP server
    inspect [what]    Inspect the app (routes, collections, or all)
    scaffold init     Create a ship.config.ts file
    scaffold collection <slug> [options]
                      Scaffold a new collection

  Options:
    --port <number>   Port for the server (default: 3000)
    --config <path>   Path to config file
    --fields          Field definitions for scaffold (name:type:required,...)
    --dir             Output directory for scaffolding
    --help            Show this help

  Examples:
    ship sail --port 4000
    ship inspect routes
    ship inspect collections
    ship scaffold collection posts --fields "title:text:true,body:text:true"
    ship scaffold init
`);
}

function parseFields(
	raw: string,
): { name: string; type: string; required: boolean }[] {
	return raw.split(",").map((part) => {
		const [name, type = "text", required = "true"] = part.split(":");
		return {
			name: name ?? "field",
			type,
			required: required === "true",
		};
	});
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
		printHelp();
		return;
	}

	const cmd = args[0]!;

	if (cmd === "sail") {
		const portIdx = args.indexOf("--port");
		const port = portIdx !== -1 ? Number(args[portIdx + 1]) : undefined;

		const configIdx = args.indexOf("--config");
		const configPath =
			configIdx !== -1 ? args[configIdx + 1] : undefined;

		const config = await loadConfig(configPath);
		await sail(config, port);
		return;
	}

	if (cmd === "inspect") {
		const sub = args[1];
		const config = await loadConfig();
		await inspect(config.collections, sub);
		return;
	}

	if (cmd === "scaffold") {
		const sub = args[1];

		if (sub === "init") {
			await scaffoldInit();
			return;
		}

		if (sub === "collection") {
			const slug = args[2];
			if (!slug) {
				console.error("Error: collection slug is required.");
				console.log("Usage: ship scaffold collection <slug> [options]");
				process.exit(1);
			}

			const fieldsIdx = args.indexOf("--fields");
			const fields = fieldsIdx !== -1
				? parseFields(args[fieldsIdx + 1] ?? "")
				: [];

			const dirIdx = args.indexOf("--dir");
			const dir = dirIdx !== -1 ? args[dirIdx + 1] : undefined;

			await scaffoldCollection(slug, fields, dir);
			return;
		}

		console.error(`Unknown scaffold sub-command: ${sub}`);
		printHelp();
		process.exit(1);
	}

	console.error(`Unknown command: ${cmd}`);
	printHelp();
	process.exit(1);
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
