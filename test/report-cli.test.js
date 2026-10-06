import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIGURABLE, MAX_MIN_CONFIRMATIONS, RULES, USAGE, VERSION, buildReport, checkText, decide, parseArgs, toSarif } from '../src/index.js';
import { ASSETS, BAD, GOOD, asset, cli, config, configText, run, usdc, webhook } from './helpers.js';

const FILES = { 'good.json': GOOD, 'bad.json': BAD };
const ch = (...codes) => String.fromCharCode(...codes);
const LTC = asset({ name: 'LTC', network: 'litecoin', decimals: 8, commitment: undefined, confirmations: 6, maxAmount: 1000 });
// A configuration with an error, a warning and a note: USDC with 18 decimals, ETH of high value paid after 64
// confirmations, and a network out of the table.
const MIXED = configText(config({}, [ASSETS[0], usdc('ethereum', { decimals: 18 }), asset({ commitment: undefined, confirmations: 64, maxAmount: 5000 }), LTC]));
const NOTE = configText(config({}, [...ASSETS, LTC]));

test('exit codes: 0 for a pass, 1 for a finding at or above the fail-on level, 2 for a usage or input error', async () => {
  assert.equal((await run(FILES, ['good.json'])).code, 0);
  assert.equal((await run(FILES, ['bad.json'])).code, 1);
  assert.equal((await run(FILES, ['nothing.json'])).code, 2);
  assert.equal((await run(FILES, [])).code, 2);
  assert.equal((await run(FILES, ['good.json', 'bad.json'])).code, 2);
  assert.equal((await run(FILES, ['bad.json', '--bogus'])).code, 2);
});

test('--fail-on: a note fails the run at info and passes at warning and error', async () => {
  const note = { 'n.json': NOTE };
  assert.equal((await run(note, ['n.json'])).code, 0);
  assert.equal((await run(note, ['n.json', '--fail-on', 'warning'])).code, 0);
  assert.equal((await run(note, ['n.json', '--fail-on', 'info'])).code, 1);
  assert.equal((await run(FILES, ['good.json', '--fail-on', 'info'])).code, 0, 'the good configuration has no finding at any level');
});

test('--min-severity hides findings below it and says how many, and a hidden finding still counts for the result', async () => {
  const r = await run({ 'm.json': MIXED }, ['m.json', '--min-severity', 'error']);
  assert.match(r.out, /findings: 1 \(1 error\); 2 below error not shown\n/);
  const info = await run({ 'n.json': NOTE }, ['n.json', '--min-severity', 'warning', '--fail-on', 'info']);
  assert.match(info.out, /findings: 0; 1 below warning not shown/);
  assert.equal(info.code, 1);
});

test('--large-payment: moves the limit of a payment of high value, is kept in the report and takes a plain decimal', async () => {
  const m = { 'm.json': MIXED };
  assert.equal((await run(m, ['m.json', '--fail-on', 'warning', '--min-severity', 'warning', '--json'])).code, 1);
  const wide = JSON.parse((await run(m, ['m.json', '--large-payment', '5000', '--json'])).out);
  assert.ok(!wide.findings.some((f) => f.id === 'paid-before-finality'));
  assert.equal(wide.config.largePayment, '5000');
  assert.equal(JSON.parse((await run(m, ['m.json', '--json'])).out).config.largePayment, '1000');
  for (const bad of ['-1', '1e3', '1,000', 'ten', '01', '']) assert.equal((await cli(['a.json', '--large-payment', bad], process.cwd())).code, 2, bad);
  assert.equal(parseArgs(['a', '--large-payment', '2500.50']).largePayment, '2500.50');
  assert.throws(() => parseArgs(['a', '--large-payment', '5', '--large-payment', '6']), /given twice/);
});

