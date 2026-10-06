import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_FORMS, DECIMAL_LIMITS, FAMILIES, NETWORKS, OFFICIAL_TOKENS, SOLANA_COMMITMENTS, compareDecimal, contractProblem, formatDecimal, isZero, networkOf, officialAddress, officialToken, parseDecimal, sameAddress } from '../src/index.js';
import { USDC, addr, tron } from './helpers.js';

const d = (raw) => parseDecimal(raw);

test('parseDecimal: plain decimals into a whole number and a scale', () => {
  assert.deepEqual(d('0'), { int: 0n, scale: 0 });
  assert.deepEqual(d('2500'), { int: 2500n, scale: 0 });
  assert.deepEqual(d('0.5'), { int: 5n, scale: 1 });
  assert.deepEqual(d('1.050'), { int: 1050n, scale: 3 });
  assert.deepEqual(d(`${'9'.repeat(40)}.${'1'.repeat(40)}`).scale, 40);
});

test('parseDecimal: a sign, an exponent, a leading zero, a lone point and too many digits are refused', () => {
  for (const raw of ['-1', '+1', '1e3', '1E-2', '01', '00.5', '.5', '5.', '', ' 1', '1,000', `1${'0'.repeat(40)}`, `0.${'1'.repeat(41)}`, '0x10', 'NaN', 'Infinity']) assert.equal(parseDecimal(raw), null, raw);
  assert.equal(DECIMAL_LIMITS.maxDigits, 40);
});

test('compareDecimal: compares as written, across scales, with no floating point', () => {
  assert.equal(compareDecimal(d('1000'), d('1000.000')), 0);
  assert.equal(compareDecimal(d('999.99'), d('1000')), -1);
  assert.equal(compareDecimal(d('1000.000000000000000001'), d('1000')), 1, 'a difference a double would lose');
  assert.equal(compareDecimal(d('30'), d('5')), 1);
});

test('formatDecimal and isZero: the shortest form of a decimal', () => {
  assert.equal(formatDecimal(d('1.050')), '1.05');
  assert.equal(formatDecimal(d('1.000')), '1');
  assert.equal(formatDecimal(d('0.01')), '0.01');
  assert.equal(formatDecimal(d('50000')), '50000');
  assert.equal(formatDecimal(d('0.000')), '0');
  assert.ok(isZero(d('0.00')));
  assert.ok(!isZero(d('0.01')));
});

test('networkOf: by id or alias, in any case and with outer spaces; a network out of the table is null', () => {
  assert.equal(networkOf('Bitcoin').id, 'bitcoin');
  assert.equal(networkOf(' btc ').id, 'bitcoin');
  assert.equal(networkOf('arbitrum-one').id, 'arbitrum');
  assert.equal(networkOf('matic').id, 'polygon');
  assert.equal(networkOf('SOL').family, 'solana');
  assert.equal(networkOf('trx').family, 'tron');
  assert.equal(networkOf('litecoin'), null);
  assert.equal(networkOf('toString'), null);
});

test('the table of networks: unique ids and aliases, a family each, and the numbers the pages give marked as documented', () => {
  const names = NETWORKS.flatMap((n) => [n.id, ...n.aliases]);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(NETWORKS.map((n) => n.id), ['bitcoin', 'ethereum', 'polygon', 'arbitrum', 'base', 'solana', 'tron']);
  for (const n of NETWORKS) {
    assert.ok(FAMILIES.includes(n.family), n.id);
    assert.ok(n.blockMs > 0, n.id);
  }
  const by = Object.fromEntries(NETWORKS.map((n) => [n.id, n]));
  assert.equal(by.bitcoin.minConfirmations, 6);
  assert.equal(by.bitcoin.documented, true);
  assert.equal(by.bitcoin.blockMs, 600 * 1000);
  assert.equal(by.ethereum.blockMs, 12 * 1000);
  assert.equal(by.ethereum.finalMs, 64 * 12 * 1000);
  assert.equal(by.solana.blockMs, 400);
  assert.equal(by.solana.minConfirmations, null);
  assert.deepEqual(NETWORKS.filter((n) => n.blockDocumented).map((n) => n.id), ['bitcoin', 'ethereum', 'solana']);
  assert.deepEqual(NETWORKS.filter((n) => n.minConfirmations !== null && !n.documented).map((n) => n.id), ['ethereum', 'polygon', 'arbitrum', 'base', 'tron']);
  assert.deepEqual(SOLANA_COMMITMENTS, ['processed', 'confirmed', 'finalized']);
});

