// Command line: crypto-checkout-check <checkout.json> [options]

import { readFileSync } from 'node:fs';
import { DEFAULT_LARGE_PAYMENT } from './analyze.js';
import { InputError, LIMITS, checkFile } from './check.js';
import { LEVELS } from './data.js';
import { parseDecimal } from './decimal.js';
import { NETWORKS, networkOf } from './networks.js';
import { listChecksJson, listChecksMarkdown, listChecksText, toJson, toMarkdown, toSarif, toText } from './report.js';
import { RULES } from './rules.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

// The largest count --min-confirmations takes.
export const MAX_MIN_CONFIRMATIONS = 100000;

// The networks whose threshold --min-confirmations may set: those whose number is the tool's own.
export const CONFIGURABLE = NETWORKS.filter((n) => n.minConfirmations !== null && !n.documented).map((n) => n.id);

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson, sarif: toSarif };
const LISTS = { text: listChecksText, markdown: listChecksMarkdown, json: listChecksJson };

export const USAGE = `Usage: crypto-checkout-check <checkout.json> [options]

Reads the configuration of a crypto payment gateway or checkout before it goes live (for each accepted asset the
network, native or token, the token contract and decimals, the confirmations or commitment that mark an invoice paid,
the largest invoice and the deposit address policy; the invoice expiry, how long a rate is held and the under- and
overpayment tolerances; the webhook URL, signature, secret reference, timestamp tolerance, idempotency key and retries;
and the refunds) and lists the settings that lose payments or count them twice: too few confirmations, a Solana
commitment below finalized, a large Ethereum payment marked paid before finality, a USDC contract or decimals that are
not Circle's, a shared deposit address with no memo, an invoice that expires before it can be paid, a webhook that is
not https, unsigned, weakly signed, open to replay, with no idempotency key or no retries, and refunds sent to the
sender or with no review. A webhook secret written inline, or a private key or a seed, is an error whose value is never
shown. It reads the file and is not an auditor: it contacts no chain, RPC or webhook, fetches nothing, runs nothing,
reads no clock and writes nothing to disk.

Options:
  --format <name>                   text, markdown, json or sarif (default: text)
  --json                            the same as --format json
  --min-severity <level>            the lowest level of a finding that is shown: ${LEVELS.join(', ')} (default: info)
  --fail-on <level>                 the lowest level of a finding that fails the run: ${LEVELS.join(', ')} (default: error)
  --large-payment <amount>          the invoice amount, in the currency of the checkout, above which a payment is of high value (default: ${DEFAULT_LARGE_PAYMENT})
  --min-confirmations <network>=<n> the confirmations below which confirmations-below-default reports an asset on ${CONFIGURABLE.join(', ')}; may be given once for each network
  --explain                         show the points of the pages behind each finding (text, markdown and JSON)
  --list-checks                     list the checks with their level and kind, and exit
  --help                            show this text
  --version                         show the version

Checks: ${RULES.map((r) => r.id).join(', ')}.

Exit codes: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

// A plain decimal amount from the command line.
function amountOf(flag, value) {
  const d = parseDecimal(value);
  if (!d) throw new Error(`${flag} takes a plain decimal amount such as 1000 or 2500.50, with no sign, exponent or separator`);
  return value;
}

// A network and a count from the command line, such as polygon=128.
function thresholdOf(flag, value, current) {
  const m = /^([A-Za-z][A-Za-z0-9-]{0,40})=((?:0|[1-9][0-9]{0,5}))$/.exec(value);
  if (!m || Number(m[2]) > MAX_MIN_CONFIRMATIONS) throw new Error(`${flag} takes <network>=<count>, such as polygon=128, with a whole count from 0 to ${MAX_MIN_CONFIRMATIONS}`);
  const network = networkOf(m[1]);
  if (!network) throw new Error(`${flag}: the network ${m[1]} is not in the table (${NETWORKS.map((n) => n.id).join(', ')})`);
  if (network.id === 'bitcoin') throw new Error(`${flag}: the six confirmations of Bitcoin come from the Bitcoin developer guide and are not set by an option`);
  if (network.minConfirmations === null) throw new Error(`${flag}: ${network.title} is paid at a commitment level, not after a count of confirmations`);
  if (current.some(([id]) => id === network.id)) throw new Error(`${flag} was given twice for ${network.id}`);
  return [network.id, Number(m[2])];
}

export function parseArgs(argv) {
  const o = { paths: [], format: null, json: false, minSeverity: null, failOn: null, largePayment: null, minConfirmations: [], explain: false, listChecks: false, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--json') o.json = true;
    else if (a === '--list-checks') o.listChecks = true;
    else if (a === '--format') o.format = once(a, o.format, next());
    else if (a === '--min-severity') o.minSeverity = once(a, o.minSeverity, next());
    else if (a === '--fail-on') o.failOn = once(a, o.failOn, next());
    else if (a === '--large-payment') o.largePayment = once(a, o.largePayment, amountOf(a, next()));
    else if (a === '--min-confirmations') o.minConfirmations.push(thresholdOf(a, next(), o.minConfirmations));
    else if (a === '-') throw new Error('reading from standard input is not supported; give a file');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else {
      if (o.paths.length === 1) throw new Error('give one configuration file');
      o.paths.push(a);
    }
  }
  if (o.json) {
    if (o.format !== null && o.format !== 'json') throw new Error(`--json and --format ${o.format} ask for two formats; give one`);
    o.format = 'json';
  }
  if (o.format === null) o.format = 'text';
  if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown, json or sarif)`);
  for (const [flag, v] of [['--min-severity', o.minSeverity], ['--fail-on', o.failOn]]) if (v !== null && !LEVELS.includes(v)) throw new Error(`${flag}: unknown level ${v} (${LEVELS.join(', ')})`);
  if (o.listChecks && o.format === 'sarif') throw new Error('--list-checks has no SARIF form; use text, markdown or json');
  if (!o.help && !o.version && !o.listChecks) {
    if (o.paths.length !== 1) throw new Error('give the configuration file, such as crypto-checkout-check checkout.json');
    if (o.paths.some(isUrl)) throw new Error('give a local path; the tool never fetches a URL');
    if (o.explain && o.format === 'sarif') throw new Error('--explain adds the points of the pages to the text, markdown and JSON reports; the sarif format has no place for them');
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`crypto-checkout-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (o.listChecks) {
    io.out(LISTS[o.format]());
    return 0;
  }
  let report;
  try {
    report = await checkFile({ path: o.paths[0], minSeverity: o.minSeverity ?? 'info', failOn: o.failOn ?? 'error', largePayment: o.largePayment ?? DEFAULT_LARGE_PAYMENT, minConfirmations: Object.fromEntries(o.minConfirmations), version: VERSION, limits: { ...LIMITS, ...(limits ?? {}) }, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`crypto-checkout-check: no result, the input has ${error.problems.length === 1 ? 'a problem' : 'problems'}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`crypto-checkout-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report, { explain: o.explain }));
  return report.result.pass ? 0 : 1;
}
