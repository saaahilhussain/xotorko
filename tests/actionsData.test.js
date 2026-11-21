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
