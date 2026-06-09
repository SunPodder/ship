import type { CollectionConfig } from "../../types";
import { printRoutes, printCollections } from "../config";

export async function inspect(
	collections: CollectionConfig[],
	sub?: string,
): Promise<void> {
	switch (sub) {
		case "routes":
			printRoutes(collections);
			break;
		case "collections":
			printCollections(collections);
			break;
		default: {
			const totalFields = collections.reduce(
				(s, c) => s + c.fields.length,
				0,
			);
			console.log(`\n  Ship App Inspection\n`);
			console.log(`  Collections: ${collections.length}`);
			console.log(`  Total fields: ${totalFields}`);
			printRoutes(collections);
			printCollections(collections);
		}
	}
}
