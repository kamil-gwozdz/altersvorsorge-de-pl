const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");

function render(overrides = {}) {
  const elements = new Map(Array.from(html.matchAll(/\bid="([^"]+)"/g), match => [
    match[1], { innerHTML: "", textContent: "", hidden: false, addEventListener() {} }
  ]));
  const document = {
    getElementById: id => {
      assert.ok(elements.has(id), `Missing element: ${id}`);
      return elements.get(id);
    },
    querySelector: () => null
  };
  const context = { document, console };
  runInNewContext(html.match(/<script id="calculator-model">([\s\S]*?)<\/script>/)[1], context);
  const settings = { ...context.Altersvorsorge.DEFAULTS, ...overrides };
  for (const [key, value] of Object.entries(settings)) {
    const element = elements.get(key);
    if (typeof value === "boolean") element.checked = value; else element.value = String(value);
  }
  runInNewContext(html.match(/<script id="calculator-ui">([\s\S]*?)<\/script>/)[1], context);
  assert.equal(elements.get("error").hidden, true, elements.get("error").textContent);
  return { elements, settings, results: context.Altersvorsorge.simulate(settings) };
}

test("every numeric table associates amounts with row and column headers", () => {
  const { elements } = render();
  for (const id of ["comparison", "wealth-yearly", "yearly", "inheritance"]) {
    const table = elements.get(id).innerHTML;
    const header = table.match(/<thead>([\s\S]*?)<\/thead>/)[1];
    assert.equal((header.match(/<th scope="col">/g) || []).length, 5, id);
    const body = table.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
    for (const row of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      assert.match(row[1], /^<th scope="row">/, id);
      assert.equal((row[1].match(/<td>/g) || []).length, 4, id);
    }
  }
});

test("capital table exposes every chart point in nominal and real euros", () => {
  const formatter = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  for (const overrides of [{}, { real: true }, { startAge: 64, moveAge: 65, retireAge: 65, endAge: 100 }]) {
    const { elements, settings, results } = render(overrides);
    const table = elements.get("wealth-yearly").innerHTML;
    const body = table.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
    const rows = Array.from(body.matchAll(/<tr>([\s\S]*?)<\/tr>/g));
    assert.equal(rows.length, settings.endAge - settings.startAge + 1);
    for (let i = 0; i < rows.length; i++) {
      const age = settings.startAge + i;
      assert.ok(rows[i][1].includes(`${age} · ${2027 + i}`));
      const cells = Array.from(rows[i][1].matchAll(/<td>(.*?)<\/td>/g), match => match[1]);
      results.forEach((r, scenario) => {
        const factor = settings.real ? (1 + settings.inflation / 100) ** i : 1;
        assert.equal(cells[scenario], formatter.format(r.snapshots[i].gross / factor));
      });
    }
  }
});

test("capital chart identifies its adjacent text alternative", () => {
  assert.match(html, /id="wealth-chart"[^>]*aria-describedby="wealth-description"/);
  assert.match(html, /id="wealth-description"[^>]*>[^<]*Kapitał rok po roku/);
  assert.match(html, /<summary>Kapitał rok po roku<\/summary>[\s\S]*?<table id="wealth-yearly">/);
});
