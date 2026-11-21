'use strict';

// Xotorko UI. All user and server text goes through textContent / DOM nodes;
// innerHTML is never used.
(function () {
  const I18N = window.XotorkoI18n;
  const L = window.XotorkoLib;

  const $ = (id) => document.getElementById(id);
  const form = $('analyze-form');
  const textarea = $('message');
  const submit = $('submit');
  const statusEl = $('status');
  const errorEl = $('message-error');
  const resultEl = $('result');
  const announceEl = $('announce');
  const actionCardEl = $('action-card');
  const stateButtons = $('state-buttons');

  const state = {
    lang: 'en',
    result: null, // last /api/analyze response
    text: '', // the text that was checked
    checkedAt: null,
    choice: null, // chosen "what have you done" state
    card: null, // last action card
  };

  const t = (key, vars) => I18N.t(state.lang, key, vars);
  const tEn = (key, vars) => I18N.t('en', key, vars);

  // ---------------------------------------------------------------- helpers
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function announce(msg) {
    // Clear first so repeating the same message is announced again.
    announceEl.textContent = '';
    window.setTimeout(() => { announceEl.textContent = msg; }, 50);
  }

  // Status is stored as an i18n key so it follows a language switch.
  let statusKey = '';
  // Motion: animations live in CSS under (prefers-reduced-motion: no-preference)
  // and are keyed off .is-revealing. Replaying = remove, force a reflow, re-add;
  // no timers, and nothing here waits on an animation.
  function motionOK() {
    return !window.matchMedia || window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  }

  function replayReveal(node) {
    node.classList.remove('is-revealing');
    void node.offsetWidth; // restart CSS animations
    node.classList.add('is-revealing');
  }

  // Same focus target as before; the scroll is smooth only when motion is OK.
  function focusAndScroll(node) {
    node.focus({ preventScroll: true });
    node.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'start' });
  }

  function setStatus(key, loading) {
    statusKey = key;
    statusEl.textContent = key ? t(key) : '';
    statusEl.classList.toggle('is-loading', Boolean(loading));
  }

  function newTabHint() {
    return el('span', { class: 'visually-hidden' }, ` ${t('new_tab')}`);
  }

  // ---------------------------------------------------------------- language
  function applyStaticStrings() {
    document.documentElement.lang = state.lang;
    document.title = t('doc_title');
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    document.querySelectorAll('.lang-btn').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === state.lang));
    });
  }

  function setLang(lang) {
    if (!I18N.LANGS.includes(lang)) lang = 'en';
    state.lang = lang;
    try { localStorage.setItem('xotorko.lang', lang); } catch (e) { /* storage unavailable */ }
    applyStaticStrings();
    if (statusKey) statusEl.textContent = t(statusKey);
    if (state.result) renderResult(state.result);
    if (state.choice) loadActionCard(state.choice, { focus: false });
  }

  document.querySelectorAll('.lang-btn').forEach((b) => {
    b.addEventListener('click', () => setLang(b.getAttribute('data-lang')));
  });

  // ---------------------------------------------------------------- input
  document.querySelectorAll('[data-example]').forEach((chip) => {
    chip.addEventListener('click', () => {
      textarea.value = L.EXAMPLES[chip.getAttribute('data-example')] || '';
      hideError();
      textarea.focus();
    });
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    textarea.setAttribute('aria-invalid', 'true');
  }
  function hideError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
    textarea.removeAttribute('aria-invalid');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = textarea.value.normalize('NFC').trim();
    if (!text) {
      showError(t('err_empty'));
      textarea.focus();
      return;
    }
    hideError();
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    resultEl.setAttribute('aria-busy', 'true');
    setStatus('status_checking', true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok || !data || !data.verdict) {
        setStatus('', false);
        showError((data && data.error) || t('err_generic'));
        textarea.focus();
        return;
      }
      state.result = data;
      state.text = text;
      state.checkedAt = new Date();
      state.choice = null;
      state.card = null;
      renderResult(data);
      resetActionCard();
      resultEl.hidden = false;
      replayReveal(resultEl);
      setStatus('status_done', false);
      focusAndScroll($('result-heading'));
    } catch (err) {
      setStatus('', false);
      showError(t('err_network'));
    } finally {
      submit.disabled = false;
      form.setAttribute('aria-busy', 'false');
      resultEl.setAttribute('aria-busy', 'false');
    }
  });

  // ---------------------------------------------------------------- result
  function renderResult(r) {
    renderVerdictLine(r);
    renderBadges(r);
    renderHighlighted(r);
    renderMessageEvidence(r);
    renderLinkEvidence(r);
    renderBehaviour(r);
    renderChannel(r);
    renderVerdict(r);
    updateShare();
  }

  function renderVerdictLine(r) {
    const box = $('verdict-line');
    clear(box);
    box.className = `verdict-line verdict-line-${r.verdict}`;
    box.append(
      el('span', { class: 'verdict-line-icon', 'aria-hidden': 'true' }, VERDICT_ICON[r.verdict] || '!'),
      el('strong', {}, t(`verdict_${r.verdict}`)),
      ' · ',
      el('a', { href: '#verdict', 'data-do': 'see-why' }, t('see_why')),
    );
  }

  function renderBadges(r) {
    const box = $('badges');
    clear(box);
    if (r.limited_mode) box.append(el('span', { class: 'badge' }, t('limited_badge')));
    if (r.source === 'cache') box.append(el('span', { class: 'badge' }, t('cache_badge')));
  }

  function renderHighlighted(r) {
    const box = $('highlighted');
    clear(box);
    const segs = L.highlightSegments(state.text, r.evidence.message);
    for (const s of segs) {
      if (!s.tactic) {
        box.append(document.createTextNode(s.text));
      } else {
        box.append(el('mark', {}, el('span', { class: 'tag' }, t(`tac_${s.tactic.type}`)), s.text));
      }
    }
  }

  function list(id, items, emptyText) {
    const ul = $(id);
    clear(ul);
    if (!items.length) ul.append(el('li', { class: 'empty' }, emptyText));
    for (const it of items) ul.append(it);
  }

  function renderMessageEvidence(r) {
    list('ev-message', r.evidence.message.map((tac) => el('li', {},
      el('strong', {}, `${t(`tac_${tac.type}`)}: `),
      `“${tac.exact_span}” — `,
      el('span', { lang: 'en' }, tac.explanation), // server text is English
    )), t('msg_none'));
  }

  function renderLinkEvidence(r) {
    // One block per domain: the (defanged) domain as a heading, reasons below.
    const items = L.groupLinksByDomain(r.evidence.link).map((g) => {
      const reasons = g.signals.length
        ? g.signals.map((sig) => el('li', { class: L.LINK_WARNINGS.includes(sig.type) ? 'ev-warn' : 'ev-info', lang: 'en' }, sig.reason))
        : [el('li', { class: 'empty' }, t('link_clean'))];
      return el('li', { class: 'ev-domain' },
        el('h4', { class: 'ev-host' }, L.defang(g.host)),
        el('ul', { class: 'ev-reasons' }, reasons));
    });
    list('ev-link', items, t('link_none'));
  }

  function renderBehaviour(r) {
    const acts = r.evidence.behaviour || [];
    const empty = r.limited_mode ? t('behaviour_unknown') : t('behaviour_none');
    list('ev-behaviour', acts.map((a) => el('li', {}, t(`act_${a}`))), empty);
  }

  function renderChannel(r) {
    const box = $('channel');
    const cc = r.channel_compare;
    if (!cc) { box.hidden = true; return; }
    const dl = $('channel-list');
    clear(dl);
    const row = (label, ...value) => { dl.append(el('dt', {}, label), el('dd', {}, ...value)); };
    row(t('cc_claims'), cc.claimed);
    const hasLink = cc.link_domains && cc.link_domains.length;
    row(t('cc_link'), hasLink ? el('span', { class: 'ev-host' }, cc.link_domains.map(L.defang).join(', ')) : t('cc_nolink'));
    row(t('cc_official'), el('span', { class: 'ev-host' }, (cc.expected_domains || []).join(', ')));
    if (hasLink) {
      row(t('cc_result'), cc.match
        ? el('span', { class: 'cc-match' }, '✓ ', t('cc_match'))
        : el('span', { class: 'cc-nomatch' }, '✗ ', t('cc_nomatch')));
    }
    if (cc.official_sms_sender_id) row(t('cc_sender_id'), cc.official_sms_sender_id);
    if (cc.note) dl.append(el('dd', { class: 'step-note', lang: 'en' }, cc.note));
    box.hidden = false;
  }

  const VERDICT_ICON = { high_risk: '!', unable_to_verify: '?', no_strong_indicators: 'i' };

  function renderVerdict(r) {
    const box = $('verdict');
    clear(box);
    box.className = `verdict reveal-step reveal-step-4 verdict-${r.verdict}`;
    const body = el('div', {}, el('p', { class: 'verdict-title' }, el('strong', {}, t(`verdict_${r.verdict}`))));
    if (r.verdict === 'no_strong_indicators') body.append(el('p', {}, t('disclaimer')));
    else body.append(el('p', {}, t(`verdict_${r.verdict}_desc`)));
    box.append(el('span', { class: 'verdict-icon', 'aria-hidden': 'true' }, VERDICT_ICON[r.verdict] || '!'), body);
  }

  $('verdict-line').addEventListener('click', (e) => {
    if (!e.target.closest('[data-do="see-why"]')) return;
    e.preventDefault();
    const banner = $('verdict');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    banner.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    banner.focus({ preventScroll: true });
  });

  // ---------------------------------------------------------------- actions
  function resetActionCard() {
    clear(actionCardEl);
    actionCardEl.hidden = true;
    stateButtons.hidden = false;
  }

  stateButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-state]');
    if (btn) loadActionCard(btn.getAttribute('data-state'), { focus: true });
  });

  async function loadActionCard(choice, { focus }) {
    state.choice = choice;
    updateShare();
    actionCardEl.hidden = false;
    actionCardEl.setAttribute('aria-busy', 'true');
    clear(actionCardEl);
    actionCardEl.className = 'action-card';
    actionCardEl.append(el('p', {}, t('loading_card')));
    try {
      const res = await fetch(`/api/actions/${encodeURIComponent(choice)}?lang=${encodeURIComponent(state.lang)}`);
      if (!res.ok) throw new Error('bad status');
      state.card = await res.json();
      renderActionCard(state.card);
      stateButtons.hidden = true;
      if (focus) {
        replayReveal(actionCardEl);
        focusAndScroll($('action-heading'));
      }
    } catch (err) {
      clear(actionCardEl);
      actionCardEl.append(el('p', { class: 'error' }, t('err_network')));
    } finally {
      actionCardEl.setAttribute('aria-busy', 'false');
    }
  }

  function channelControls(ch) {
    const out = [];
    if (ch.tel) {
      out.push(el('a', { class: 'btn btn-call', href: `tel:${ch.tel}` }, `📞 ${t('call_btn', { tel: ch.tel })}`));
    }
    if (ch.url && /^https:\/\//.test(ch.url)) {
      out.push(el('a', { class: 'btn btn-secondary', href: ch.url, target: '_blank', rel: 'noopener noreferrer' }, el('span', { lang: 'en' }, ch.label), newTabHint()));
    }
    return out;
  }

  function renderActionCard(card) {
    clear(actionCardEl);
    actionCardEl.className = `action-card reveal urgency-${card.urgency}`;
    const steps = el('ol', { class: 'steps' });
    for (const step of card.steps) {
      const li = el('li', {}, step.text);
      const controls = [];
      if (step.channel) {
        controls.push(...channelControls(step.channel));
        if (step.channel.how) li.append(el('p', { class: 'step-note', lang: 'en' }, step.channel.how));
      }
      if (step.action === 'copy_report') {
        controls.push(el('button', { type: 'button', class: 'btn btn-secondary', 'data-do': 'copy' }, t('copy_report')));
      }
      if (step.action === 'share_warning') {
        controls.push(el('a', { class: 'btn btn-whatsapp', href: warningUrl(), target: '_blank', rel: 'noopener noreferrer', 'data-do': 'warn' }, t('warn_family'), newTabHint()));
      }
      if (controls.length) li.append(el('div', { class: 'step-actions' }, controls));
      steps.append(li);
    }
    actionCardEl.append(
      el('span', { class: 'urgency-label' }, t(`urgency_${card.urgency}`)),
      el('h3', { id: 'action-heading', tabindex: '-1' }, card.headline),
      steps,
      el('button', { type: 'button', class: 'btn btn-link', 'data-do': 'change' }, t('change_answer')),
    );
  }

  actionCardEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-do]');
    if (!btn) return;
    const what = btn.getAttribute('data-do');
    if (what === 'copy') copyReport();
    if (what === 'change') {
      state.choice = null;
      state.card = null;
      resetActionCard();
      updateShare();
      const first = stateButtons.querySelector('button');
      if (first) first.focus();
    }
  });

  // ---------------------------------------------------------------- share
  function reportText() {
    return L.buildReport(state.result, { t: tEn, now: state.checkedAt || new Date(), state: state.choice });
  }

  function warningUrl() {
    return L.whatsappUrl(L.buildWarning(state.result, { t }));
  }

  function updateShare() {
    if (!state.result) return;
    $('warn-family').setAttribute('href', warningUrl());
    $('report-text').textContent = reportText();
  }

  async function copyReport() {
    const text = reportText();
    $('report-text').textContent = text;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      $('report-details').open = true;
      const range = document.createRange();
      range.selectNodeContents($('report-text'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    announce(ok ? t('copied') : t('copy_failed'));
  }

  $('copy-report').addEventListener('click', copyReport);

  $('check-another').addEventListener('click', () => {
    state.result = null;
    state.choice = null;
    state.card = null;
    resultEl.hidden = true;
    resetActionCard();
    setStatus('', false);
    textarea.value = '';
    textarea.focus();
  });

  // ---------------------------------------------------------------- init
  let initial = 'en';
  try { initial = localStorage.getItem('xotorko.lang') || 'en'; } catch (e) { /* storage unavailable */ }
  setLang(initial);
})();
