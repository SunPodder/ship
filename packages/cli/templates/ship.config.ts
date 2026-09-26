import { defineConfig, defineModel, field, defineMediaModel } from '@ship/core';

export const Post = defineModel('Post', {
  title: field.text({ required: true, searchable: true }),
  slug: field.slug({ from: 'title', unique: true }),
  body: field.richText(),
  status: field.select(['draft', 'published', 'archived'], { default: 'draft' }),
  publishedAt: field.datetime({ nullable: true }),
}, {
  cache: { ttl: 300, strategy: 'stale-while-revalidate', tags: ['posts'] },
  permissions: {
    list: 'public',
    read: 'public',
    create: 'role:editor',
    update: 'role:editor',
    delete: 'role:admin',
  },
  admin: {
    listFields: ['title', 'status', 'publishedAt'],
    defaultSort: { field: 'publishedAt', order: 'desc' },
  },
});

// Ship ships a built-in Media library (auto WebP optimization via @ship/storage).
export const Media = defineMediaModel();

export default defineConfig({
  models: [Post, Media],
  database: { adapter: 'mongodb' },
  cache: { adapter: 'memory' }, // switch to 'redis' in production
  auth: { adapter: 'jwt' },
});
