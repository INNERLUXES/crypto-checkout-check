# Sources

The public pages the documented checks of this tool are based on, each with a short note in this project's own words on
what the page says and which checks lean on it. Nothing here is a copy of a page: read the page itself for its exact
wording. A plain text copy of each page, taken when it was read, is kept in [research/sources](sources) so that a point
can be checked against the page it came from, and the copies are the pages' own words, not this project's. src/data.js
holds the pages and the points the reports show, and test/data.test.js checks that every page in src/data.js is listed
here and has its copy, that no point quotes its page at length, that every USDC address of src/tokens.js is the one the
copy of Circle's page lists, and that every number src/networks.js marks as documented is in its page.

The tool reads a checkout configuration and runs nothing; its result is an input to a review before the checkout goes
live: not a security audit and not a guarantee that no payment will be lost or counted twice. These notes say what the
pages say so a reader can follow a finding back to its source. The pages were chosen with web addresses that hold no
number that reads like a year, and each was read in a form the site or its repository serves as text: the source of the
page in its repository for the Bitcoin developer guide and for ethereum.org, the markdown the site serves for the Solana,
Circle and Stripe pages, and the body of the article that the GitHub documentation serves through its API.

Where a check rests on a statement the pages do not make, it is a best practice of this tool, its message says so, and
the note for the check in [docs/rules-and-sources.md](../docs/rules-and-sources.md) names the choice. No page gives a
number of confirmations for Ethereum, Polygon PoS, Arbitrum, Base or Tron, a rule for the form of a token address in a
configuration, a rule for a deposit address shared between invoices, a rule on how long a rate is held, a rule on
tolerances, or a rule on the review of a refund; those checks are best practices of this tool, and the confirmations of
those networks are the tool's own starting points that `--min-confirmations` changes.

## What the copies leave out

Each copy is the text of the page as it was read, with a two-line header that names its address and how it was read,
and with these lines left out, so that no copy holds a date, a number that reads like a year or a word this project
keeps out of every file, and every copy is plain ASCII (decision 1 in docs/decisions):

- Bitcoin Developer Guide, Payment Processing: the line of the example payment request that gives a date to pay by, and
  the line on two confirmations, which dates its statement. No check leans on either.
- ethereum.org, Proof-of-stake: the opening paragraph, which names the year Ethereum moved to proof-of-stake; the
  paragraph on the cost of reverting a finalized block, which links to a dated blog post; the paragraph on fork choice,
  whose link to a paper holds a number that reads like a year; the line that names the month and year of the move in
  the section that compares proof-of-stake with proof-of-work; and the three dated links of the list of further reading. The point `ethereum-finality` rests on the section on finality that
  is kept.
- Circle, USDC contract addresses, and Circle, Quickstart: Transfer USDC on Solana: the block the documentation site puts
  above every page, made of a pointer to an index of the documentation for automated readers and a list of instructions
  addressed to such readers, which names products of other companies and words this project keeps out of every file. The
  table of addresses and the note on decimals are kept whole.
- Stripe, webhooks: the two lines of the examples that send an API version made of a date, and the paragraph on API
  versions, which gives an older version made of a date. No check leans on them.
- Every copy: curly quotes and dashes are written as ASCII quotes and hyphens, a warning sign written as an emoji in a
  code example of the Stripe page is left out, and the arrows and multiplication signs of the pages are written as ASCII.

The pages of Circle on USDC in general and on transfers on EVM chains were read and not kept: neither states the
decimals of USDC, and no check leans on them.

## Bitcoin

### Bitcoin Developer Guide: Payment Processing

https://developer.bitcoin.org/devguide/payment_processing.html

Copy: research/sources/bitcoin-developer-guide-payment-processing.txt

How a merchant prices an order, asks for a payment, checks it and refunds it. Orders priced in a national currency must
expire so a payer cannot wait for the rate to move, processors let invoices run for 10 to 20 minutes, and a shorter
expiry makes it more likely that a payment comes after the invoice ran out. The payment request it walks through pays a
public key never used before. A payment with no confirmation is not to be trusted without an analysis of the risk; the
first confirmation takes ten minutes on average; and software that takes payments of high value waits for six
confirmations, a number the guide calls somewhat arbitrary. Sending a refund back to where a payment came from is called
very unsafe, and the guide asks the payer for a refund address. `confirmations-below-documented`,
`invoice-expiry-missing`, `invoice-expiry-below-confirmation-time`, `rate-lock-exceeds-expiry`,
`payment-tolerance-missing`, `deposit-address-shared`, `refund-to-sender` and `refund-address-unreviewed` lean on it, and
the six confirmations and the ten minutes of src/networks.js come from it.

