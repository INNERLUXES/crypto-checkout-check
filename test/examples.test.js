import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFICIAL_TOKENS, RULES } from '../src/index.js';
import { BAD, EXPECTED, GOOD, GOOD_EXPECTED, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');
const BAD_FILE = 'examples/bad/checkout.json';
const GOOD_FILE = 'examples/good/checkout.json';

test('examples: the bad configuration fails with the report that is saved in examples/output', async () => {
  const r = await run(BAD);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('bad.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the good configuration passes at error and warning level with the report that is saved', async () => {
  const r = await run(GOOD);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('good.txt'));
  for (const e of GOOD_EXPECTED) assert.ok(r.out.includes(e), e);
  assert.equal((await run([...GOOD, '--fail-on', 'warning'])).code, 0);
  assert.equal((await run([...GOOD, '--fail-on', 'info'])).code, 1);
  assert.doesNotMatch(r.out, /ERROR {4}|WARNING {2}/);
});

test('examples: every output saved in examples/output is the real output, in all four formats for both configurations', async () => {
  const outputs = {
    'bad-explain.txt': [...BAD, '--explain'],
    'bad.md': [...BAD, '--format', 'markdown'],
    'bad-explain.md': [...BAD, '--format', 'markdown', '--explain'],
    'bad.json': [...BAD, '--json', '--explain'],
    'bad.sarif': [...BAD, '--format', 'sarif'],
    'good.md': [...GOOD, '--format', 'markdown'],
    'good.json': [...GOOD, '--json'],
    'good.sarif': [...GOOD, '--format', 'sarif'],
    'checks.txt': ['--list-checks'],
    'checks.json': ['--list-checks', '--format', 'json']
  };
  for (const [name, args] of Object.entries(outputs)) assert.equal((await run(args)).out, await saved(name), name);
});

test('examples: every check but four fires on the bad configuration, each on the line built for it', async () => {
  const report = JSON.parse((await run([...BAD, '--json'])).out);
  const lines = (await readFile(resolve(root, BAD_FILE), 'utf8')).split('\n');
  const at = (needle, n = 1) => {
    let seen = 0;
    for (let i = 0; i < lines.length; i += 1) if (lines[i].includes(needle) && (seen += 1) === n) return i + 1;
    throw new Error(`${needle} x${n}`);
  };
  const of = (id) => report.findings.filter((f) => f.id === id).map((f) => f.line).sort((x, y) => x - y);
  const usdt = at('"name": "USDT"') - 1;
  assert.deepEqual(of('confirmations-below-documented'), [at('"confirmations": 1,')]);
  assert.deepEqual(of('confirmations-below-default'), [at('"confirmations": 3,')]);
  assert.deepEqual(of('paid-before-finality'), [at('"confirmations": 3,')]);
  assert.deepEqual(of('evm-paid-before-finality'), [at('"confirmations": 12,')]);
  assert.deepEqual(of('solana-commitment-processed'), [at('"processed"')]);
  assert.deepEqual(of('solana-commitment-confirmed'), [at('"confirmed"')]);
  assert.deepEqual(of('token-contract-not-official'), [at(`"0x${'1'.repeat(40)}"`)]);
  assert.deepEqual(of('token-decimals-mismatch'), [at('"decimals": 18,', 2)]);
  assert.deepEqual(of('token-contract-malformed'), [at('"0x8335"')]);
  assert.deepEqual(of('token-contract-missing'), [usdt]);
  assert.deepEqual(of('deposit-address-shared'), [at('"shared"')]);
  assert.deepEqual(of('field-missing'), [usdt, at('"webhook"')]);
  assert.deepEqual(of('network-not-in-table'), [at('"litecoin"')]);
  assert.deepEqual(of('asset-duplicate'), [at('"name": "usdc"')]);
  assert.deepEqual(of('field-invalid'), [at('"erc20"')]);
  assert.deepEqual(of('field-unknown'), [at('"Decimals"')]);
  assert.deepEqual(of('invoice-expiry-below-confirmation-time'), [at('"expirySeconds"')]);
  assert.deepEqual(of('rate-lock-exceeds-expiry'), [at('"rateLockSeconds"')]);
  assert.deepEqual(of('payment-tolerance-missing'), [at('"invoice"'), at('"underpaymentTolerance"')]);
  assert.deepEqual(of('webhook-not-https'), [at('"url"')]);
  assert.deepEqual(of('webhook-weak-signature'), [at('"signature"')]);
  assert.deepEqual(of('secret-in-config'), [at('"signingSecret"')]);
  assert.deepEqual(of('webhook-replay-unprotected'), [at('"timestampTolerance"')]);
  assert.deepEqual(of('webhook-idempotency-missing'), [at('"webhook"')]);
  assert.deepEqual(of('webhook-retry-missing'), [at('"maxAttempts"')]);
  assert.deepEqual(of('refund-to-sender'), [at('"destination"')]);
  // One configuration cannot hold a webhook that is both unsigned and weakly signed, refunds both to the sender and to
  // another address, or an invoice both with and without an expiry; the tests of test/rules.test.js cover those.
  assert.deepEqual(report.rules.filter((r) => r.findings === 0).map((r) => r.id), ['config-unreadable', 'invoice-expiry-missing', 'webhook-unsigned', 'refund-address-unreviewed']);
  assert.equal(report.rules.length, RULES.length);
});

test('examples: the good configuration holds one note, and every asset of it is in the table', async () => {
  const report = JSON.parse((await run([...GOOD, '--json'])).out);
  assert.deepEqual(report.findings.map((f) => f.id), ['network-not-in-table']);
  assert.equal(report.table.length, 8);
  assert.deepEqual(report.table.filter((r) => r.asset === 'USDC').map((r) => r.contract), ['official', 'official', 'official', 'official']);
  assert.deepEqual(report.checkout.networks, ['bitcoin', 'ethereum', 'base', 'polygon', 'solana', 'tron', 'litecoin']);
});

test('examples: the same files written with CRLF line ends and as UTF-16 give the same findings', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'crypto-checkout-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    const ids = async () => JSON.parse((await run([...BAD, '--json'], dir)).out).findings.map((f) => `${f.id}:${f.line}:${f.column}`);
    const base = await ids();
    const text = await readFile(resolve(root, BAD_FILE), 'utf8');
    await writeFile(resolve(dir, BAD_FILE), text.split('\n').join('\r\n'));
    assert.deepEqual(await ids(), base);
    await writeFile(resolve(dir, BAD_FILE), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
    assert.deepEqual(await ids(), base);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('examples: the files are plain ASCII with LF line ends, made up, hold no key and no real address but Circle\'s, and no year-like number', async () => {
  const official = OFFICIAL_TOKENS.flatMap((t) => t.addresses.map((a) => a.address));
  for (const f of [BAD_FILE, GOOD_FILE]) {
    const text = await readFile(resolve(root, f), 'utf8');
    assert.ok([...text].every((c) => c.charCodeAt(0) < 128), f);
    assert.ok(!text.includes('\r'), f);
    assert.doesNotMatch(text, /\b(?:19|20)\d{2}\b/, f);
    assert.doesNotThrow(() => JSON.parse(text), f);
    assert.match(text, /"notes": "A made-up configuration for the examples of crypto-checkout-check/, f);
    assert.match(text, /Every address is made up and is not a real contract, except the USDC addresses copied from the saved copy of Circle's page/, f);
    // Every contract of the examples is an official USDC address, one character written many times, or the short one
    // that is a finding.
    for (const m of text.matchAll(/"contract": "([^"]*)"/g)) assert.ok(official.includes(m[1]) || /^(?:0x|T)?(.)\1+$/.test(m[1]) || m[1] === '0x8335', m[0]);
  }
  const outputs = ['bad.txt', 'bad.json', 'bad.md', 'bad.sarif', 'bad-explain.txt', 'bad-explain.md'];
  for (const o of outputs) assert.ok(!(await saved(o)).includes('left-out-on-purpose'), `${o} does not show the inline secret`);
});

test('examples: the sample output of the bad configuration is the one the README shows', async () => {
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const bad = (await saved('bad.txt')).split('\n');
  assert.ok(readme.includes(bad.slice(0, bad.findIndex((l) => l.startsWith('Findings ('))).join('\n')));
  assert.ok(readme.includes(bad.slice(-6).join('\n')));
});
