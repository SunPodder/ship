import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { field } from '@ship/core';
import {
  ShipButton,
  ShipField,
  ShipPagination,
  ShipSearchInput,
  ShipTable,
} from '../src';

describe('Ship UI components', () => {
  it('renders a primary button with its children', () => {
    const markup = renderToStaticMarkup(
      createElement(ShipButton, null, 'Save'),
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('btn-primary');
    expect(markup).toContain('Save');
  });

  it('renders header labels and one row per data item', () => {
    const columns = [
      { field: 'name', label: 'Name' },
      { field: 'age', label: 'Age' },
    ];
    const data = [
      { name: 'Ada', age: 36 },
      { name: 'Grace', age: 45 },
    ];

    const markup = renderToStaticMarkup(
      createElement(ShipTable, { columns, data }),
    );

    expect(markup).toContain('>Name</th>');
    expect(markup).toContain('>Age</th>');
    expect(markup).toContain('>Ada</td>');
    expect(markup).toContain('>36</td>');

    const tbody = markup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
    expect((tbody.match(/<tr>/g) ?? []).length).toBe(2);
  });

  it('renders select, boolean, and integer fields', () => {
    const select = renderToStaticMarkup(
      createElement(ShipField, {
        name: 'status',
        def: field.select(['a', 'b']),
        onChange: () => {},
      }),
    );
    expect(select).toContain('<select');
    expect(select).toContain('<option value="a">a</option>');
    expect(select).toContain('<option value="b">b</option>');

    const boolean = renderToStaticMarkup(
      createElement(ShipField, {
        name: 'active',
        def: field.boolean(),
        onChange: () => {},
      }),
    );
    expect(boolean).toContain('type="checkbox"');

    const integer = renderToStaticMarkup(
      createElement(ShipField, {
        name: 'count',
        def: field.integer(),
        onChange: () => {},
      }),
    );
    expect(integer).toContain('type="number"');
  });

  it('renders page number and disables prev/next at the boundaries', () => {
    const mid = renderToStaticMarkup(
      createElement(ShipPagination, { page: 2, hasNext: true, onPage: () => {} }),
    );
    expect(mid).toContain('Page 2');

    const last = renderToStaticMarkup(
      createElement(ShipPagination, { page: 5, hasNext: false, onPage: () => {} }),
    );
    const prevTag = last.match(/<button[^>]*>Previous<\/button>/)?.[0] ?? '';
    const nextTag = last.match(/<button[^>]*>Next<\/button>/)?.[0] ?? '';
    expect(prevTag).not.toContain('disabled=""');
    expect(nextTag).toContain('disabled=""');

    const first = renderToStaticMarkup(
      createElement(ShipPagination, { page: 1, hasNext: true, onPage: () => {} }),
    );
    const firstPrev = first.match(/<button[^>]*>Previous<\/button>/)?.[0] ?? '';
    expect(firstPrev).toContain('disabled=""');
  });

  it('renders a search input', () => {
    const markup = renderToStaticMarkup(
      createElement(ShipSearchInput, { value: '', onChange: () => {} }),
    );
    expect(markup).toContain('type="search"');
  });
});
