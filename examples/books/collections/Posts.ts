import { defineCollection } from "ship";

export const Posts = defineCollection({
	slug: "posts",
	access: {
		read: () => true,
		create: () => true,
		update: () => true,
		delete: () => true,
	},
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
		},
		{
			name: "body",
			type: "text",
			required: true,
		},
		{
			name: "author",
			type: "relation",
			required: true,
		},
	],
});
