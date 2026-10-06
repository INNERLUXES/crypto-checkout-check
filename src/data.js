// The public pages the checks rest on, and the points of each page that the reports show, written in this project's own
// words. A page is named by its address; a copy of its text, read before it was listed, is kept under research/sources.
// research/sources.md lists every page with a note, docs/rules-and-sources.md lists every rule with its points, and
// test/data.test.js checks the three against each other.

export const LEVELS = ['info', 'warning', 'error'];

export const NOT_A = 'not a security audit and not a guarantee that no payment will be lost or counted twice';

export const NOTICE = `This report is an input to a review before the checkout goes live: ${NOT_A}.`;

export const SOURCES = [
  { id: 'bitcoin-payments', title: 'Bitcoin Developer Guide: Payment Processing', url: 'https://developer.bitcoin.org/devguide/payment_processing.html', file: 'research/sources/bitcoin-developer-guide-payment-processing.txt' },
  { id: 'ethereum-pos', title: 'ethereum.org: Proof-of-stake (PoS)', url: 'https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/', file: 'research/sources/ethereum-org-proof-of-stake.txt' },
  { id: 'solana-rpc', title: 'Solana: RPC overview, Configuring State Commitment', url: 'https://solana.com/docs/rpc', file: 'research/sources/solana-rpc-overview-commitment.txt' },
  { id: 'solana-confirmation', title: 'Solana: Transaction Confirmation & Expiration', url: 'https://solana.com/developers/guides/advanced/confirmation', file: 'research/sources/solana-transaction-confirmation-and-expiration.txt' },
  { id: 'circle-addresses', title: 'Circle: USDC contract addresses', url: 'https://developers.circle.com/stablecoins/usdc-contract-addresses', file: 'research/sources/circle-usdc-contract-addresses.txt' },
  { id: 'circle-solana', title: 'Circle: Quickstart: Transfer USDC on Solana', url: 'https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana', file: 'research/sources/circle-quickstart-transfer-usdc-on-solana.txt' },
  { id: 'stripe-webhooks', title: 'Stripe: Receive Stripe events in your webhook endpoint', url: 'https://docs.stripe.com/webhooks', file: 'research/sources/stripe-webhooks.txt' },
  { id: 'github-webhooks', title: 'GitHub Docs: Validating webhook deliveries', url: 'https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries', file: 'research/sources/github-validating-webhook-deliveries.txt' }
];

// Points: id -> { source, text }.
export const POINTS = {
  'bitcoin-six': { source: 'bitcoin-payments', text: 'The guide asks software that takes payments of high value, or that is otherwise open to fraud, to wait for six confirmations or more before it treats a payment as accepted, and calls the number somewhat arbitrary.' },
  'bitcoin-zero': { source: 'bitcoin-payments', text: 'A payment with no confirmation has only been broadcast; the guide says not to trust one without an analysis of the risk, since a fraudster may get a different version of it into a block.' },
  'bitcoin-block-time': { source: 'bitcoin-payments', text: 'A payment with a fee that is high enough waits ten minutes on average for its first confirmation, and since the newest block is often replaced by accident, one confirmation still leaves room for a double spend.' },
  'bitcoin-expiry': { source: 'bitcoin-payments', text: 'An order priced in a national currency and paid in bitcoin has to expire, or the payer can wait for the price to move; the guide says payment processors let invoices run for 10 to 20 minutes.' },
  'bitcoin-expiry-tradeoff': { source: 'bitcoin-payments', text: 'With a shorter expiry an invoice is more likely to run out before the payment arrives, which may mean asking for more or refunding by hand; with a longer one the rate has more time to move.' },
  'bitcoin-unique-key': { source: 'bitcoin-payments', text: 'In the payment request the guide walks through, the merchant asks to be paid to a script with a public key that was never used before, and that key also serves to find the details of the order.' },
  'bitcoin-refund': { source: 'bitcoin-payments', text: 'Sending a refund back to the script the payment came from is called very unsafe, because a shared web wallet may not know which of its users it is for; the guide asks the payer for a refund address instead.' },
  'ethereum-finality': { source: 'ethereum-pos', text: 'On proof-of-stake Ethereum a block is final once a checkpoint above it has passed two votes of two thirds of the staked ether, first justified and then finalized, after which undoing it would burn a large share of the stake.' },
  'ethereum-slots': { source: 'ethereum-pos', text: 'Proof-of-stake Ethereum divides time into slots of 12 seconds and epochs of 32 slots, and its checkpoints, the blocks that finality is decided on, are the first block of each epoch.' },
  'solana-levels': { source: 'solana-rpc', text: 'Solana RPC has three commitment levels: processed, the newest block of the node, which can still be rolled back; confirmed, a block voted on by more than two thirds of the stake; and finalized, a block at maximum lockout.' },
  'solana-forks': { source: 'solana-confirmation', text: 'The guide says about 5 percent of blocks are never finalized because they sit on a fork that is dropped, that the finalized level takes that risk away, and that it trails the confirmed level by 32 slots or more.' },
  'solana-slots': { source: 'solana-confirmation', text: 'A slot of Solana is set to about 400 milliseconds and may vary between 400 and 600.' },
  'circle-addresses': { source: 'circle-addresses', text: 'Circle lists the address of the USDC contract or mint on each mainnet it supports, Ethereum, Polygon PoS, Arbitrum, Base and Solana among them, and asks for every address on a mainnet to be checked, since the tokens hold real value.' },
  'circle-decimals': { source: 'circle-solana', text: 'The Circle quickstart for Solana says USDC carries 6 decimals, so that one USDC is the amount 1,000,000 in the smallest unit.' },
  'stripe-https': { source: 'stripe-webhooks', text: 'Stripe delivers events over HTTPS, wants a public HTTPS address before it registers an endpoint, and allows plain HTTP only while the endpoint runs on the machine of a developer.' },
  'stripe-signature': { source: 'stripe-webhooks', text: 'Every event carries a signature made with HMAC and SHA-256 under the secret of the endpoint; unchecked, the page says, an attacker could post false events that fulfil orders or change records.' },
  'stripe-replay': { source: 'stripe-webhooks', text: 'To stop a replay, the signed header holds a timestamp, and a payload whose signature is valid but whose timestamp is old can be refused; the libraries allow 5 minutes, and a tolerance of 0 switches the check off.' },
  'stripe-duplicates': { source: 'stripe-webhooks', text: 'An endpoint can receive one event more than once, so the page asks it to record the ids of the events it has handled and to pass over an event whose id it already has.' },
  'stripe-retries': { source: 'stripe-webhooks', text: 'In live mode Stripe goes on trying to deliver an event for up to three days with exponential back off, and an event can also be sent again by hand.' },
  'github-sha256': { source: 'github-webhooks', text: 'GitHub signs each delivery with HMAC-SHA256 in the X-Hub-Signature-256 header, keeps the HMAC-SHA1 header for older code only, and asks for the two hashes to be compared in constant time.' },
};

export const source = (id) => SOURCES.find((s) => s.id === id);
export const pointPage = (id) => source(POINTS[id].source);
