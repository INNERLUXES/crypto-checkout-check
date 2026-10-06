// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// configurations to examples/output. CI runs it and then fails if those files changed, so the example output in the
// repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const BAD = ['examples/bad/checkout.json'];
export const GOOD = ['examples/good/checkout.json'];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the bad configuration: the counts, a finding of nearly every check, and the result.
export const EXPECTED = [
  'checkout: Lantern Example Store; 10 assets on 7 networks (bitcoin, ethereum, base, solana, tron, litecoin and polygon); invoices expire after 600 seconds (10 minutes); webhook http, signed with hmac-sha1',
  'findings: 28 (15 error, 12 warning, 1 info)',
  'Asset BTC on bitcoin marks an invoice paid after 1 confirmation, and the asset gives no maxAmount',
  'The contract of asset USDC on ethereum is 0x1111111111111111111111111111111111111111, but Circle\'s page of USDC contract addresses lists 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 for Ethereum',
  'Asset USDC on ethereum has 18 decimals, but the Circle quickstart for Solana says USDC carries 6: every amount read is too small by a factor of 1,000,000,000,000',
  'The contract of asset USDC on base is "0x8335", which has 4 characters after 0x, not 40',
  'Asset SOL on solana marks an invoice paid at the processed commitment.',
  'Asset USDC on solana takes the payments of every invoice at one shared address and asks for no memo or reference key',
  'Asset 7 has no depositAddress.',
  'Asset USDT on tron is a token with no contract address',
  'Asset 9 is usdc on Base, as is asset 4 at line 34',
  'The kind of asset DAI on polygon is "erc20"; it must be native or token.',
  'The webhook is signed with hmac-sha1 but has no secretRef',
  'The webhook names no idempotencyKey, so an event delivered twice can count one payment twice.',
  'The webhook URL uses http, not https',
  'The webhook is signed with "hmac-sha1", which is weaker than HMAC-SHA256.',
  'The webhook holds the key "signingSecret", a signing secret written into the file. The value is not shown',
  'Asset ETH on ethereum marks an invoice paid after 3 confirmations, fewer than the tool\'s starting point of 12 for Ethereum',
  'Asset ETH on ethereum marks an invoice paid after 3 confirmations, before its block is finalized, and its largest invoice, 50000 USD, is above the --large-payment limit of 1000 USD.',
  'Asset USDC on base marks an invoice paid after 12 confirmations, before its block is finalized, and its largest invoice, 5000 USD',
  'Asset USDC on solana marks an invoice paid at the confirmed commitment.',
  'The key "Decimals" of asset 10 is not one the tool reads, so its value was left out of every check. Did you mean "decimals"?',
  'The invoice has no overpaymentTolerance',
  'The invoice expires after 600 seconds (10 minutes), but a payment in asset USDC on ethereum takes about 768 seconds to reach the finalized checkpoint',
  'The quoted rate is held for 1,800 seconds (30 minutes), longer than the 600 seconds (10 minutes) the invoice runs',
  'The underpaymentTolerance of the invoice is negative',
  'The webhook has a timestampTolerance of 0',
  'The webhook retries 0 times',
  'Refunds go back to the address the payment came from.',
  'The network "litecoin" of asset LTC on litecoin is not in the tool\'s table',
  'not a security audit and not a guarantee that no payment will be lost or counted twice',
  'RESULT: FAIL - 15 findings at or above error (15 error, 12 warning, 1 info)'
];
// What must not be reported: the check the bad configuration does not hold, the inline secret, and a pass.
export const UNWANTED = ['ERROR    config-unreadable', 'left-out-on-purpose', 'whsec_', 'RESULT: PASS'];