## Ethereum

### ethereum.org: Proof-of-stake (PoS)

https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/

Copy: research/sources/ethereum-org-proof-of-stake.txt

How proof-of-stake Ethereum orders and finalizes blocks: slots of 12 seconds, epochs of 32 slots, a checkpoint at the
start of each epoch, and finality reached when a checkpoint is first justified and then finalized by votes of two thirds
of the staked ether. `paid-before-finality` and `invoice-expiry-below-confirmation-time` lean on it, and
`evm-paid-before-finality` names it as the basis of a choice of the tool's own. The twelve seconds of src/networks.js come
from it, and the time to the finalized checkpoint, two epochs, is the tool's reading of its slots and epochs.

## Solana

### Solana: RPC overview, Configuring State Commitment

https://solana.com/docs/rpc

Copy: research/sources/solana-rpc-overview-commitment.txt

The three commitment levels of Solana RPC: processed, the newest block of a node, which can still be rolled back;
confirmed, a block voted on by more than two thirds of the stake; and finalized, a block at maximum lockout.
`solana-commitment-processed` and `solana-commitment-confirmed` lean on it.

### Solana: Transaction Confirmation & Expiration

https://solana.com/developers/guides/advanced/confirmation

Copy: research/sources/solana-transaction-confirmation-and-expiration.txt

How a transaction is confirmed and when it expires. Slots are set to about 400 milliseconds and vary between 400 and 600;
about 5 percent of blocks are never finalized because they fall on a dropped fork; the finalized level removes that risk
and trails the confirmed one by 32 slots or more. `solana-commitment-processed`, `solana-commitment-confirmed` and
`invoice-expiry-below-confirmation-time` lean on it, and the 400 milliseconds of src/networks.js come from it.

## Circle

### Circle: USDC contract addresses

https://developers.circle.com/stablecoins/usdc-contract-addresses

Copy: research/sources/circle-usdc-contract-addresses.txt

The addresses of the USDC contract or mint on every mainnet and testnet Circle supports, with a warning that addresses on
a mainnet must be verified because the tokens hold value. The addresses of src/tokens.js for Ethereum, Polygon PoS,
Arbitrum, Base and Solana are copied from its table of mainnets; the page lists no USDC on Tron.
`token-contract-missing` and `token-contract-not-official` lean on it.

### Circle: Quickstart: Transfer USDC on Solana

https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana

Copy: research/sources/circle-quickstart-transfer-usdc-on-solana.txt

A script that sends USDC on Solana Devnet, with a note that USDC uses 6 decimal places, so one USDC is 1,000,000 of its
smallest unit. `token-decimals-mismatch` leans on it.

## Webhooks

### Stripe: Receive Stripe events in your webhook endpoint

https://docs.stripe.com/webhooks

Copy: research/sources/stripe-webhooks.txt

How Stripe delivers events to an endpoint and how the endpoint checks them: public HTTPS endpoints, with plain HTTP only
while an endpoint runs on a developer's machine; a signature made with HMAC and SHA-256 under the secret of the endpoint,
without which an attacker could post false events; a signed timestamp against replay, with a default tolerance of 5
minutes and a warning that a tolerance of 0 turns the check off; events that can arrive more than once, to be told apart
by their ids; and retries for up to three days with exponential back off. `webhook-not-https`, `webhook-unsigned`,
`webhook-weak-signature`, `webhook-replay-unprotected`, `webhook-idempotency-missing` and `webhook-retry-missing` lean on
it.

### GitHub Docs: Validating webhook deliveries

https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

Copy: research/sources/github-validating-webhook-deliveries.txt

How a receiver checks a delivery from GitHub: a secret token of high entropy kept in a safe place and never written into
code or pushed to a repository, a signature with HMAC-SHA256 in the `X-Hub-Signature-256` header, the HMAC-SHA1 header
kept for older code only, and a comparison in constant time. `webhook-unsigned` and `webhook-weak-signature` lean on it,
and `secret-in-config` names it in docs/rules-and-sources.md.
