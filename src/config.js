// Reading a checkout configuration from the nodes of the JSON reader. Every field is read with the line and column of its
// key, so a finding can point at it. A field that is missing, of the wrong type or unknown is a finding of its own, and
// the value is left out of the checks that need it; nothing that was not read is taken for a value that is fine. Keys of
// the file are only compared with the names below; no object is built with a key from the file. A value that
// src/secrets.js marked as a seed or a key is left out as if it were not there, and never shown. A webhook signing secret
// written inline, under a key named for a secret or as a secretRef that is not shaped like the name of a reference, is
// marked the same way here and reported as secret-in-config.

import { isArray, isNumber, isObject, isString } from './json.js';
import { compareDecimal, parseDecimal } from './decimal.js';
import { SOLANA_COMMITMENTS, networkOf } from './networks.js';

export const CONFIG_LIMITS = { maxAssets: 1000, maxSeconds: 100000000, maxDecimals: 36, maxConfirmations: 1000000, maxAttempts: 1000 };

export const TOP_KEYS = ['checkout', 'currency', 'assets', 'invoice', 'webhook', 'refunds', 'notes'];
export const ASSET_KEYS = ['name', 'network', 'kind', 'contract', 'decimals', 'confirmations', 'commitment', 'maxAmount', 'depositAddress', 'reference', 'notes'];
export const INVOICE_KEYS = ['expirySeconds', 'expiryRequires', 'rateLockSeconds', 'underpaymentTolerance', 'overpaymentTolerance', 'notes'];
export const WEBHOOK_KEYS = ['url', 'secretRef', 'signature', 'timestampTolerance', 'idempotencyKey', 'retry', 'notes'];
export const RETRY_KEYS = ['maxAttempts', 'backoff', 'notes'];
export const REFUND_KEYS = ['enabled', 'destination', 'review', 'notes'];
export const KINDS = ['native', 'token'];
export const EXPIRY_REQUIRES = ['detected', 'paid'];
export const DEPOSIT_POLICIES = ['per-invoice', 'shared'];
export const REFERENCES = ['none', 'memo', 'reference-key'];
export const BACKOFFS = ['exponential', 'linear', 'fixed'];
export const DESTINATIONS = ['sender', 'customer-provided', 'operator'];

// Signature algorithms: the ones the checks accept, the ones they know to be weak, and "none".
export const STRONG_SIGNATURES = ['hmac-sha256', 'hmac-sha512'];
export const WEAK_SIGNATURES = ['hmac-sha1', 'hmac-md5', 'sha1', 'sha256', 'sha512', 'md5', 'crc32', 'plain'];

const where = (e) => ({ line: e.line, column: e.column });

// A text from the file as a message names it: cut at a length, so that a long value does not fill a report.
export const cut = (text, max = 120) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

// A known key that an unknown one is probably meant to be: the same letters in another case, or one that starts with the
// other.
export function suggestKey(key, known) {
  const k = key.toLowerCase();
  if (k.length < 3) return null;
  return known.find((n) => n.toLowerCase() === k) ?? known.find((n) => n.toLowerCase().startsWith(k) || k.startsWith(n.toLowerCase())) ?? null;
}

export const describe = (node) => (node.secret ? 'a value that is not shown' : node.kind === 'object' ? 'an object' : node.kind === 'array' ? 'a list' : node.kind === 'null' ? 'null' : node.kind === 'boolean' ? `${node.value}` : node.kind === 'number' ? `the number ${node.raw.length > 40 ? `${node.raw.slice(0, 37)}...` : node.raw}` : 'text');

// Keys of the webhook that hold a signing secret written inline: a name that ends in "secret", or one of these, compared
// in lowercase with everything but the letters left out. secretRef, the name of a reference, is not one.
const INLINE_SECRET_KEYS = ['key', 'token', 'hmackey', 'signingkey', 'apikey', 'password'];
export const isInlineSecretKey = (key) => {
  const k = key.toLowerCase().replace(/[^a-z]/g, '');
  return k !== 'secretref' && (k.endsWith('secret') || INLINE_SECRET_KEYS.includes(k));
};

