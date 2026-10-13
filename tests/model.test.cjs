const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
const source = html.match(/<script id="calculator-model">([\s\S]*?)<\/script>/)[1];
const context = {};
runInNewContext(source, context);
const m = context.Altersvorsorge;
const settings = overrides => ({ ...m.DEFAULTS, ...overrides });
const near = (actual, expected, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test("2027 subsidies and additional refund do not double-count tax relief", () => {
  const f = m.funding(150, 42);
  near(f.own, 1800);
  near(f.subsidy, 540);
  near(f.refund, 442.8);
  near(m.funding(30, 0).subsidy, 180);
  near(m.funding(10, 0).subsidy, 60);
  near(m.funding(0, 0).subsidy, 0);
  near(m.funding(500, 42).extra, 4200);
  near(m.funding(150, 0).refund, 0);
});

test("official 2026 income tax boundaries and Polish bands", () => {
  near(m.germanPIT(12348), 0);
  near(m.germanPIT(20000), 1570);
  near(m.germanPIT(100000), 30864);
  near(m.polishTax(30000), 0);
  near(m.polishTax(120000), 10800);
  near(m.polishTax(150000), 20400);
  near(m.polishTax(300000, 2), 40800);
  near(m.germanTax(200000, 2), m.germanTax(100000) * 2);
});

test("pension taxation is incremental and taxes principal, not just profits", () => {
  const p = settings({ inflation: 0, plOther: 60000, plMode: "scale" });
  near(m.pensionTax(1000, "PL", p, 0), 120);
  near(m.pensionTax(1000, "PL", settings({ ...p, plMode: "custom", plCustom: 32 }), 0), 320);
  near(m.pensionTax(0, "DE", p, 0), 0);
  assert.ok(m.pensionTax(10000, "DE", p, 0) > 0);
});

test("FIFO sale, partial exemption, no German basis step-up on move", () => {
  const a = m.account(), p = settings({ allowance: 0, workTax: 42 });
  m.deposit(a, 1000);
  m.grow(a, 2);
  m.deposit(a, 1000);
  m.beginYear(a, "DE", p, 0);
  const sale = m.sellGross(a, 1000);
  near(sale.tax, 500 * .7 * .26375);
  near(a.lots[0].basis, 500);
  m.beginYear(a, "PL", p, 1);
  near(m.sellGross(a, 1000).tax, 500 * .19);
});

test("unused allowance and low-income capital Günstigerprüfung", () => {
  const a = m.account();
  m.deposit(a, 1000);
  m.grow(a, 2);
  m.beginYear(a, "DE", settings({ allowance: 1000 }), 0);
  near(m.sellGross(a, 2000).tax, 0);
  const b = m.account();
  m.deposit(b, 1000);
  m.grow(b, 2);
  m.beginYear(b, "DE", settings({ allowance: 0 }), 0, 0);
  near(m.sellGross(b, 2000).tax, 0);
});

test("advance credit reduces future DE gain, not Polish gain", () => {
  const a = m.account(), p = settings({ allowance: 1000 });
  m.deposit(a, 1000);
  m.beginYear(a, "DE", p, 0);
  m.grow(a, 1.1);
  near(m.advanceTax(a, 2), 0);
  near(a.lots[0].credit, 14);
  m.beginYear(a, "DE", settings({ allowance: 0 }), 1);
  near(m.sellGross(a, 1100).tax, (100 - 14) * .7 * .26375);
  const b = m.account();
  m.deposit(b, 1000);
  b.lots[0].credit = 14;
  m.grow(b, 1.1);
  m.beginYear(b, "PL", p, 1);
  near(m.sellGross(b, 1100).tax, 19);
});

test("net sales fund taxes without adding outside money", () => {
  const a = m.account();
  m.deposit(a, 1000);
  m.grow(a, 2);
  m.beginYear(a, "PL", settings(), 0);
  const sale = m.sellNet(a, 100);
  near(sale.net, 100);
  near(m.balance(a), 2000 - sale.gross);
  assert.ok(sale.gross > 100);
});

test("zero return and zero costs conserve principal and support through payouts", () => {
  const p = settings({ startAge: 64, moveAge: 65, retireAge: 65, returnRate: 0, retirementReturn: 0, avFee: 0, etfFee: 0, workTax: 0, baseRate: 0, inflation: 0, plMode: "custom", plCustom: 0, deOther: 0, lump: 30 });
  const av = m.run(p, "av", true), etf = m.run(p, "etf", true);
  near(av.retirement.av, 2340);
  near(av.netTotal, 2340);
  near(etf.netTotal, 1800);
  near(av.first.lumpNet, 702);
  near(av.snapshots.find(s => s.age === 85).gross, 0);
  near(av.snapshots.find(s => s.age === 85).supportRemaining, 0);
});

test("moving at 50 stops support and redirects equal contributions to ETF", () => {
  const p = settings({ returnRate: 0, retirementReturn: 0, avFee: 0, etfFee: 0, baseRate: 0, inflation: 0 });
  const r = m.run(p, "av", true);
  near(r.subsidyTotal, 540 * 15);
  near(r.refundTotal, 442.8 * 15);
  near(r.retirement.av, 2340 * 15);
  near(r.retirement.etf, 442.8 * 15 + 1800 * 17);
  near(r.ownTotal, 1800 * 32);
  near(r.snapshots.find(s => s.age === 50).supportRemaining, (540 + 442.8) * 15);
});

test("immediate emigration makes both strategies identical", () => {
  const p = settings({ moveAge: 35 });
  const av = m.run(p, "av", true), etf = m.run(p, "etf", true);
  near(av.retirement.gross, etf.retirement.gross);
  near(av.netTotal, etf.netTotal);
  near(av.subsidyTotal, 0);
});

test("exit-tax screening uses acquisition cost rather than market value", () => {
  const r = m.run(settings({ startAge: 18, moveAge: 70, retireAge: 70, monthly: 500, returnRate: 10 }), "etf", true);
  assert.ok(r.moveValue > 500000);
  assert.ok(r.moveBasis < 500000);
});

test("inheritance deducts remaining support, not all lifetime payouts", () => {
  const r = m.run(settings(), "av", false);
  const before = r.snapshots.find(s => s.age === 67), after = r.snapshots.find(s => s.age === 80);
  near(before.child, before.gross - before.supportRemaining);
  assert.ok(after.supportRemaining < before.supportRemaining);
  near(after.child, after.gross - after.supportRemaining);
  near(r.snapshots.find(s => s.age === 85).child, 0);
});

test("inheritance loss scenario does not hide a support repayment shortfall", () => {
  const r = m.run(settings({ startAge: 18, moveAge: 67, returnRate: -2, avFee: 2, etfFee: 1, workTax: 0, deathAge: 67 }), "av", false);
  for (const s of r.snapshots) {
    near(s.child - s.shortfall, s.gross - s.supportRemaining);
  }
});

test("all permitted extreme scenarios are finite and exhaust at end age", () => {
  for (const overrides of [
    {}, { returnRate: -2, retirementReturn: -2, avFee: 2, etfFee: 1 },
    { startAge: 18, moveAge: 70, retireAge: 70, endAge: 100, deathAge: 100, returnRate: 10, monthly: 500 },
    { startAge: 64, moveAge: 64, retireAge: 65, lump: 30, inflation: 5, indexTax: false },
    { monthly: 0 }, { plMode: "custom", plCustom: 45, lump: 30 }
  ]) {
    const p = settings(overrides);
    for (const r of m.simulate(p)) {
      for (const y of r.years) for (const key of ["tax", "net", "gross", "regularNet"]) assert.ok(Number.isFinite(y[key]), key);
      for (const s of r.snapshots) assert.ok(s.gross >= -0.01);
      near(r.snapshots.find(s => s.age === p.endAge).gross, 0, .1);
    }
  }
});

test("lump plus regular pension is taxed together in the first payout year", () => {
  const p = settings({ lump: 30 });
  for (const r of m.simulate(p)) near(r.first.avTax, m.pensionTax(r.first.avGross, r.country, p, p.retireAge - p.startAge));
});

test("invalid parameters fail explicitly", () => {
  assert.throws(() => m.simulate(settings({ monthly: NaN })), /Nieprawidłowa/);
  assert.throws(() => m.simulate(settings({ moveAge: 20 })), /Przeprowadzka/);
  assert.throws(() => m.simulate(settings({ retireAge: 62 })), /Nieprawidłowa/);
});

test("page is self-contained, has four-scenario UI and no remote executable assets", () => {
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel=["']stylesheet/i);
  for (const id of ["metrics", "comparison", "inheritance", "wealth-chart", "income-chart", "export", "error"]) assert.ok(html.includes(`id="${id}"`));
  assert.match(html, /clawpilotTheme/);
  assert.match(html, /by <a href="https:\/\/github.com\/kamil-gwozdz"/);
});
