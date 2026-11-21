const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const app = require('../server');

const PUBLIC = path.join(__dirname, '..', 'public');

describe('GET / (index.html)', () => {
  let res;
  beforeAll(async () => {
    res = await request(app).get('/').expect(200);
  });

  test('is HTML with a strict CSP and no-cache', () => {
    expect(res.headers['content-type']).toMatch(/text\/html/);
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  test('has the main landmarks and key controls', () => {
    const html = res.text;
    expect(html).toMatch(/<header[\s>]/);
    expect(html).toMatch(/<main[^>]*id="main"/);
    expect(html).toMatch(/<footer[\s>]/);
    expect(html).toMatch(/<nav[^>]*aria-labelledby="lang-label"/);
    expect(html).toMatch(/<label for="message"/);
    expect(html).toMatch(/aria-live="polite"/);
    expect(html).toContain('class="skip-link" href="#main"');
    expect(html).toMatch(/<html lang="en">/);
  });

  test('has no inline scripts, styles or event handlers (CSP)', () => {
    const html = res.text;
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style[\s>]/);
    expect(html).not.toMatch(/\sstyle="/);
    expect(html).not.toMatch(/\son[a-z]+="/);
    expect(html).not.toMatch(/https?:\/\/(?!wa\.me\/)/); // no external fonts/CDNs
  });
});

describe('static assets', () => {
  test.each(['/app.js', '/lib.js', '/i18n.js', '/styles.css'])('%s is served with public caching', async (url) => {
    const res = await request(app).get(url).expect(200);
    expect(res.headers['cache-control']).toMatch(/^public, max-age=\d+$/);
  });

  test('whole page stays under 100KB uncompressed', () => {
    const total = ['index.html', 'app.js', 'lib.js', 'i18n.js', 'styles.css']
      .reduce((n, f) => n + fs.statSync(path.join(PUBLIC, f)).size, 0);
    expect(total).toBeLessThan(100 * 1024);
  });

  test('app.js never uses innerHTML / outerHTML / insertAdjacentHTML / document.write', () => {
    const src = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });
});
