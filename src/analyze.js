// The checks on a configuration that was read: for each asset what marks an invoice paid against its network, its token
// contract and decimals, and its deposit address; then the invoice against the time each asset takes to be paid, the
// tolerances, the webhook and the refunds. Each finding names the line of the field it is about.

import { compareDecimal, formatDecimal, parseDecimal } from './decimal.js';
import { CONTRACT_FORMS, NETWORKS, contractProblem } from './networks.js';
import { STRONG_SIGNATURES, WEAK_SIGNATURES } from './config.js';
import { BEST } from './rules.js';
import { grouped } from './size.js';
import { officialAddress, officialToken, sameAddress } from './tokens.js';

const BP = `This is ${BEST}.`;
const at = (e) => ({ line: e.line, column: e.column });

// The amount above which an invoice is of high value, in the currency of the checkout, when --large-payment is not given.
export const DEFAULT_LARGE_PAYMENT = '1000';

// A number of seconds as a report writes it: "3,600 seconds (1 hour)", "900 seconds (15 minutes)", or the seconds alone
// when they are not a whole number of hours, or of minutes below two hours.
export function duration(s) {
  const unit = s >= 3600 && s % 3600 === 0 ? [s / 3600, 'hour'] : s >= 60 && s < 7200 && s % 60 === 0 ? [s / 60, 'minute'] : null;
  const base = `${grouped(s)} ${s === 1 ? 'second' : 'seconds'}`;
  return unit ? `${base} (${grouped(unit[0])} ${unit[0] === 1 ? unit[1] : `${unit[1]}s`})` : base;
}

// A time in milliseconds as a report writes it: whole seconds through duration(), or seconds with one decimal below a
// minute when they are not whole.
export function span(ms) {
  if (ms % 1000 === 0) return duration(ms / 1000);
  return `${(ms / 1000).toFixed(1)} seconds`;
}

// The time an asset takes from its first block to the point that marks it paid, in milliseconds, from the time of a block
// of its network, or null when the table has no figure for it.
export function timeToPaid(asset) {
  const n = asset.network;
  if (!n) return null;
  if (asset.commitment === 'finalized') return n.finalMs;
  if (asset.commitment !== null) return n.blockMs;
  if (asset.confirmations !== null) return asset.confirmations * n.blockMs;
  return null;
}

// The confirmations below which an asset on a network is reported: the documented number, the tool's own number, or the
// one --min-confirmations sets.
export const thresholdOf = (network, overrides = {}) => (Object.hasOwn(overrides, network.id) ? overrides[network.id] : network.minConfirmations);

const shown = (text) => (text.length > 60 ? `${text.slice(0, 57)}...` : text);

