import assert from "node:assert/strict";
import { test } from "node:test";

import { getLanguage, line, lineCount, setLanguage, STRINGS, t } from "../../static/js/i18n.js";

test("every language has exactly the same keys", () => {
  const english = Object.keys(STRINGS.en).sort();
  for (const [code, strings] of Object.entries(STRINGS)) {
    assert.deepEqual(Object.keys(strings).sort(), english, code);
  }
});

test("dialogue lists have the same length in every language", () => {
  for (const [key, value] of Object.entries(STRINGS.en)) {
    if (!Array.isArray(value)) continue;
    for (const [code, strings] of Object.entries(STRINGS)) {
      assert.equal(strings[key].length, value.length, `${code}.${key}`);
      strings[key].forEach((text, i) => assert.ok(text.trim().length > 0, `${code}.${key}[${i}] is empty`));
    }
  }
});

test("placeholders survive translation", () => {
  for (const [key, value] of Object.entries(STRINGS.en)) {
    if (typeof value !== "string") continue;
    const names = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [code, strings] of Object.entries(STRINGS)) {
      assert.deepEqual(names(strings[key]), names(value), `${code}.${key}`);
    }
  }
});

test("switching language changes t() and line()", () => {
  setLanguage("en");
  assert.equal(t("promptGive", { count: 3 }), "Press E to give the gorilla an egg (3 in basket)");
  setLanguage("cs");
  assert.equal(getLanguage(), "cs");
  assert.equal(t("promptGive", { count: 3 }), "Stiskněte E a dejte gorile vejce (v košíku: 3)");
  assert.equal(line("dance", 1), "Vejce, vejce, vejce! Hú hú!");
  assert.equal(lineCount("dance"), 3);
  setLanguage("xx");
  assert.equal(getLanguage(), "cs", "unknown codes are ignored");
  setLanguage("en");
});
