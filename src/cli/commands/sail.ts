import { Ship } from "../../ship";
import type { ShipConfig } from "../../types";

export async function sail(config: ShipConfig, port?: number): Promise<void> {
	const merged: ShipConfig = {
		...config,
		http: {
			...config.http,
			port: port ?? config.http?.port ?? 3000,
		},
	};
	const ship = Ship(merged);
	ship.sail();

	await new Promise(() => {});
}
