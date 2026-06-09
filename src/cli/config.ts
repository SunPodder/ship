import type { ShipConfig, CollectionConfig } from "../types";

export async function loadConfig(path?: string): Promise<ShipConfig> {
	const configPath =
		path ?? (await resolveConfigPath());

	if (!configPath) {
		throw new Error(
			"No ship.config.ts found in current directory. Run `ship init` to create one.",
		);
	}

	const mod = await import(configPath);
	const cfg = mod.default ?? mod;

	if (!cfg || !cfg.collections) {
		throw new Error(
			"Invalid config file. Default export must be a ShipConfig object with a `collections` array.",
		);
	}

	return cfg as ShipConfig;
}

async function resolveConfigPath(): Promise<string | null> {
	const candidates = [
		`${process.cwd()}/ship.config.ts`,
		`${process.cwd()}/ship.config.js`,
		`${process.cwd()}/ship.config.mjs`,
	];

	const { existsSync } = await import("fs");
	for (const p of candidates) {
		if (existsSync(p)) return p;
	}
	return null;
}

export function printRoutes(collections: CollectionConfig[]): void {
	console.log("\n  Routes:\n");
	for (const col of collections) {
		console.log(`  ${"GET".padEnd(6)} /api/${col.slug}`);
		console.log(`  ${"GET".padEnd(6)} /api/${col.slug}/:id`);
		console.log(`  ${"POST".padEnd(6)} /api/${col.slug}`);
		console.log(`  ${"PUT".padEnd(6)} /api/${col.slug}/:id`);
		console.log(`  ${"DELETE".padEnd(6)} /api/${col.slug}/:id`);
		console.log("");
	}
}

export function printCollections(collections: CollectionConfig[]): void {
	for (const col of collections) {
		console.log(`\n  📦 ${col.slug}`);
		console.log(`     Fields:`);
		for (const f of col.fields) {
			const req = f.required ? "required" : "optional";
			const extra =
				f.type === "relation"
					? ` → ${f.relationTo?.slug ?? "?"}`
					: "";
			console.log(`       • ${f.name}: ${f.type} (${req})${extra}`);
		}
	}
	console.log("");
}
