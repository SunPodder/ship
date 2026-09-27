import { describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineModel, field } from '@ship/core';
import { generateAdminPages, humanize } from '../src/commands/generate';

describe('humanize', () => {
  it('splits camelCase field names into title case', () => {
    expect(humanize('publishedAt')).toBe('Published At');
    expect(humanize('title')).toBe('Title');
  });
});

describe('generateAdminPages', () => {
  it('emits a complete, internally-consistent admin tree', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ship-generate-'));

    try {
      const models = [
        defineModel('Post', {
          title: field.text({ required: true }),
          publishedAt: field.datetime({ nullable: true }),
        }),
        defineModel('Media', { filename: field.text({ required: true }) }),
      ];

      await generateAdminPages(models, { outDir: dir });

      const ship = await readFile(join(dir, 'lib/ship.ts'), 'utf8');
      const nav = await readFile(join(dir, 'lib/admin-nav.ts'), 'utf8');
      const list = await readFile(join(dir, 'app/admin/posts/page.tsx'), 'utf8');
      const create = await readFile(
        join(dir, 'app/admin/posts/new/page.tsx'),
        'utf8',
      );
      const edit = await readFile(
        join(dir, 'app/admin/posts/[id]/page.tsx'),
        'utf8',
      );

      expect(ship).toContain("import { Post, Media } from '../../../../ship.config'");
      expect(ship).toContain('post: createModelApi(Post, { baseUrl: url })');
      expect(ship).toContain('media: createModelApi(Media, { baseUrl: url })');

      expect(nav).toContain("{ label: 'Posts', href: '/admin/posts' }");

      expect(list).toContain("'use client'");
      expect(list).toContain('ShipTable');
      expect(list).toContain('api.findMany');

      expect(create).toContain('ShipField');
      expect(create).toContain('api.create');

      expect(edit).toContain('api.update');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
