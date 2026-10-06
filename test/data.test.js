import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEST, NETWORKS, OFFICIAL_TOKENS, POINTS, RULES, SOURCES, flat, grouped, listText, plural, pointPage, safeText, source } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (rel) => readFile(resolve(root, rel), 'utf8');
const norm = (t) => t.replace(/\s+/g, ' ');

const PLACES = /^https:\/\/(?:developer\.bitcoin\.org\/devguide\/payment_processing\.html|ethereum\.org\/en\/developers\/docs\/consensus-mechanisms\/pos\/|solana\.com\/(?:docs\/rpc|developers\/guides\/advanced\/confirmation)|developers\.circle\.com\/stablecoins\/[a-z0-9-]+|docs\.stripe\.com\/webhooks|docs\.github\.com\/en\/webhooks\/using-webhooks\/validating-webhook-deliveries)$/;

test('every source has an official address, and no number that reads like a year', () => {
  for (const s of SOURCES) {
    assert.match(s.url, PLACES, s.id);
    assert.doesNotMatch(s.url, /(?<!(?:EIP|ERC)[- ]?)\b(?:19|20)\d{2}\b/i, s.id);
    assert.ok(s.title.length > 5);
  }
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  assert.deepEqual(SOURCES.map((s) => s.id), ['bitcoin-payments', 'ethereum-pos', 'solana-rpc', 'solana-confirmation', 'circle-addresses', 'circle-solana', 'stripe-webhooks', 'github-webhooks']);
});

test('every source has a text copy under research/sources that starts with its address, and research/sources.md lists it', async () => {
  const notes = await read('research/sources.md');
  for (const s of SOURCES) {
    const copy = await read(s.file);
    assert.ok(copy.startsWith(`Source: ${s.url}\n`), s.file);
    assert.ok(copy.length > 1500, `${s.file} holds the page`);
    assert.ok(notes.includes(s.url), `research/sources.md lists ${s.id}`);
    assert.ok(notes.includes(s.file), `research/sources.md names ${s.file}`);
  }
});

test('every point belongs to a listed source, is written in a sentence of its own and is not a long quotation of its page', async () => {
  for (const [id, p] of Object.entries(POINTS)) {
    const page = source(p.source);
    assert.ok(page, `${id}: the source ${p.source}`);
    assert.equal(pointPage(id), page);
    assert.ok(p.text.length > 40 && p.text.length < 400, id);
    assert.match(p.text, /\.$/, id);
    const copy = norm(await read(page.file));
    // No run of 12 words of the point appears word for word in its page.
    const words = norm(p.text).split(' ');
    for (let i = 0; i + 12 <= words.length; i += 1) assert.ok(!copy.includes(words.slice(i, i + 12).join(' ')), `${id} quotes its page`);
  }
});

test('every point is used by a rule, and every basis of a rule is a point', () => {
  const used = new Set(RULES.flatMap((r) => r.basis));
  for (const id of Object.keys(POINTS)) assert.ok(used.has(id), `${id} is not used by a rule`);
  for (const id of used) assert.ok(Object.hasOwn(POINTS, id), `${id} is not a point`);
});