test('--min-confirmations: sets the threshold of a network whose number is the tool\'s own, once a network, and refuses the rest', async () => {
  const c = { 'p.json': configText(config({}, [...ASSETS, asset({ name: 'P', network: 'polygon', commitment: undefined, confirmations: 64, maxAmount: 10 })])) };
  assert.equal((await run(c, ['p.json', '--fail-on', 'warning'])).code, 0);
  const strict = await run(c, ['p.json', '--fail-on', 'warning', '--min-confirmations', 'matic=128', '--json']);
  assert.equal(strict.code, 1);
  assert.deepEqual(JSON.parse(strict.out).config.minConfirmations, { polygon: 128 });
  assert.match(JSON.parse(strict.out).findings[0].message, /fewer than the 128 set with --min-confirmations/);
  assert.deepEqual(parseArgs(['a', '--min-confirmations', 'polygon=1', '--min-confirmations', 'tron=30']).minConfirmations, [['polygon', 1], ['tron', 30]]);
  assert.throws(() => parseArgs(['a', '--min-confirmations', 'polygon=1', '--min-confirmations', 'matic=2']), /given twice for polygon/);
  assert.throws(() => parseArgs(['a', '--min-confirmations', 'bitcoin=3']), /come from the Bitcoin developer guide/);
  assert.throws(() => parseArgs(['a', '--min-confirmations', 'solana=3']), /paid at a commitment level/);
  assert.throws(() => parseArgs(['a', '--min-confirmations', 'litecoin=3']), /not in the table/);
  for (const bad of ['polygon', 'polygon=', 'polygon=-1', 'polygon=1.5', `polygon=${MAX_MIN_CONFIRMATIONS + 1}`, '=3', 'polygon=03']) assert.throws(() => parseArgs(['a', '--min-confirmations', bad]), /takes <network>=<count>/, bad);
  assert.deepEqual(CONFIGURABLE, ['ethereum', 'polygon', 'arbitrum', 'base', 'tron']);
});

test('the text report names the file, the checkout, the checks table, each finding with its line and fix, the assets, and ends with the notice and the result', async () => {
  const r = await run(FILES, ['bad.json']);
  assert.match(r.out, /^crypto-checkout-check: bad\.json\n/);
  assert.match(r.out, /\nfile: \d+ lines, [\d,]+ bytes\n/);
  assert.match(r.out, /\ncheckout: Test Store; 4 assets on 3 networks \(bitcoin, ethereum and solana\); invoices expire after 900 seconds \(15 minutes\); webhook https, signed with hmac-sha256\n/);
  assert.match(r.out, /\nfindings: 1 \(1 error\)\n/);
  assert.match(r.out, /ERROR {4}token-decimals-mismatch {17}bad\.json:\d+\n/);
  assert.match(r.out, /fix: Set the decimals of USDC to 6\./);
  assert.match(r.out, /\nChecks \(30\)\n/);
  assert.ok(r.out.includes(['Assets (4)', '', '  asset  network   kind    dec  paid at    to paid                 max amount  deposit                contract', '  BTC    bitcoin   native  8    6 conf     3,600 seconds (1 hour)  25000       per-invoice            -', '  ETH    ethereum  native  18   finalized  768 seconds             25000       per-invoice            -'].join('\n')));
  assert.match(r.out, /counted twice\.\n\nRESULT: FAIL - 1 finding at or above error/);
  assert.ok(r.out.endsWith('\n'));
  assert.match((await run(FILES, ['good.json'])).out, /Findings \(0\)\n\n {2}none\n/);
});

test('the checkout line says when no expiry, webhook or name was read', async () => {
  const r = await run({ 'p.json': configText(config({ checkout: undefined, invoice: undefined, webhook: undefined })) }, ['p.json']);
  assert.match(r.out, /\ncheckout: a checkout with no name; 4 assets on 3 networks \(bitcoin, ethereum and solana\); no invoice expiry read; no webhook read\n/);
  const nourl = await run({ 'p.json': configText(config({ webhook: webhook({ url: undefined, signature: undefined }) })) }, ['p.json']);
  assert.match(nourl.out, /webhook with no URL read, signed with nothing\n/);
});

