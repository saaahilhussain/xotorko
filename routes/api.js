'use strict';

const express = require('express');
const { analyzeText, InputError } = require('../lib/analyze');
const { getActionCard, STATES, LANGS } = require('../lib/actions');

const router = express.Router();

router.post('/analyze', async (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || typeof body.text !== 'string') {
    return res.status(400).json({ error: 'Send JSON like {"text": "the message"}.' });
  }
  try {
    const result = await analyzeText(body.text);
    res.set('Cache-Control', 'no-store');
    return res.json(result);
  } catch (err) {
    if (err instanceof InputError) return res.status(400).json({ error: err.message });
    return next(err);
  }
});

router.get('/actions/:state', (req, res) => {
  const lang = req.query.lang === undefined ? 'en' : req.query.lang;
  if (typeof lang !== 'string' || !LANGS.includes(lang)) {
    return res.status(400).json({ error: `Unknown language. Use one of: ${LANGS.join(', ')}.` });
  }
  const card = getActionCard(req.params.state, lang);
  if (!card) {
    return res.status(400).json({ error: `Unknown state. Use one of: ${STATES.join(', ')}.` });
  }
  return res.json(card);
});

module.exports = router;
