const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../auth/theme.js"), "utf8");

function run(search = "", saved, failure) {
  const attributes = new Map();
  const values = new Map(saved ? [["aiman.auth.theme", saved]] : []);
  const warnings = [];
  vm.runInNewContext(source, {
    URLSearchParams,
    DOMException,
    window: {
      location: { search },
      sessionStorage: {
        getItem(key) {
          if (failure) throw failure;
          return values.get(key) ?? null;
        },
        setItem(key, value) {
          if (failure) throw failure;
          values.set(key, value);
        },
      },
    },
    document: {
      documentElement: { setAttribute: (name, value) => attributes.set(name, value) },
    },
    console: { warn: message => warnings.push(message) },
  });
  assert.deepEqual([...attributes.keys()], attributes.size ? ["data-aiman-theme"] : []);
  return { theme: attributes.get("data-aiman-theme"), values, warnings };
}

for (const theme of ["light", "dark"]) {
  test(`only the ${theme} appearance hint is persisted`, () => {
    const result = run(`?aiman_theme=${theme}&code=never-store&state=never-store`);
    assert.equal(result.theme, theme);
    assert.deepEqual([...result.values], [["aiman.auth.theme", theme]]);
  });
}

test("unhinted direct visits leave system appearance to CSS without persisting it", () => {
  const result = run();
  assert.equal(result.theme, undefined);
  assert.equal(result.values.size, 0);
});

test("subsequent sign-up, verification and recovery pages use the tab preference", () => {
  assert.equal(run("?tx=opaque-platform-state", "light").theme, "light");
});

test("a new explicit choice supersedes the previous tab preference", () => {
  assert.equal(run("?aiman_theme=dark", "light").theme, "dark");
});

for (const query of [
  "?aiman_theme=system",
  "?aiman_theme=LIGHT",
  "?aiman_theme=light&aiman_theme=dark",
  "?aiman_theme=%3Cscript%3E",
  "?aiman_theme=https%3A%2F%2Fexample.com",
]) {
  test(`invalid appearance hint is ignored: ${query}`, () => {
    const result = run(query);
    assert.equal(result.theme, undefined);
    assert.equal(result.values.size, 0);
    assert.equal(result.warnings.length, 1);
  });
}

test("malformed saved data cannot become a DOM attribute value", () => {
  assert.equal(run("", "<style>").theme, undefined);
});

for (const name of ["SecurityError", "QuotaExceededError"]) {
  test(`${name} does not prevent applying an explicit theme`, () => {
    const result = run("?aiman_theme=light", undefined, new DOMException("Blocked", name));
    assert.equal(result.theme, "light");
    assert.equal(result.warnings.length, 1);
  });
}

test("blocked tab storage without a hint leaves system appearance to CSS", () => {
  assert.equal(run("", undefined, new DOMException("Blocked", "SecurityError")).theme, undefined);
});

test("unexpected script errors are not silently swallowed", () => {
  assert.throws(() => run("", undefined, new Error("Unexpected")), /Unexpected/);
});