// What the README says of the good configuration: one note.
export const GOOD_EXPECTED = [
  'checkout: Harbor Example Store; 8 assets on 7 networks (bitcoin, ethereum, base, polygon, solana, tron and litecoin); invoices expire after 900 seconds (15 minutes); webhook https, signed with hmac-sha256',
  'findings: 1 (1 info)',
  'The network "litecoin" of asset LTC on litecoin is not in the tool\'s table',
  'RESULT: PASS - no finding at or above error (1 info)'
];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = await run(BAD);
  process.stdout.write(bad.out);
  expect('bad configuration', bad, 1, EXPECTED, UNWANTED);

  const good = await run(GOOD);
  expect('good configuration', good, 0, GOOD_EXPECTED, ['ERROR    ', 'WARNING  ', 'RESULT: FAIL']);
  // The good configuration also passes when warnings fail the run, and fails only when notes do.
  expect('good, fail on warning', await run([...GOOD, '--fail-on', 'warning']), 0, ['RESULT: PASS - no finding at or above warning (1 info)'], []);
  expect('good, fail on info', await run([...GOOD, '--fail-on', 'info']), 1, ['RESULT: FAIL - 1 finding at or above info (1 info)'], []);
  // A lower limit for a payment of high value makes the USDC on Base of the good configuration one, and it is reported.
  expect('good, large payment of 500', await run([...GOOD, '--fail-on', 'warning', '--large-payment', '500']), 1, ['evm-paid-before-finality'], []);
  // The bad configuration with only the errors shown still counts the rest.
  expect('bad, errors only', await run([...BAD, '--min-severity', 'error']), 1, ['findings: 15 (15 error); 13 below error not shown'], ['WARNING  ', 'INFO     ']);
  // A file that is not there stops the run with no report.
  expect('missing file', await run(['examples/none/checkout.json']), 2, ['examples/none/checkout.json: does not exist'], [], 'err');

  // The README shows the head of the report of the bad configuration with its table of checks, one finding, the table of
  // assets and the end of the report, and the end of the report of the good configuration.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const lines = bad.out.split('\n');
  const head = lines.slice(0, lines.findIndex((l) => l.startsWith('Findings ('))).join('\n');
  if (!readme.includes(head)) problems.push('README: the head of the sample output of the bad configuration differs from a real run');
  const explained = (await run([...BAD, '--explain'])).out.split('\n');
  const at = explained.findIndex((l) => l.includes('confirmations-below-documented') && l.includes('examples/bad/checkout.json:'));
  const sample = explained.slice(at, at + 6).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the sample finding of the confirmations check differs from a real run');
  const t = lines.findIndex((l) => l.startsWith('Assets ('));
  const table = lines.slice(t, t + 13).join('\n');
  if (t < 0 || !readme.includes(table)) problems.push('README: the table of assets of the bad configuration differs from a real run');
  const tail = lines.slice(-6).join('\n');
  if (!readme.includes(tail)) problems.push('README: the tail of the sample output of the bad configuration differs from a real run');
  const goodTail = good.out.split('\n').slice(-6).join('\n');
  if (!readme.includes(goodTail)) problems.push('README: the tail of the sample output of the good configuration differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/bad.txt'), bad.out);
  await writeFile(resolve(root, 'examples/output/good.txt'), good.out);
  const outputs = [
    ['bad-explain.txt', [...BAD, '--explain'], 1],
    ['bad.md', [...BAD, '--format', 'markdown'], 1],
    ['bad-explain.md', [...BAD, '--format', 'markdown', '--explain'], 1],
    ['bad.json', [...BAD, '--json', '--explain'], 1],
    ['bad.sarif', [...BAD, '--format', 'sarif'], 1],
    ['good.md', [...GOOD, '--format', 'markdown'], 0],
    ['good.json', [...GOOD, '--json'], 0],
    ['good.sarif', [...GOOD, '--format', 'sarif'], 0],
    ['checks.txt', ['--list-checks'], 0],
    ['checks.json', ['--list-checks', '--format', 'json'], 0]
  ];
  for (const [name, args, code] of outputs) {
    const r = await run(args);
    if (r.code !== code) problems.push(`${name}: exit code ${r.code}, expected ${code}`);
    await writeFile(resolve(root, 'examples/output', name), r.out);
  }

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
