'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const helmet = require('helmet');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const apiRouter = require('./routes/api');

const app = express();

// Cloud Run sits behind one proxy hop; needed for per-IP rate limiting.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        scriptSrcAttr: ["'none'"],
      },
    },
  }),
);
app.use(compression());

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a minute and try again.' },
  }),
);
// Stricter limit on the only route that can call Gemini (cost + abuse).
app.use(
  '/api/analyze',
  rateLimit({
    windowMs: 60 * 1000,
    limit: () => Number.parseInt(process.env.ANALYZE_RATE_LIMIT, 10) || 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many checks. Please wait a minute and try again.' },
  }),
);
app.use('/api', express.json({ limit: '10kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiRouter);

// Static files. Asset URLs in index.html carry a content hash (?v=...), computed
// at startup, so a deploy changes every URL at once: HTML is revalidated on each
// load (no-cache + ETag) and versioned CSS/JS can be cached for a day.
const PUBLIC_DIR = path.join(__dirname, 'public');
const ASSET_MAX_AGE_S = 24 * 60 * 60;
const ASSET_VERSION = (() => {
  const hash = crypto.createHash('sha256');
  for (const f of fs.readdirSync(PUBLIC_DIR).sort()) {
    if (f !== 'index.html') hash.update(f).update(fs.readFileSync(path.join(PUBLIC_DIR, f)));
  }
  return hash.digest('hex').slice(0, 12);
})();
const INDEX_HTML = fs
  .readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')
  .replace(/(src|href)="\/([\w.-]+\.(?:js|css|svg))"/g, `$1="/$2?v=${ASSET_VERSION}"`);

app.get(['/', '/index.html'], (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(INDEX_HTML);
});

app.use(
  express.static(PUBLIC_DIR, {
    index: false,
    etag: true,
    setHeaders(res) {
      res.setHeader('Cache-Control', `public, max-age=${ASSET_MAX_AGE_S}`);
    },
  }),
);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Central error handler: safe messages only, never stack traces or message text.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Message is too large.' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON.' });
  }
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[error] ${(err && err.name) || 'Error'}`);
  }
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Xotorko listening on port ${port}`);
  });
}

module.exports = app;
module.exports.ASSET_VERSION = ASSET_VERSION;
