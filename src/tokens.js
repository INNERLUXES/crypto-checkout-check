// The tokens whose official addresses the tool knows: USDC, on the networks of the table for which the saved copy of
// Circle's page of USDC contract addresses (research/sources/circle-usdc-contract-addresses.txt) lists a mainnet
// address, copied from that copy, and the decimals Circle's quickstart for Solana gives for USDC
// (research/sources/circle-quickstart-transfer-usdc-on-solana.txt). test/data.test.js checks every address here against
// the saved copy. No other token is in the table: for any other token the address is checked for its form only, and the
// tool keeps no list of addresses of its own.
//
// title: the name of the network in the first column of the table of the page.

export const OFFICIAL_TOKENS = [
  {
    symbol: 'USDC',
    decimals: 6,
    addresses: [
      { network: 'ethereum', title: 'Ethereum', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      { network: 'polygon', title: 'Polygon PoS', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
      { network: 'arbitrum', title: 'Arbitrum', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
      { network: 'base', title: 'Base', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
      { network: 'solana', title: 'Solana', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }
    ]
  }
];

// The official token of a symbol, compared without case and outer spaces, or null. "USDC.e" and other names are not
// USDC.
export const officialToken = (symbol) => OFFICIAL_TOKENS.find((t) => t.symbol.toLowerCase() === symbol.trim().toLowerCase()) ?? null;

// The official address of a token on a network of the table, or null when the page lists none for that network.
export const officialAddress = (token, networkId) => token.addresses.find((a) => a.network === networkId) ?? null;

// Whether an address is the official one: without case on an EVM network, where the case is only a checksum, and as
// written on Solana, where the case is part of the address.
export const sameAddress = (family, a, b) => (family === 'evm' ? a.toLowerCase() === b.toLowerCase() : a === b);