test('--explain adds the points of the pages to the text report, and the own choice of a best practice', async () => {
  const r = await run(FILES, ['bad.json', '--explain']);
  assert.match(r.out, /basis: The Circle quickstart for Solana says USDC carries 6 decimals.*\(Circle: Quickstart: Transfer USDC on Solana, https:\/\/developers\.circle\.com\/stablecoins\/quickstart-transfer-10-usdc-on-solana\)/);
  assert.doesNotMatch((await run(FILES, ['bad.json'])).out, /basis:/);
  const note = await run({ 'n.json': NOTE }, ['n.json', '--explain']);
  assert.match(note.out, /the tool's own choice: keeping a short table of networks is a best practice of this tool/);
});

test('the JSON report has the id, severity, message, file, line, column and entry of every finding, and the table of assets', async () => {
  const report = JSON.parse((await run(FILES, ['bad.json', '--json'])).out);
  assert.equal(report.tool, 'crypto-checkout-check');
  assert.equal(report.version, VERSION);
  assert.equal(report.input.file, 'bad.json');
  assert.deepEqual(report.checkout, { name: 'Test Store', currency: 'USD', assets: 4, networks: ['bitcoin', 'ethereum', 'solana'], expiry: '900 seconds (15 minutes)', webhook: { scheme: 'https', signature: 'hmac-sha256' } });
  const f = report.findings[0];
  assert.equal(f.id, 'token-decimals-mismatch');
  assert.equal(f.severity, 'error');
  assert.equal(f.file, 'bad.json');
  assert.equal(f.at, `bad.json:${f.line}`);
  assert.equal(typeof f.column, 'number');
  assert.equal(f.entry, 'USDC on ethereum');
  assert.equal(f.basis, undefined, 'the basis only with --explain');
  assert.ok(JSON.parse((await run(FILES, ['bad.json', '--json', '--explain'])).out).findings[0].basis.length > 0);
  assert.equal(report.result.pass, false);
  assert.equal(report.rules.length, RULES.length);
  assert.deepEqual(report.table[3], { asset: 'USDC', network: 'solana', kind: 'token', decimals: 6, paidAt: 'finalized', toPaid: '12.8 seconds', maxAmount: '25000', deposit: 'shared, reference-key', contract: 'official' });
  assert.deepEqual(report.config, { minSeverity: 'info', failOn: 'error', largePayment: '1000', minConfirmations: {} });
});

test('--json and --format json are the same, and --json with another format is a usage error', async () => {
  assert.equal((await run(FILES, ['good.json', '--json'])).out, (await run(FILES, ['good.json', '--format', 'json'])).out);
  const r = await run(FILES, ['good.json', '--json', '--format', 'text']);
  assert.equal(r.code, 2);
  assert.match(r.err, /two formats/);
});

test('the markdown report has a findings table and the table of assets, and escapes what markdown gives a meaning to', async () => {
  const r = await run(FILES, ['bad.json', '--format', 'markdown']);
  assert.match(r.out, /^# crypto-checkout-check: bad\.json\n/);
  assert.match(r.out, /\| Level \| Check \| Where \| Message \|/);
  assert.match(r.out, /\| error \| token-decimals-mismatch \| bad\.json:\d+ \|/);
  assert.match(r.out, /- Result: \*\*FAIL - 1 finding at or above error/);
  assert.match(r.out, /\| Asset \| Network \| Kind \| Decimals \| Paid at \| Time to paid \| Max amount \| Deposit \| Contract \|\n\| --- \| --- \| --- \| ---: \| --- \| ---: \| ---: \| --- \| --- \|\n\| BTC \| bitcoin \| native \| 8 \| 6 conf \| 3,600 seconds \\\(1 hour\\\) \| 25000 \| per-invoice \| - \|/);
  assert.match((await run(FILES, ['good.json', '--format', 'markdown'])).out, /## Findings\n\nNone\./);
  const hostile = { 'p.json': configText(config({}, [ASSETS[0], asset({ name: '[x](http://a.test)|<b>', depositAddress: 'shared' })])) };
  const out = (await run(hostile, ['p.json', '--format', 'markdown', '--explain'])).out;
  assert.ok(!out.includes('[x](http'), 'a link written in an asset name is escaped');
  assert.ok(out.includes('\\[x\\]\\(http'));
  assert.match(out, /## Basis\n\n### deposit-address-shared\n\n- In the payment request the guide walks through/);
  const input = (await run({ 'p.json': configText(config({ zz: 1 })) }, ['p.json', '--format', 'markdown', '--explain'])).out;
  assert.match(input, /### field-unknown\n\n- A problem with the configuration file itself; it rests on no page\./);
  const own = (await run({ 'n.json': NOTE }, ['n.json', '--format', 'markdown', '--explain'])).out;
  assert.match(own, /### network-not-in-table\n\n- The tool's own choice: keeping a short table of networks/);
});

test('the SARIF report is SARIF 2.1.0 with the checks as rules, the configuration as the artifact, and a result for every finding', async () => {
  const sarif = JSON.parse((await run(FILES, ['bad.json', '--format', 'sarif'])).out);
  assert.equal(sarif.version, '2.1.0');
  assert.match(sarif.$schema, /sarif-2\.1\.0/);
  const run0 = sarif.runs[0];
  assert.equal(run0.tool.driver.name, 'crypto-checkout-check');
  assert.equal(run0.tool.driver.rules.length, RULES.length);
  assert.deepEqual(run0.artifacts.map((a) => a.location.uri), ['bad.json']);
  const p = run0.results.find((x) => x.ruleId === 'token-decimals-mismatch');
  assert.equal(p.level, 'error');
  assert.equal(run0.tool.driver.rules[p.ruleIndex].id, 'token-decimals-mismatch');
  const loc = p.locations[0].physicalLocation;
  assert.equal(loc.artifactLocation.uri, 'bad.json');
  assert.equal(loc.artifactLocation.index, 0);
  assert.ok(loc.region.startLine >= 1 && loc.region.startColumn >= 1);
  assert.equal(p.properties.entry, 'USDC on ethereum');
  assert.equal(run0.properties.sources.length, 8);
});

test('SARIF levels: error, warning and info are error, warning and note', async () => {
  const sarif = JSON.parse((await run({ 'm.json': MIXED }, ['m.json', '--format', 'sarif'])).out);
  const levels = Object.fromEntries(sarif.runs[0].results.map((x) => [x.ruleId, x.level]));
  assert.equal(levels['token-decimals-mismatch'], 'error');
  assert.equal(levels['paid-before-finality'], 'warning');
  assert.equal(levels['network-not-in-table'], 'note');
});

test('--explain has no place in the SARIF report and is a usage error there', async () => {
  const r = await run(FILES, ['good.json', '--format', 'sarif', '--explain']);
  assert.equal(r.code, 2);
  assert.match(r.err, /sarif format has no place/);
});

test('--list-checks lists every check with its level and kind, in text, markdown and JSON, and needs no file', async () => {
  const text = await cli(['--list-checks'], process.cwd());
  assert.equal(text.code, 0);
  for (const r of RULES) assert.ok(text.out.includes(r.id), r.id);
  assert.match(text.out, /deposit-address-shared +error +best practice/);
  assert.match(text.out, /webhook-unsigned +error +documented/);
  const md = await cli(['--list-checks', '--format', 'markdown'], process.cwd());
  assert.match(md.out, /\| token-decimals-mismatch \| error \| documented \|/);
  const json = JSON.parse((await cli(['--list-checks', '--json'], process.cwd())).out);
  assert.equal(json.length, RULES.length);
  assert.equal((await cli(['--list-checks', '--format', 'sarif'], process.cwd())).code, 2);
});

test('--help, --version and usage errors', async () => {
  const help = await cli(['--help'], process.cwd());
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  for (const option of ['--format', '--json', '--min-severity', '--fail-on', '--large-payment', '--min-confirmations', '--explain', '--list-checks', '--help', '--version']) assert.ok(USAGE.includes(option), option);
  assert.equal((await cli(['--version'], process.cwd())).out, `${VERSION}\n`);
  const bad = [['a', 'b'], ['--format'], ['--format', 'xml', 'a'], ['--fail-on', 'high', 'a'], ['--min-severity', 'low', 'a'], ['a', '--fail-on', 'error', '--fail-on', 'info'], ['https://example.test/checkout.json'], ['-'], ['a', '--format', '-'], ['a', '--large-payment']];
  for (const b of bad) {
    const r = await cli(b, process.cwd());
    assert.equal(r.code, 2, b.join(' '));
    assert.match(r.err, /^crypto-checkout-check: /);
  }
});

test('parseArgs: values may not look like flags, a flag given twice is an error, and -h and -v are short forms', () => {
  assert.throws(() => parseArgs(['a', '--format', '--json']), /needs a value/);
  assert.throws(() => parseArgs(['a', '--format', 'json', '--format', 'text']), /given twice/);
  assert.throws(() => parseArgs(['a', '--format', '-']), /standard input/);
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['-v']).version, true);
  assert.equal(parseArgs(['a']).format, 'text');
  assert.equal(parseArgs(['a']).largePayment, null);
  assert.deepEqual(parseArgs(['a']).minConfirmations, []);
});

test('decide: pass and fail texts, with the counts', () => {
  assert.equal(decide({ error: 0, warning: 0, info: 0 }, 'error').text, 'PASS - no finding at or above error');
  assert.equal(decide({ error: 0, warning: 2, info: 1 }, 'error').text, 'PASS - no finding at or above error (2 warning, 1 info)');
  assert.equal(decide({ error: 1, warning: 2, info: 1 }, 'error').text, 'FAIL - 1 finding at or above error (1 error, 2 warning, 1 info)');
  assert.equal(decide({ error: 1, warning: 2, info: 1 }, 'warning').text, 'FAIL - 3 findings at or above warning (1 error, 2 warning, 1 info)');
});

test('text from the file is cleaned: control characters, escapes and direction controls in a checkout, an asset, a network and a contract', async () => {
  const dirty = (s) => `${s}${ch(0x1b)}[31m${ch(0x202e)}${ch(0x2028)}x${ch(0x07)}`;
  const c = config({ checkout: dirty('p'), currency: dirty('USD') }, [usdc('ethereum', { name: dirty('n'), contract: dirty('0x1') }), asset({ name: 'B', network: dirty('chain'), kind: dirty('k') }), usdc('base', { name: 'C', contract: dirty('0x2') })]);
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const r = await run({ 'p.json': configText(c) }, ['p.json', '--format', format]);
    assert.ok(r.out.length > 100, format);
    assert.ok(![...r.out].some((x) => [0x1b, 0x07, 0x202e, 0x2028].includes(x.charCodeAt(0))), format);
  }
});

test('the same findings are written for LF, CRLF and CR line ends, and for UTF-16', async () => {
  const at = async (text) => JSON.parse((await run({ 'p.json': text }, ['p.json', '--json'])).out).findings.map((f) => `${f.id}:${f.line}:${f.column}`);
  const base = await at(MIXED);
  assert.equal(base.length, 3);
  for (const sep of ['\r\n', '\r']) assert.deepEqual(await at(MIXED.split('\n').join(sep)), base);
  assert.deepEqual(await at(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(MIXED, 'utf16le')])), base);
});

test('toSarif is deterministic and the report object is the same for the same input', async () => {
  const a = (await run(FILES, ['bad.json', '--format', 'sarif'])).out;
  const b = (await run(FILES, ['bad.json', '--format', 'sarif'])).out;
  assert.equal(a, b);
  assert.equal(typeof toSarif, 'function');
  const r1 = buildReport({ file: { file: 'c.json', bytes: 1, lines: 1 }, checked: checkText(BAD), version: '0' });
  const r2 = buildReport({ file: { file: 'c.json', bytes: 1, lines: 1 }, checked: checkText(BAD), version: '0' });
  assert.deepEqual(r1, r2);
});

test('a file that is JSON but no configuration gives a report with no checkout and no table', async () => {
  const r = await run({ 'p.json': '[]\n' }, ['p.json']);
  assert.equal(r.code, 1);
  assert.match(r.out, /\ncheckout: no configuration was read\n/);
  assert.doesNotMatch(r.out, /Assets \(/);
  assert.match(r.out, /note: the configuration was not checked, because the file holds no configuration object/);
  const json = JSON.parse((await run({ 'p.json': '[]\n' }, ['p.json', '--json'])).out);
  assert.equal(json.checkout, null);
  assert.equal(json.table, null);
  const notJson = await run({ 'p.json': '{"checkout": 1,,}' }, ['p.json']);
  assert.match(notJson.out, /note: the configuration was not checked, because the file is not JSON the reader can follow/);
});
