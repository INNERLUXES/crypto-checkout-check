// Shared test helpers: configurations built inline, checked in memory or written into a temporary folder that is removed
// after the test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS and
// Windows. The line a test expects is found with lineOf(), which counts lines the way the reader does, so a test never
// holds a line number worked out by hand for one system only. No test reads the clock, the time zone or the locale. Every
// address is made up from one repeated character and is not a real contract, except the USDC addresses of the table of
// src/tokens.js, which come from the saved copy of Circle's page.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkText, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'crypto-checkout-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The line (from 1) of the n-th place where needle starts in text.
export function lineOf(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return text.slice(0, at).split('\n').length;
}

// A made-up EVM address of one repeated hex digit.
export const addr = (c) => `0x${c.repeat(40)}`;
// A made-up Tron address: T and 33 of one base58 character.
export const tron = (c = 'H') => `T${c.repeat(33)}`;

// The official USDC addresses, as Circle's page lists them.
export const USDC = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
};

const drop = (out) => {
  for (const [k, v] of Object.entries(out)) if (v === undefined) delete out[k];
  return out;
};

// An asset that passes every check: ETH on Ethereum, paid at the finalized checkpoint; over replaces fields, and a field
// set to undefined is left out.
export const asset = (over = {}) => drop({ name: 'ETH', network: 'ethereum', kind: 'native', decimals: 18, commitment: 'finalized', maxAmount: 25000, depositAddress: 'per-invoice', ...over });

// A USDC asset with the official address of its network.
export const usdc = (network = 'ethereum', over = {}) => asset({ name: 'USDC', network, kind: 'token', contract: USDC[network], decimals: 6, ...over });

// Four assets that pass every check: BTC after six confirmations, ETH and USDC on Ethereum at the finalized checkpoint,
// and USDC on Solana at the finalized commitment with a shared address and a reference key.
export const ASSETS = [
  asset({ name: 'BTC', network: 'bitcoin', decimals: 8, commitment: undefined, confirmations: 6 }),
  asset(),
  usdc('ethereum'),
  usdc('solana', { depositAddress: 'shared', reference: 'reference-key' })
];

export const invoice = (over = {}) => drop({ expirySeconds: 900, expiryRequires: 'detected', rateLockSeconds: 900, underpaymentTolerance: 0.5, overpaymentTolerance: 1, ...over });
export const webhook = (over = {}) => drop({ url: 'https://shop.example/hooks/payments', secretRef: 'env:CHECKOUT_WEBHOOK_SECRET', signature: 'hmac-sha256', timestampTolerance: 300, idempotencyKey: 'event.id', retry: { maxAttempts: 12, backoff: 'exponential' }, ...over });
export const refunds = (over = {}) => drop({ enabled: true, destination: 'customer-provided', review: true, ...over });

// A configuration with every field the checks need; over replaces fields, and a field set to undefined is left out.
export function config(over = {}, assets = ASSETS) {
  return drop({ checkout: 'Test Store', currency: 'USD', assets, invoice: invoice(), webhook: webhook(), refunds: refunds(), ...over });
}

// The configuration with one asset replaced by another, or added when at is past the end.
export const withAsset = (a, at = ASSETS.length) => config({}, [...ASSETS.slice(0, at), a, ...ASSETS.slice(at + 1)]);

export const configText = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

// The findings of a configuration given as an object, through the reader and the checks.
export const findingsOf = (obj, options = {}) => checkText(configText(obj), options).findings;

// The ids of the findings of a configuration.
export const idsOf = (obj, options = {}) => findingsOf(obj, options).map((f) => f.id);

// The findings of one check.
export const ofCheck = (obj, id, options = {}) => findingsOf(obj, options).filter((f) => f.id === id);

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, base) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// Writes the files and runs the command line in the folder.
export async function run(files, args) {
  return withFiles(files, (dir) => cli(args, dir));
}

// A clean configuration, and one whose USDC on Ethereum has 18 decimals, for the command line tests.
export const GOOD = configText(config());
export const BAD = configText(withAsset(usdc('ethereum', { decimals: 18 }), 2));

// The time a hostile test may take: four times as long when the runner collects coverage, which sets NODE_V8_COVERAGE.
export const allowed = (ms) => (process.env.NODE_V8_COVERAGE ? ms * 4 : ms);