// The name of a reference to a secret: an optional scheme such as env: or vault:, then a name of letters, digits, "_",
// ".", "/" and "-" that starts with a letter or "_". A value with the prefix of a signing or API secret, or a long run of
// letters and digits with no separator, is not a name but probably the secret itself.
const REFERENCE = /^(?:[a-z][a-z0-9-]{0,15}:)?[A-Za-z_][A-Za-z0-9_./-]{0,127}$/;
const SECRET_PREFIX = /^(?:[a-z]+:)?(?:whsec_|sk_live_|sk_test_|rk_live_|rk_test_)/i;
const OPAQUE = /^(?:[a-z][a-z0-9-]{0,15}:)?(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{24,}$/;
export const isReferenceName = (text) => REFERENCE.test(text) && !SECRET_PREFIX.test(text) && !OPAQUE.test(text);

const WHOLE = /^(?:0|[1-9][0-9]{0,11})$/;
const HUNDRED = parseDecimal('100');
const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/[^\s/?#]+/;

// Marks every string below a node as secret, so that no part of it reaches a report.
function markAll(node) {
  const stack = [node];
  while (stack.length > 0) {
    const n = stack.pop();
    n.secret = true;
    if (isObject(n)) for (const e of n.entries) stack.push(e.value);
    else if (isArray(n)) for (const item of n.items) stack.push(item);
  }
}

// Reads the configuration from the root node: { config, findings, notes }.
export function readConfig(root, limits = CONFIG_LIMITS) {
  const findings = [];
  const notes = [];
  const add = (id, at, message, extra = {}) => findings.push({ id, line: at.line, column: at.column, message, ...extra });

  // The entries of an object, with a field-unknown finding for each key that is not in known, and the first entry of each
  // known key in a map. A key that names a seed or a key was reported by src/secrets.js and is passed over.
  function fields(obj, known, label) {
    const map = new Map();
    for (const e of obj.entries) {
      if (e.secret) continue;
      if (known.includes(e.key)) map.set(e.key, e);
      else {
        const near = suggestKey(e.key, known);
        add('field-unknown', where(e), `The key "${cut(e.key)}" of ${label} is not one the tool reads, so its value was left out of every check.${near ? ` Did you mean "${near}"?` : ''} The keys of ${label} are ${known.join(', ')}.`);
      }
    }
    return map;
  }

  // A text field: null when it is missing, empty, of another type or marked as a secret.
  function text(map, key, at, Label, required, of) {
    const e = map.get(key);
    if (!e) {
      if (required) add('field-missing', at, `${Label} has no ${key}.`);
      return { value: null, entry: null };
    }
    if (e.value.secret) return { value: null, entry: e };
    if (!isString(e.value)) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be text.`);
      return { value: null, entry: e };
    }
    if (e.value.value.trim() === '') {
      add('field-invalid', where(e), `The ${key} of ${of} is empty.`);
      return { value: null, entry: e };
    }
    return { value: e.value.value, entry: e };
  }

  // A text field that must be one of a list, compared without case and outer spaces.
  function choice(map, key, at, Label, required, of, list) {
    const t = text(map, key, at, Label, required, of);
    if (t.value === null) return t;
    const v = t.value.trim().toLowerCase();
    if (list.includes(v)) return { value: v, entry: t.entry };
    add('field-invalid', where(t.entry), `The ${key} of ${of} is "${cut(t.value)}"; it must be ${list.slice(0, -1).join(', ')} or ${list.at(-1)}.`);
    return { value: null, entry: t.entry };
  }

  // A whole number from 0 up to a limit: null when it is missing or invalid; a missing field is not a finding here.
  function whole(map, key, of, max, what) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null };
    if (!isNumber(e.value) || !WHOLE.test(e.value.raw) || Number(e.value.raw) > max) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be a whole number of ${what} from 0 to ${max}, written as a number.`);
      return { value: null, entry: e };
    }
    return { value: Number(e.value.raw), entry: e };
  }

  const seconds = (map, key, of) => whole(map, key, of, limits.maxSeconds, 'seconds');

  // A true or false field.
  function flag(map, key, of) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null };
    if (e.value.kind !== 'boolean') {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be true or false.`);
      return { value: null, entry: e };
    }
    return { value: e.value.value, entry: e };
  }

  // A plain decimal number, such as 2500 or 0.5: { value: { int, scale } }. A percent is at most 100 and may be read with a
  // minus sign, so that a negative tolerance is a finding of the checks and not of the reader.
  function decimal(map, key, of, what, percent = false) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, negative: false, entry: e ?? null };
    const raw = isNumber(e.value) ? e.value.raw : '';
    const negative = percent && raw.startsWith('-');
    const d = isNumber(e.value) ? parseDecimal(negative ? raw.slice(1) : raw) : null;
    if (!d) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; ${what} must be a plain decimal number of up to 40 digits on each side of the point, written as a number with no exponent${percent ? '' : ' and no sign'}, such as ${percent ? '0.5' : '2500'}.`);
      return { value: null, negative: false, entry: e };
    }
    if (percent && compareDecimal(d, HUNDRED) > 0) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${raw}; a percent must be at most 100.`);
      return { value: null, negative: false, entry: e };
    }
    return { value: d, negative: negative && d.int !== 0n, entry: e };
  }

  // A part of the configuration that must be an object: its node, or null with a finding.
  function part(map, key, at, Label, of, required = true) {
    const e = map.get(key);
    if (!e) {
      if (required) add('field-missing', at, `${Label} has no ${key}.`);
      return { node: null, entry: null };
    }
    if (e.value.secret) return { node: null, entry: e };
    if (!isObject(e.value)) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be an object.`);
      return { node: null, entry: e };
    }
    return { node: e.value, entry: e };
  }

  function notesOf(map, of) {
    const n = map.get('notes');
    if (n && !n.value.secret && !isString(n.value)) add('field-invalid', where(n), `The notes of ${of} are ${describe(n.value)}; they must be text.`);
  }

  function readAsset(node, index) {
    const label = `asset ${index + 1}`;
    const map = fields(node, ASSET_KEYS, label);
    const at = where(node);
    const Label = `Asset ${index + 1}`;
    const name = text(map, 'name', at, Label, true, label);
    const asset = { index, name: name.value, nameEntry: name.entry, line: node.line, column: node.column };
    const network = text(map, 'network', at, Label, true, `asset ${name.value === null ? index + 1 : cut(name.value)}`);
    asset.networkText = network.value;
    asset.networkEntry = network.entry;
    asset.network = network.value === null ? null : networkOf(network.value);
    asset.title = `${name.value === null ? label : cut(name.value)}${network.value === null ? '' : ` on ${cut(network.value.trim(), 60)}`}`;
    const of = `asset ${asset.title}`;
    const Of = `Asset ${asset.title}`;
    const family = asset.network ? asset.network.family : null;

    const kind = choice(map, 'kind', at, Label, true, of, KINDS);
    asset.kind = kind.value;
    asset.kindEntry = kind.entry;
    if (asset.kind === 'token' && family === 'utxo') {
      add('field-invalid', where(kind.entry), `${Of} is a token, but the tool reads no token on ${asset.network.title}; a ${asset.network.title} asset is native.`);
      asset.kind = null;
    }

    const contract = text(map, 'contract', at, Label, false, of);
    asset.contract = contract.value;
    asset.contractEntry = contract.entry;
    if (contract.entry && kind.value === 'native') {
      add('field-invalid', where(contract.entry), `${Of} is native, and a native asset takes no contract; the value was left out of every check.`);
      asset.contract = null;
    }

    const decimals = whole(map, 'decimals', of, limits.maxDecimals, 'decimals');
    asset.decimals = decimals.value;
    asset.decimalsEntry = decimals.entry;
    if (!decimals.entry && asset.kind === 'token') add('field-missing', at, `${Label} is a token and has no decimals; give the decimals of the token on its network.`);

    const confirmations = whole(map, 'confirmations', of, limits.maxConfirmations, 'confirmations');
    asset.confirmations = confirmations.value;
    asset.confirmationsEntry = confirmations.entry;
    const commitment = text(map, 'commitment', at, Label, false, of);
    asset.commitment = null;
    asset.commitmentEntry = commitment.entry;
    if (commitment.value !== null) {
      const v = commitment.value.trim().toLowerCase();
      if (family === 'utxo' || family === 'tron') add('field-invalid', where(commitment.entry), `${Of} is on ${asset.network.title}, where a payment is marked paid by confirmations; the network takes no commitment.`);
      else if (family === 'evm' && v !== 'finalized') add('field-invalid', where(commitment.entry), `The commitment of ${of} is "${cut(commitment.value)}"; on an EVM network the only commitment the tool reads is "finalized".`);
      else if (family === 'solana' && !SOLANA_COMMITMENTS.includes(v)) add('field-invalid', where(commitment.entry), `The commitment of ${of} is "${cut(commitment.value)}"; on Solana it must be ${SOLANA_COMMITMENTS.slice(0, -1).join(', ')} or ${SOLANA_COMMITMENTS.at(-1)}.`);
      else asset.commitment = v;
    }
    if (confirmations.entry && family === 'solana') {
      add('field-invalid', where(confirmations.entry), `${Of} is on Solana, where a payment is marked paid at a commitment level; give commitment, not confirmations.`);
      asset.confirmations = null;
    }
    if (confirmations.entry && commitment.entry && family === 'evm') {
      add('field-invalid', where(commitment.entry), `${Of} gives both confirmations and a commitment; give one, so that what marks an invoice paid is not in doubt.`);
      asset.commitment = null;
      asset.confirmations = null;
    }
    if (!confirmations.entry && !commitment.entry) {
      const need = family === 'solana' ? 'a commitment' : family === 'evm' || family === null ? 'confirmations or a commitment' : 'confirmations';
      add('field-missing', at, `${Label} has no ${family === 'solana' ? 'commitment' : 'confirmations'}; give ${need}, what marks an invoice paid on its network.`);
    }

    const max = decimal(map, 'maxAmount', of, 'an amount');
    asset.maxAmount = max.value;
    asset.maxAmountEntry = max.entry;
    const deposit = choice(map, 'depositAddress', at, Label, true, of, DEPOSIT_POLICIES);
    asset.depositAddress = deposit.value;
    asset.depositEntry = deposit.entry;
    const reference = choice(map, 'reference', at, Label, false, of, REFERENCES);
    asset.reference = reference.value;
    asset.referenceEntry = reference.entry;
    notesOf(map, of);
    return asset;
  }

  function readInvoice(node) {
    const of = 'the invoice';
    const map = fields(node, INVOICE_KEYS, of);
    const invoice = { line: node.line, column: node.column };
    for (const key of ['expirySeconds', 'rateLockSeconds']) {
      const r = seconds(map, key, of);
      invoice[key] = r.value;
      invoice[`${key}Entry`] = r.entry;
    }
    const requires = choice(map, 'expiryRequires', where(node), 'The invoice', false, of, EXPIRY_REQUIRES);
    invoice.expiryRequires = requires.value ?? (requires.entry === null ? 'paid' : null);
    invoice.expiryRequiresEntry = requires.entry;
    for (const key of ['underpaymentTolerance', 'overpaymentTolerance']) {
      const r = decimal(map, key, of, 'a tolerance in percent', true);
      invoice[key] = r.value;
      invoice[`${key}Negative`] = r.negative;
      invoice[`${key}Entry`] = r.entry;
    }
    notesOf(map, of);
    return invoice;
  }

  function readWebhook(node) {
    const of = 'the webhook';
    // A signing secret written inline is marked before the fields are read, so that no message names its value.
    for (const e of node.entries) {
      if (e.secret || !isInlineSecretKey(e.key)) continue;
      e.secret = true;
      markAll(e.value);
      add('secret-in-config', where(e), `The webhook holds the key "${cut(e.key, 60)}", a signing secret written into the file. The value is not shown; name the secret by a reference in secretRef instead.`);
    }
    const map = fields(node, WEBHOOK_KEYS, of);
    const at = where(node);
    const hook = { line: node.line, column: node.column };
    const url = text(map, 'url', at, 'The webhook', true, of);
    hook.url = null;
    hook.urlEntry = url.entry;
    hook.scheme = null;
    if (url.value !== null) {
      const m = SCHEME.exec(url.value.trim());
      if (!m) add('field-invalid', where(url.entry), `The url of the webhook is "${cut(url.value)}", which is not an absolute URL with a scheme and a host, such as https://shop.example/hooks/payments.`);
      else {
        hook.url = url.value.trim();
        hook.scheme = m[1].toLowerCase();
      }
    }
    const sig = text(map, 'signature', at, 'The webhook', false, of);
    hook.signature = sig.value === null ? null : sig.value.trim().toLowerCase();
    hook.signatureText = sig.value;
    hook.signatureEntry = sig.entry;

    const ref = map.get('secretRef');
    hook.secretRef = null;
    hook.secretRefEntry = ref ?? null;
    if (ref && !ref.value.secret) {
      if (!isString(ref.value)) add('field-invalid', where(ref), `The secretRef of the webhook is ${describe(ref.value)}; it must be the name of a reference to the secret, such as env:CHECKOUT_WEBHOOK_SECRET.`);
      else if (!isReferenceName(ref.value.value)) {
        markAll(ref.value);
        add('secret-in-config', where(ref), 'The secretRef of the webhook is not shaped like the name of a reference; it may be the signing secret itself, so it is treated as one and not shown. Name the secret by a reference such as env:CHECKOUT_WEBHOOK_SECRET.');
      } else hook.secretRef = ref.value.value;
    }
    if (!ref && hook.signature !== null && hook.signature.startsWith('hmac-')) add('field-missing', at, `The webhook is signed with ${cut(hook.signatureText.trim(), 40)} but has no secretRef; name the secret the signature is made with by a reference, such as env:CHECKOUT_WEBHOOK_SECRET.`);

    const tol = seconds(map, 'timestampTolerance', of);
    hook.timestampTolerance = tol.value;
    hook.timestampToleranceEntry = tol.entry;
    const idem = text(map, 'idempotencyKey', at, 'The webhook', false, of);
    hook.idempotencyKey = idem.value;
    hook.idempotencyKeyEntry = idem.entry;
    const retry = part(map, 'retry', at, 'The webhook', of, false);
    hook.retryEntry = retry.entry;
    hook.retry = null;
    if (retry.node) {
      const rmap = fields(retry.node, RETRY_KEYS, 'the retry policy of the webhook');
      const attempts = whole(rmap, 'maxAttempts', 'the retry policy of the webhook', limits.maxAttempts, 'attempts');
      if (!attempts.entry) add('field-missing', where(retry.node), 'The retry policy of the webhook has no maxAttempts.');
      const backoff = choice(rmap, 'backoff', where(retry.node), 'The retry policy of the webhook', false, 'the retry policy of the webhook', BACKOFFS);
      hook.retry = { maxAttempts: attempts.value, maxAttemptsEntry: attempts.entry, backoff: backoff.value, line: retry.node.line, column: retry.node.column };
      notesOf(rmap, 'the retry policy of the webhook');
    }
    notesOf(map, of);
    return hook;
  }

  function readRefunds(node) {
    const of = 'the refunds';
    const map = fields(node, REFUND_KEYS, of);
    const at = where(node);
    const enabled = flag(map, 'enabled', of);
    if (!enabled.entry) add('field-missing', at, 'The refunds have no enabled; write true when the checkout sends refunds and false when it does not.');
    const destination = choice(map, 'destination', at, 'The refunds', enabled.value === true, of, DESTINATIONS);
    const review = flag(map, 'review', of);
    notesOf(map, of);
    return { line: node.line, column: node.column, enabled: enabled.value, destination: destination.value, destinationEntry: destination.entry, review: review.value, reviewEntry: review.entry };
  }

  if (!isObject(root)) {
    add('config-unreadable', root, `The file holds ${describe(root)}, not a checkout configuration; a configuration is one JSON object (docs/inputs.md). Nothing in the file was checked.`);
    return { config: null, findings, notes };
  }

  const top = fields(root, TOP_KEYS, 'the configuration');
  const start = where(root);
  const checkout = text(top, 'checkout', start, 'The configuration', true, 'the configuration');
  const currency = text(top, 'currency', start, 'The configuration', true, 'the configuration');
  const config = { checkout: checkout.value, currency: currency.value === null ? null : currency.value.trim(), assets: [], invoice: null, invoiceEntry: null, webhook: null, webhookEntry: null, refunds: null, refundsEntry: null, line: root.line, column: root.column };
  notesOf(top, 'the configuration');

  const ae = top.get('assets');
  if (!ae) add('field-missing', start, 'The configuration has no assets; give the list of the assets the checkout accepts (docs/inputs.md).');
  else if (ae.value.secret) {
    // Reported by src/secrets.js.
  } else if (!isArray(ae.value)) add('field-invalid', where(ae), `The assets of the configuration are ${describe(ae.value)}; they must be a list of objects.`);
  else if (ae.value.items.length === 0) add('field-missing', where(ae), 'The assets of the configuration are an empty list; give at least one asset.');
  else {
    const items = ae.value.items;
    if (items.length > limits.maxAssets) add('field-invalid', where(ae), `The configuration has ${items.length} assets, more than the limit of ${limits.maxAssets}; only the first ${limits.maxAssets} were read.`);
    const seen = new Map();
    items.slice(0, limits.maxAssets).forEach((node, index) => {
      if (!isObject(node)) {
        add('field-invalid', node, `Asset ${index + 1} of the assets is ${describe(node)}; an asset is an object with a name, a network, a kind and what marks it paid.`);
        return;
      }
      const asset = readAsset(node, index);
      if (asset.name !== null) {
        const key = `${asset.name.trim().toLowerCase()} ${asset.network ? asset.network.id : (asset.networkText ?? '').trim().toLowerCase()}`;
        const first = seen.get(key);
        if (first) add('asset-duplicate', where(asset.nameEntry), `Asset ${index + 1} is ${asset.title}, as is asset ${first.index + 1} at line ${first.nameEntry.line}; a payment cannot be told apart and a finding cannot be traced to one of them.`, { entry: asset.title });
        else seen.set(key, asset);
      }
      config.assets.push(asset);
    });
  }

  const invoice = part(top, 'invoice', start, 'The configuration', 'the configuration');
  config.invoiceEntry = invoice.entry;
  if (invoice.node) config.invoice = readInvoice(invoice.node);
  const webhook = part(top, 'webhook', start, 'The configuration', 'the configuration');
  config.webhookEntry = webhook.entry;
  if (webhook.node) config.webhook = readWebhook(webhook.node);
  const refunds = part(top, 'refunds', start, 'The configuration', 'the configuration');
  config.refundsEntry = refunds.entry;
  if (refunds.node) config.refunds = readRefunds(refunds.node);
  return { config, findings, notes };
}
