import { Authors } from "./collections/Authors";
import { Books } from "./collections/Books";
import { Posts } from "./collections/Posts";
import type { ShipConfig } from "ship";

const config: ShipConfig = {
	database: {
		adapter: "memory",
	},
	http: {
		port: 8080,
		cors: ["http://localhost:3000"],
	},
	collections: [Authors, Books, Posts],
};

export default config;
