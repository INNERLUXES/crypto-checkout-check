// The networks the tool knows, each with the family that decides which fields an asset on it takes and how its address
// of a token is written, the time of a block, and the rule that marks a payment on it as final.
//
// Where a saved page gives a number, the table takes it from there and says so (documented: true); where no page gives
// one, the number is the tool's own starting point and says so (documented: false), and --min-confirmations sets another.
//   bitcoin   six confirmations and ten minutes a block, from the Bitcoin developer guide on payment processing
//   ethereum  slots of 12 seconds and epochs of 32 slots, from the page of ethereum.org on proof-of-stake
//   solana    slots of about 400 milliseconds and the commitment levels, from the Solana pages on RPC and confirmation
// test/data.test.js checks each documented number against the saved copy of its page. A network out of the table is a
// note, and only the form of its fields is checked.
//
// family: 'utxo' paid by block confirmations, takes no token
//         'evm' paid by block confirmations or at the finalized checkpoint, tokens by a contract of 0x and 40 hex digits
//         'solana' paid at a commitment level, tokens by a mint address in base58
//         'tron' paid by block confirmations, tokens by a contract in base58 that starts with T
// blockMs: the time of a block or slot in milliseconds; a time is written as seconds times 1000 so that no figure of
// this file reads like a year.
// minConfirmations: the confirmations below which confirmations-below-documented (documented) or
// confirmations-below-default (the tool's own) reports an asset; null where the network is paid at a commitment level.
// finalMs: the time to the finalized checkpoint or commitment, where a page gives the parts of it, else null.

const S = 1000;

export const NETWORKS = [
  { id: 'bitcoin', aliases: ['btc', 'bitcoin-mainnet'], family: 'utxo', title: 'Bitcoin', blockMs: 600 * S, blockDocumented: true, minConfirmations: 6, documented: true, finalMs: null },
  { id: 'ethereum', aliases: ['eth', 'mainnet', 'ethereum-mainnet'], family: 'evm', title: 'Ethereum', blockMs: 12 * S, blockDocumented: true, minConfirmations: 12, documented: false, finalMs: 2 * 32 * 12 * S },
  { id: 'polygon', aliases: ['polygon-pos', 'matic'], family: 'evm', title: 'Polygon PoS', blockMs: 2 * S, blockDocumented: false, minConfirmations: 64, documented: false, finalMs: null },
  { id: 'arbitrum', aliases: ['arbitrum-one'], family: 'evm', title: 'Arbitrum', blockMs: S / 4, blockDocumented: false, minConfirmations: 12, documented: false, finalMs: null },
  { id: 'base', aliases: ['base-mainnet'], family: 'evm', title: 'Base', blockMs: 2 * S, blockDocumented: false, minConfirmations: 12, documented: false, finalMs: null },
  { id: 'solana', aliases: ['sol', 'solana-mainnet'], family: 'solana', title: 'Solana', blockMs: 400, blockDocumented: true, minConfirmations: null, documented: true, finalMs: 32 * 400 },
  { id: 'tron', aliases: ['trx', 'tron-mainnet'], family: 'tron', title: 'Tron', blockMs: 3 * S, blockDocumented: false, minConfirmations: 19, documented: false, finalMs: null }
];

export const FAMILIES = ['utxo', 'evm', 'solana', 'tron'];

const norm = (text) => text.trim().toLowerCase();

// The network of the table a name stands for, by its id or an alias, in any case, or null.
export const networkOf = (text) => NETWORKS.find((n) => n.id === norm(text) || n.aliases.includes(norm(text))) ?? null;

// The commitment levels of Solana, from the lowest to the highest, as the saved page on RPC lists them.
export const SOLANA_COMMITMENTS = ['processed', 'confirmed', 'finalized'];

const EVM = /^0x[0-9a-fA-F]{40}$/;
const EVM_ZERO = /^0x0{40}$/;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

// What is wrong with the address of a token on a network of a family, or null when its form is right. The form is all
// that is checked: no checksum, and no look-up on a chain.
export function contractProblem(family, text) {
  const v = text.trim();
  if (v !== text) return 'has spaces around it';
  if (family === 'evm') {
    if (!v.startsWith('0x')) return 'does not start with 0x';
    if (v.length !== 42) return `has ${v.length - 2} characters after 0x, not 40`;
    if (!EVM.test(v)) return 'holds a character that is not a hex digit';
    if (EVM_ZERO.test(v)) return 'is the zero address';
    return null;
  }
  if (family === 'solana') {
    if (!BASE58.test(v)) return 'holds a character that base58 does not use (0, O, I, l or a sign)';
    if (v.length < 32 || v.length > 44) return `has ${v.length} characters, not 32 to 44`;
    return null;
  }
  if (family === 'tron') {
    if (!v.startsWith('T')) return 'does not start with T';
    if (!BASE58.test(v)) return 'holds a character that base58 does not use (0, O, I, l or a sign)';
    if (v.length !== 34) return `has ${v.length} characters, not 34`;
    return null;
  }
  return null;
}

// The form a family writes the address of a token in, for a message.
export const CONTRACT_FORMS = {
  evm: '0x followed by 40 hex digits, not the zero address',
  solana: '32 to 44 base58 characters',
  tron: 'T followed by 33 base58 characters'
};