test('contractProblem: the form of an address on an EVM network, on Solana and on Tron, with near misses', () => {
  assert.equal(contractProblem('evm', addr('1')), null);
  assert.equal(contractProblem('evm', USDC.base), null);
  assert.equal(contractProblem('evm', '0x8335'), 'has 4 characters after 0x, not 40');
  assert.equal(contractProblem('evm', `0x${'1'.repeat(41)}`), 'has 41 characters after 0x, not 40');
  assert.equal(contractProblem('evm', '1'.repeat(42)), 'does not start with 0x');
  assert.equal(contractProblem('evm', `0x${'g'.repeat(40)}`), 'holds a character that is not a hex digit');
  assert.equal(contractProblem('evm', addr('0')), 'is the zero address');
  assert.equal(contractProblem('evm', ` ${addr('1')}`), 'has spaces around it');
  assert.equal(contractProblem('solana', USDC.solana), null);
  assert.equal(contractProblem('solana', 'H'.repeat(32)), null);
  assert.equal(contractProblem('solana', 'H'.repeat(31)), 'has 31 characters, not 32 to 44');
  assert.equal(contractProblem('solana', 'H'.repeat(45)), 'has 45 characters, not 32 to 44');
  assert.match(contractProblem('solana', `0${'H'.repeat(40)}`), /base58 does not use/);
  assert.equal(contractProblem('tron', tron()), null);
  assert.equal(contractProblem('tron', `X${'H'.repeat(33)}`), 'does not start with T');
  assert.equal(contractProblem('tron', `T${'H'.repeat(32)}`), 'has 33 characters, not 34');
  assert.match(contractProblem('tron', `T${'l'.repeat(33)}`), /base58 does not use/);
  assert.equal(contractProblem('utxo', 'anything'), null);
  assert.deepEqual(Object.keys(CONTRACT_FORMS), ['evm', 'solana', 'tron']);
});

test('the official tokens: USDC with 6 decimals and an address on five networks of the table', () => {
  assert.deepEqual(OFFICIAL_TOKENS.map((t) => t.symbol), ['USDC']);
  const usdc = officialToken(' usdc ');
  assert.equal(usdc.decimals, 6);
  assert.equal(officialToken('USDC.e'), null);
  assert.equal(officialToken('USDT'), null);
  assert.deepEqual(usdc.addresses.map((a) => a.network), ['ethereum', 'polygon', 'arbitrum', 'base', 'solana']);
  for (const a of usdc.addresses) {
    assert.ok(networkOf(a.network), a.network);
    assert.equal(a.address, USDC[a.network]);
    assert.equal(contractProblem(networkOf(a.network).family, a.address), null, a.network);
  }
  assert.equal(officialAddress(usdc, 'tron'), null);
  assert.equal(officialAddress(usdc, 'base').address, USDC.base);
});

test('sameAddress: without case on an EVM network, as written on Solana', () => {
  assert.ok(sameAddress('evm', USDC.ethereum, USDC.ethereum.toLowerCase()));
  assert.ok(!sameAddress('evm', USDC.ethereum, addr('1')));
  assert.ok(sameAddress('solana', USDC.solana, USDC.solana));
  assert.ok(!sameAddress('solana', USDC.solana, USDC.solana.toLowerCase()));
});
