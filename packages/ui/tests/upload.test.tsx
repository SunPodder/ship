import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ShipFileUpload, ShipImageUpload } from '../src/Upload';

describe('ShipImageUpload', () => {
  it('renders a file input', () => {
    const markup = renderToStaticMarkup(
      createElement(ShipImageUpload, { name: 'image' }),
    );

    expect(markup).toContain('<input type="file"');
    expect(markup).toContain('name="image"');
  });
});

describe('ShipFileUpload', () => {
  it('renders a file input with the given accept', () => {
    const markup = renderToStaticMarkup(
      createElement(ShipFileUpload, { name: 'file', accept: 'application/pdf' }),
    );

    expect(markup).toContain('<input type="file"');
    expect(markup).toContain('accept="application/pdf"');
  });
});
