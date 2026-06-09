import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface ScaffoldField {
	name: string;
	type: string;
	required: boolean;
}

export async function scaffoldCollection(
	slug: string,
	fields: ScaffoldField[],
	dir?: string,
): Promise<void> {
	const pascalName = slug
		.replace(/[-_]\w/g, (m) => m[1]!.toUpperCase())
		.replace(/^\w/, (c) => c.toUpperCase());

	const outDir = dir ?? join(process.cwd(), "collections");
	mkdirSync(outDir, { recursive: true });

	const fieldLines = fields
		.map(
			(f) => `\t\t{
\t\t\tname: "${f.name}",
\t\t\ttype: "${f.type}",
\t\t\trequired: ${f.required},
\t\t},`,
		)
		.join("\n");

	const content = `import { defineCollection } from "ship";

export const ${pascalName} = defineCollection({
\tslug: "${slug}",
\taccess: {
\t\tread: () => true,
\t\tcreate: () => true,
\t\tupdate: () => true,
\t\tdelete: () => true,
\t},
\tfields: [
${fieldLines}
\t],
});
`;

	const filePath = join(outDir, `${pascalName}.ts`);
	writeFileSync(filePath, content, "utf-8");
	console.log(`Created ${filePath}`);
}

export async function scaffoldInit(): Promise<void> {
	const configPath = join(process.cwd(), "ship.config.ts");
	const content = `import type { ShipConfig } from "ship";

const config: ShipConfig = {
\tdatabase: {
\t\tadapter: "memory",
\t},
\thttp: {
\t\tport: 3000,
\t},
\tcollections: [],
};

export default config;
`;

	writeFileSync(configPath, content, "utf-8");
	console.log(`Created ${configPath}`);
}