test('docs/rules-and-sources.md lists every page with its copy and every check with its level, kind and points', async () => {
  const doc = await read('docs/rules-and-sources.md');
  for (const s of SOURCES) assert.ok(doc.includes(s.url) && doc.includes(s.file), s.id);
  for (const r of RULES) {
    const section = doc.split(/^## /m).find((p) => p.startsWith(`${r.id}\n`));
    assert.ok(section, r.id);
    assert.ok(section.includes(`- Level: ${r.severity}`), r.id);
    assert.ok(section.includes('- Cannot see: '), r.id);
    for (const b of r.basis) assert.ok(section.includes(POINTS[b].text), `${r.id}: ${b}`);
    if (r.kind === 'best practice') assert.ok(norm(section).includes(BEST), r.id);
    if (r.own) assert.ok(section.includes(r.own), `${r.id}: its own choice`);
  }
});

test('the documented checks name a page, the best practice checks say what is their own choice, and the input checks rest on no page', () => {
  for (const r of RULES.filter((x) => x.kind === 'documented')) {
    assert.ok(r.basis.length > 0, r.id);
    assert.equal(r.own, undefined, r.id);
  }
  for (const r of RULES.filter((x) => x.kind === 'best practice')) assert.ok(r.own && r.own.includes(BEST), `${r.id} says what is its own choice`);
  for (const r of RULES.filter((x) => x.kind === 'input')) assert.deepEqual(r.basis, [], r.id);
});

test('the pages say what the documented checks rest on', async () => {
  const btc = norm(await read('research/sources/bitcoin-developer-guide-payment-processing.txt'));
  assert.ok(btc.includes('Although this number is somewhat arbitrary, software handling high-value transactions, or otherwise at risk for fraud, should wait for at least six confirmations before treating a payment as accepted.'));
  assert.ok(btc.includes('Zero confirmation transactions (unconfirmed transactions) should generally not be trusted without risk analysis.'));
  assert.ok(btc.includes('Transactions which pay sufficient transaction fees need 10 minutes on average to receive one confirmation.'));
  assert.ok(btc.includes('must expire to prevent spenders from delaying payment in the hope that satoshis will drop in price. Most widely-used payment processing systems currently expire their invoices after 10 to 20 minutes.'));
  assert.ok(btc.includes('Shorter expiration periods increase the chance the invoice will expire before payment is received'));
  assert.ok(btc.includes('containing a unique (never before used)'));
  assert.ok(btc.includes('The obvious way to do that, which is very unsafe, is simply to return the satoshis to the pubkey script from which they came.'));
  const pos = norm(await read('research/sources/ethereum-org-proof-of-stake.txt'));
  assert.ok(pos.includes('Time in proof-of-stake Ethereum is divided into slots (12 seconds) and epochs (32 slots).'));
  assert.ok(pos.includes('The first block in each epoch is a checkpoint.'));
  assert.ok(pos.includes('The more recent of the two (target) becomes "justified".'));
  assert.ok(pos.includes('Now it is upgraded to "finalized".'));
  const rpc = norm(await read('research/sources/solana-rpc-overview-commitment.txt'));
  assert.ok(rpc.includes("The node's most recent processed block. This is the newest view, but it can still be rolled back."));
  assert.ok(rpc.includes('A block directly voted on by a supermajority of stake, meaning more than two-thirds of the network\'s active stake.'));
  assert.ok(rpc.includes('A block the cluster recognizes as finalized with maximum lockout'));
  const conf = norm(await read('research/sources/solana-transaction-confirmation-and-expiration.txt'));
  assert.ok(conf.includes("roughly 5% of blocks don't end up being finalized by the cluster"));
  assert.ok(conf.includes('`finalized` will eliminate any risk that the blockhash you choose will belong to a dropped fork.'));
  assert.ok(conf.includes('typically at least a 32 slot difference between the most recent confirmed block and the most recent finalized block'));
  assert.ok(conf.includes('but may fluctuate between 400ms and 600ms'));
  const circle = norm(await read('research/sources/circle-usdc-contract-addresses.txt'));
  assert.ok(circle.includes('verify all addresses'));
  const quick = norm(await read('research/sources/circle-quickstart-transfer-usdc-on-solana.txt'));
  assert.ok(quick.includes('USDC uses 6 decimal places.'));
  const stripe = norm(await read('research/sources/stripe-webhooks.txt'));
  assert.ok(stripe.includes('Registered webhook endpoints must be publicly accessible HTTPS URLs.'));
  assert.ok(stripe.includes('After it\'s publicly accessible, your webhook endpoint function must use HTTPS.'));
  assert.ok(stripe.includes('Stripe generates signatures using a hash-based message authentication code ([HMAC](https://en.wikipedia.org/wiki/Hash-based_message_authentication_code)) with [SHA-256](https://en.wikipedia.org/wiki/SHA-2).'));
  assert.ok(stripe.includes('Without verification, an attacker could send fake webhook events to your endpoint to trigger actions like fulfilling orders'));
  assert.ok(stripe.includes('Our libraries have a default tolerance of 5 minutes between the timestamp and the current time.'));
  assert.ok(stripe.includes("Don't use a tolerance value of `0`. Using a tolerance value of `0` disables the recency check entirely."));
  assert.ok(stripe.includes('Webhook endpoints might occasionally receive the same event more than once.'));
  assert.ok(stripe.includes('Stripe attempts to deliver events to your destination for up to three days with an exponential back off in live mode.'));
  const github = norm(await read('research/sources/github-validating-webhook-deliveries.txt'));
  assert.ok(github.includes('The `X-Hub-Signature` header uses the HMAC-SHA1 algorithm and is only included for legacy purposes.'));
  assert.ok(github.includes('Never hardcode a token into an application or push a token to any repository.'));
  assert.ok(github.includes('"constant time" string comparison'));
});

test('every official address of the table of tokens is the one the saved copy of Circle\'s page lists for its network', async () => {
  const copy = await read('research/sources/circle-usdc-contract-addresses.txt');
  const mainnet = copy.split('## Testnet')[0];
  for (const t of OFFICIAL_TOKENS) {
    for (const a of t.addresses) {
      const row = mainnet.split('\n').find((l) => l.startsWith(`| ${a.title} |`));
      assert.ok(row, `${a.title} is a row of the mainnet table`);
      assert.ok(row.includes(`[\`${a.address}\`]`), `${a.network}: ${a.address}`);
    }
  }
  assert.ok(!mainnet.split('\n').some((l) => l.startsWith('| Tron |')), 'the page lists no USDC on Tron');
});

test('the numbers of the table of networks marked as documented are the ones of the saved pages', async () => {
  const by = Object.fromEntries(NETWORKS.map((n) => [n.id, n]));
  const btc = norm(await read('research/sources/bitcoin-developer-guide-payment-processing.txt'));
  assert.ok(by.bitcoin.documented && by.bitcoin.minConfirmations === 6 && btc.includes('at least six confirmations'));
  assert.ok(by.bitcoin.blockDocumented && by.bitcoin.blockMs === 10 * 60 * 1000 && btc.includes('10 minutes on average'));
  const pos = norm(await read('research/sources/ethereum-org-proof-of-stake.txt'));
  assert.ok(by.ethereum.blockDocumented && by.ethereum.blockMs === 12 * 1000 && pos.includes('slots (12 seconds) and epochs (32 slots)'));
  assert.equal(by.ethereum.finalMs, 2 * 32 * by.ethereum.blockMs);
  const conf = norm(await read('research/sources/solana-transaction-confirmation-and-expiration.txt'));
  assert.ok(by.solana.blockDocumented && by.solana.blockMs === 400 && conf.includes('400ms'));
  assert.equal(by.solana.finalMs, 32 * by.solana.blockMs);
  for (const n of NETWORKS.filter((x) => !['bitcoin', 'ethereum', 'solana'].includes(x.id))) {
    assert.equal(n.documented, false, n.id);
    assert.equal(n.blockDocumented, false, n.id);
  }
});

test('size helpers: grouped numbers, lists for a sentence and plurals', () => {
  assert.equal(grouped(12345), '12,345');
  assert.equal(grouped(10n ** 12n), '1,000,000,000,000');
  assert.equal(listText(['a']), 'a');
  assert.equal(listText(['a', 'b']), 'a and b');
  assert.equal(listText(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listText(['a', 'b', 'c', 'd', 'e'], 3), 'a, b, c and 2 more');
  assert.equal(plural(1, 'line'), '1 line');
  assert.equal(plural(2, 'asset'), '2 assets');
});

test('text helpers: safeText replaces control, direction and separator characters and caps the length; flat folds white space', () => {
  const bad = ['a', String.fromCharCode(0x1b), '[31m', String.fromCharCode(0x202e), 'b', String.fromCharCode(0x2028), 'c', String.fromCharCode(7), 'd', String.fromCharCode(0x85), 'e'].join('');
  const out = safeText(bad);
  assert.ok(![...out].some((c) => c.charCodeAt(0) < 32 || [0x202e, 0x2028, 0x85].includes(c.charCodeAt(0))));
  assert.equal(safeText('x'.repeat(50), 10), 'xxxxxxx...');
  assert.equal(safeText('short', 10), 'short');
  assert.equal(flat('  a \n  b\t c '), 'a b c');
});
