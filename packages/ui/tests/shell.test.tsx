import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ShipAdminShell } from '../src/Shell';

describe('ShipAdminShell', () => {
  it('renders the logo, title, nav links, and children', () => {
    const html = renderToStaticMarkup(
      createElement(ShipAdminShell, {
        title: 'Ship',
        logo: '/ship-mark.jpg',
        nav: [
          { label: 'Dashboard', href: '/admin' },
          { label: 'Media', href: '/admin/media' },
        ],
        children: createElement('main', null, 'content'),
      }),
    );

    expect(html).toContain('ship-mark.jpg');
    expect(html).toContain('>Ship</span>');
    expect(html).toContain('/admin/media');
    expect(html).toContain('content');
  });
});