// The checks of a configuration: { findings, notes, rows }. rows holds each asset as the table of the report shows it.
export function analyzeConfig(config, { largePayment = DEFAULT_LARGE_PAYMENT, minConfirmations = {} } = {}) {
  const findings = [];
  const notes = [];
  const add = (id, where, message, entry = null) => findings.push({ id, line: where.line, column: where.column, message, entry });
  const large = parseDecimal(largePayment);
  const money = (d) => `${formatDecimal(d)}${config.currency ? ` ${config.currency}` : ''}`;
  const limitText = `the --large-payment limit of ${money(large)}`;
  // Whether the largest invoice of an asset is above the limit, or not given; and the words for it.
  const isLarge = (a) => a.maxAmount === null || compareDecimal(a.maxAmount, large) > 0;
  const sizeText = (a) => (a.maxAmount === null ? `the asset gives no maxAmount, so an invoice of any size can be paid with it, above ${limitText}` : `its largest invoice, ${money(a.maxAmount)}, is above ${limitText}`);
  const unlisted = [];

  for (const a of config.assets) {
    const of = `asset ${a.title}`;
    const Of = `Asset ${a.title}`;
    const net = a.network;

    if (net === null && a.networkText !== null) {
      add('network-not-in-table', at(a.networkEntry), `The network "${shown(a.networkText)}" of ${of} is not in the tool's table (${NETWORKS.map((n) => n.id).join(', ')}), so what marks a payment on it as final and the form of its token addresses were not judged. ${BP}`, a.title);
    }

    // What marks an invoice paid.
    if (net && a.confirmations !== null) {
      const c = a.confirmations;
      const where = at(a.confirmationsEntry);
      if (net.id === 'bitcoin') {
        if (c === 0) add('confirmations-below-documented', where, `${Of} marks an invoice paid with 0 confirmations, a payment that has only been broadcast. The Bitcoin developer guide says not to trust an unconfirmed payment without an analysis of the risk, and to wait for six confirmations on a payment of high value.`, a.title);
        else if (c < net.minConfirmations && isLarge(a)) add('confirmations-below-documented', where, `${Of} marks an invoice paid after ${c} ${c === 1 ? 'confirmation' : 'confirmations'}, and ${sizeText(a)}. The Bitcoin developer guide asks software that takes payments of high value to wait for at least six confirmations, about an hour; until then a double spend can still take the payment back.`, a.title);
      } else if (net.minConfirmations !== null && !net.documented) {
        const floor = thresholdOf(net, minConfirmations);
        const set = Object.hasOwn(minConfirmations, net.id) ? `the ${grouped(floor)} set with --min-confirmations` : `the tool's starting point of ${grouped(floor)} for ${net.title}`;
        if (c < floor) add('confirmations-below-default', where, `${Of} marks an invoice paid after ${grouped(c)} ${c === 1 ? 'confirmation' : 'confirmations'}, fewer than ${set}; a block that is replaced takes the payment with it. ${BP}`, a.title);
      }
      if (net.family === 'evm' && isLarge(a)) {
        if (net.id === 'ethereum') add('paid-before-finality', where, `${Of} marks an invoice paid after ${grouped(c)} ${c === 1 ? 'confirmation' : 'confirmations'}, before its block is finalized, and ${sizeText(a)}. The page of ethereum.org on proof-of-stake says a block is final only once a checkpoint above it is justified and then finalized, which takes at least two epochs of 32 slots of 12 seconds.`, a.title);
        else add('evm-paid-before-finality', where, `${Of} marks an invoice paid after ${grouped(c)} ${c === 1 ? 'confirmation' : 'confirmations'}, before its block is finalized, and ${sizeText(a)}. ${BP}`, a.title);
      }
    }
    if (net && net.family === 'solana' && a.commitment !== null) {
      const where = at(a.commitmentEntry);
      if (a.commitment === 'processed') add('solana-commitment-processed', where, `${Of} marks an invoice paid at the processed commitment. The Solana RPC page says a processed block can still be rolled back, and the page on confirmation says about 5 percent of blocks are never finalized.`, a.title);
      else if (a.commitment === 'confirmed') add('solana-commitment-confirmed', where, `${Of} marks an invoice paid at the confirmed commitment. A confirmed block has the votes of a supermajority of the stake but is not yet finalized; the Solana page on confirmation says only the finalized level takes away the risk of a dropped fork.`, a.title);
    }

    // The token contract and its decimals.
    if (a.kind === 'token') {
      const family = net ? net.family : null;
      let wellFormed = false;
      if (a.contractEntry === null) {
        add('token-contract-missing', at(a), `${Of} is a token with no contract address, so a token of any contract named ${a.name ?? 'the same'} could pay an invoice. Circle's page of USDC contract addresses asks for every address on a mainnet to be checked.`, a.title);
      } else if (a.contract !== null && family !== null) {
        const problem = contractProblem(family, a.contract);
        if (problem) add('token-contract-malformed', at(a.contractEntry), `The contract of ${of} is "${shown(a.contract)}", which ${problem}; on ${net.title} it is ${CONTRACT_FORMS[family]}. ${BP}`, a.title);
        else wellFormed = true;
      }
      const token = a.name === null ? null : officialToken(a.name);
      const official = token && net ? officialAddress(token, net.id) : null;
      if (token && net && !official) unlisted.push(a.title);
      if (official && wellFormed && !sameAddress(family, a.contract, official.address)) {
        add('token-contract-not-official', at(a.contractEntry), `The contract of ${of} is ${a.contract}, but Circle's page of USDC contract addresses lists ${official.address} for ${official.title}: payments in another token named ${token.symbol} would be counted as ${token.symbol}.`, a.title);
      }
      if (official && a.decimals !== null && a.decimals !== token.decimals) {
        const factor = 10n ** BigInt(Math.abs(a.decimals - token.decimals));
        add('token-decimals-mismatch', at(a.decimalsEntry), `${Of} has ${a.decimals} decimals, but the Circle quickstart for Solana says ${token.symbol} carries ${token.decimals}: every amount read is ${a.decimals > token.decimals ? 'too small' : 'too large'} by a factor of ${grouped(factor)}, so ${a.decimals > token.decimals ? 'a full payment looks like an underpayment' : 'a small payment looks like a full one'}.`, a.title);
      }
    }

    // The deposit address.
    if (a.depositAddress === 'shared' && (a.reference === null || a.reference === 'none')) {
      add('deposit-address-shared', at(a.depositEntry), `${Of} takes the payments of every invoice at one shared address and asks for no memo or reference key, so two customers who pay the same amount cannot be told apart, and a payment can be counted for the wrong invoice or for none. ${BP}`, a.title);
    }
  }
  if (unlisted.length) notes.push(`Circle's page of USDC contract addresses lists no address for ${unlisted.join(', ')}, so the contract was checked for its form only`);

  // The invoice.
  const inv = config.invoice;
  if (inv) {
    if (inv.expirySecondsEntry === null || inv.expirySeconds === 0) {
      add('invoice-expiry-missing', at(inv.expirySecondsEntry ?? inv), `The invoice ${inv.expirySecondsEntry === null ? 'has no expirySeconds' : 'expires after 0 seconds'}, so a total priced in ${config.currency ?? 'a national currency'} ${inv.expirySecondsEntry === null ? 'stays open while the rate moves and a payer can wait for a better price' : 'cannot be paid in time'}. The Bitcoin developer guide says such an invoice has to expire, and that processors use 10 to 20 minutes.`);
    } else if (inv.expirySeconds !== null) {
      const exp = inv.expirySeconds;
      // The time to be paid is compared only when the invoice must be paid, not only detected, before it expires.
      for (const a of inv.expiryRequires === 'paid' ? config.assets : []) {
        const t = timeToPaid(a);
        if (t !== null && exp * 1000 < t) {
          const own = !a.network.blockDocumented ? ` The time of a block of ${a.network.title} is the tool's own figure.` : '';
          const how = a.commitment === 'finalized' ? 'reach the finalized checkpoint' : `reach ${grouped(a.confirmations)} ${a.confirmations === 1 ? 'confirmation' : 'confirmations'}`;
          add('invoice-expiry-below-confirmation-time', at(inv.expirySecondsEntry), `The invoice expires after ${duration(exp)}, but a payment in asset ${a.title} takes about ${span(t)} to ${how}: ${inv.expiryRequiresEntry === null ? 'the invoice gives no expiryRequires, so it is read as one that must be paid before it expires, and ' : 'the invoice must be paid before it expires, so '}a payment sent on time can run out before it is marked paid, and the payer is asked for more or refunded by hand. The Bitcoin developer guide warns of this with a short expiry.${own}`, a.title);
        }
      }
      if (inv.rateLockSeconds !== null && inv.rateLockSeconds > exp) {
        add('rate-lock-exceeds-expiry', at(inv.rateLockSecondsEntry), `The quoted rate is held for ${duration(inv.rateLockSeconds)}, longer than the ${duration(exp)} the invoice runs, so a quote outlives its invoice and a payment after the expiry can still be priced at it. ${BP}`);
      }
    }
    const missing = [];
    for (const [key, word] of [['underpaymentTolerance', 'underpayment'], ['overpaymentTolerance', 'overpayment']]) {
      if (inv[`${key}Entry`] === null) missing.push(`no ${key}`);
      else if (inv[`${key}Negative`]) add('payment-tolerance-missing', at(inv[`${key}Entry`]), `The ${key} of the invoice is negative, so no ${word} tolerance is defined and an exact payment may fall outside it. ${BP}`);
    }
    if (missing.length) add('payment-tolerance-missing', at(inv), `The invoice has ${missing.join(' and ')}, so what the checkout does with a payment that is a little short or a little over is not written down: it may be lost, refused or counted in full. ${BP}`);
  }

  // The webhook.
  const hook = config.webhook;
  if (hook) {
    if (hook.scheme !== null && hook.scheme !== 'https') {
      add('webhook-not-https', at(hook.urlEntry), `The webhook URL uses ${hook.scheme}, not https, so payment events cross the network in clear text and can be read or changed on the way. Stripe asks for a public HTTPS address and allows plain HTTP only on a developer's own machine.`);
    }
    if (hook.signatureEntry === null || hook.signature === 'none') {
      add('webhook-unsigned', at(hook.signatureEntry ?? hook), `The webhook ${hook.signatureEntry === null ? 'has no signature' : 'is not signed (signature "none")'}, so anyone who learns its URL can post an event that marks an invoice paid. Stripe and GitHub sign every delivery with HMAC-SHA256 and ask the receiver to check it.`);
    } else if (hook.signature !== null && !STRONG_SIGNATURES.includes(hook.signature)) {
      const weak = WEAK_SIGNATURES.includes(hook.signature);
      add('webhook-weak-signature', at(hook.signatureEntry), `The webhook is signed with "${shown(hook.signatureText.trim())}", ${weak ? 'which is weaker than HMAC-SHA256' : 'an algorithm the tool does not know'}. GitHub keeps HMAC-SHA1 for older code only and signs with HMAC-SHA256, as Stripe does.`);
    }
    if (hook.timestampToleranceEntry === null || hook.timestampTolerance === 0) {
      add('webhook-replay-unprotected', at(hook.timestampToleranceEntry ?? hook), `The webhook ${hook.timestampToleranceEntry === null ? 'has no timestampTolerance' : 'has a timestampTolerance of 0'}, so a payment event captured once can be sent again later and still pass. Stripe signs a timestamp with each event, allows 5 minutes by default and says a tolerance of 0 turns the check off.`);
    }
    if (hook.idempotencyKeyEntry === null) {
      add('webhook-idempotency-missing', at(hook), 'The webhook names no idempotencyKey, so an event delivered twice can count one payment twice. Stripe says an endpoint may receive an event more than once and asks it to skip the ids it has handled.');
    }
    if (hook.retryEntry === null || (hook.retry && hook.retry.maxAttempts === 0)) {
      add('webhook-retry-missing', at(hook.retry && hook.retry.maxAttemptsEntry ? hook.retry.maxAttemptsEntry : hook.retryEntry ?? hook), `The webhook ${hook.retryEntry === null ? 'has no retry policy' : 'retries 0 times'}, so a payment event lost to one failed delivery is never sent again and the invoice stays unpaid. Stripe retries for up to three days with exponential back off.`);
    }
  }

  // The refunds.
  const ref = config.refunds;
  if (ref && ref.enabled === true && ref.destination !== null) {
    if (ref.destination === 'sender') {
      add('refund-to-sender', at(ref.destinationEntry), 'Refunds go back to the address the payment came from. The Bitcoin developer guide calls this very unsafe: the payment may have come from an exchange or a shared wallet that cannot tell which of its users the refund is for, and asks the payer for a refund address instead.');
    } else if (ref.review !== true) {
      add('refund-address-unreviewed', at(ref.reviewEntry ?? ref.destinationEntry), `Refunds go to ${ref.destination === 'operator' ? 'an address an operator enters' : 'an address the customer gives'}, not the sender, and ${ref.reviewEntry === null ? 'the refunds have no review' : 'review is off'}, so a refund can be sent to an address that someone who took over the order asked for. ${BP}`);
    }
  }

  const unread = config.assets.filter((a) => a.network !== null && a.confirmations === null && a.commitment === null).map((a) => a.title);
  if (unread.length) notes.push(`what marks ${unread.length === 1 ? 'an invoice' : 'invoices'} paid could not be read for ${unread.join(', ')}, so ${unread.length === 1 ? 'it was' : 'they were'} not checked for confirmations, finality or the time to be paid`);

  const rows = config.assets.map((a) => {
    const t = timeToPaid(a);
    const token = a.kind === 'token' && a.name !== null ? officialToken(a.name) : null;
    const official = token && a.network ? officialAddress(token, a.network.id) : null;
    let contract = null;
    if (a.kind === 'token') {
      if (a.contract === null) contract = a.contractEntry === null ? 'missing' : null;
      else if (a.network && contractProblem(a.network.family, a.contract)) contract = 'malformed';
      else if (official) contract = sameAddress(a.network.family, a.contract, official.address) ? 'official' : 'not official';
      else contract = 'form only';
    }
    return {
      asset: a.name ?? a.title,
      network: a.network ? a.network.id : a.networkText,
      kind: a.kind,
      decimals: a.decimals,
      paidAt: a.commitment !== null ? a.commitment : a.confirmations !== null ? `${a.confirmations} conf` : null,
      toPaid: t === null ? null : span(t),
      maxAmount: a.maxAmount === null ? null : formatDecimal(a.maxAmount),
      deposit: a.depositAddress === null ? null : a.depositAddress === 'shared' && a.reference !== null && a.reference !== 'none' ? `shared, ${a.reference}` : a.depositAddress,
      contract
    };
  });
  return { findings, notes, rows };
}
