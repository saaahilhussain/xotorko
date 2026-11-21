const actions = require('../data/actions.json');

// Collect every string in the file (keys excluded, values only) except the
// never_say list itself, which names the forbidden words on purpose.
function strings(value, path = []) {
  if (typeof value === 'string') return [{ path: path.join('.'), value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, [...path, i]));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([k]) => !(path.length === 0 && k === 'never_say'))
      .flatMap(([k, v]) => strings(v, [...path, k]));
  }
  return [];
}

test('no string in data/actions.json (any language) contains "safe"', () => {
  const all = strings(actions);
  expect(all.length).toBeGreaterThan(50);
  // Whole word only: "safety" (112 channel) is fine, "safe"/"unsafe"/"safely" are not.
  const offenders = all.filter((s) => /\b(?:un)?safe(?:ly)?\b/i.test(s.value));
  expect(offenders).toEqual([]);
});

// ---------------------------------------------------------------------------
// Translations (as / hi). Facts must survive translation unchanged.
// ---------------------------------------------------------------------------

const translated = [];
for (const [state, s] of Object.entries(actions.states)) {
  translated.push({ where: `${state}.headline`, t: s.headline });
  s.steps.forEach((step, i) => translated.push({ where: `${state}.steps.${i}`, t: step }));
}

describe('action card translations', () => {
  test('every headline and step has non-empty en, as and hi', () => {
    const missing = translated
      .filter(({ t }) => ['en', 'as', 'hi'].some((l) => typeof t[l] !== 'string' || !t[l].trim()))
      .map(({ where }) => where);
    expect(missing).toEqual([]);
  });

  test('Assamese uses ৰ (U+09F0), never Bengali র (U+09B0)', () => {
    const asStrings = strings(actions).filter((s) => /\.as$/.test(s.path));
    expect(asStrings.length).toBeGreaterThan(30);
    expect(asStrings.filter((s) => s.value.includes('র')).map((s) => s.path)).toEqual([]);
    // ৱ (U+09F1) is used for "w/v" sounds, e.g. ব্যৱহাৰ, পাছৱৰ্ড
    expect(asStrings.some((s) => s.value.includes('ৱ'))).toBe(true);
  });

  test('numbers and domains are identical in every language', () => {
    const facts = (text) => (text.match(/\d{3,}|[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi) || []).sort();
    const bad = [];
    for (const { where, t } of translated) {
      for (const l of ['as', 'hi']) {
        if (JSON.stringify(facts(t[l])) !== JSON.stringify(facts(t.en))) bad.push(`${where}.${l}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test('no translated string uses a word for "safe" (Hindi सुरक्षित, Assamese সুৰক্ষিত / নিৰাপদ)', () => {
    const offenders = strings(actions).filter((s) => /सुरक्षित|সুৰক্ষিত|নিৰাপদ|নিৰাপত্তা/.test(s.value));
    expect(offenders).toEqual([]);
  });
});
