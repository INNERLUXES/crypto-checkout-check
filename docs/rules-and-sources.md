# Rules and sources

Every check of the tool, with what it looks at, the points of the public pages it rests on, what it cannot see, and what to change. The points are in this project's own words and are the ones the reports show with `--explain`; each page was fetched and read before it was listed, and a copy of its text is kept under [research/sources](../research/sources) so that a point can be checked against the page it came from. [../research/sources.md](../research/sources.md) has a note on each page.

The tool is an input to a review before the checkout goes live: not a security audit and not a guarantee that no payment will be lost or counted twice. A check that is a best practice of this tool says so in its message; it is not a rule in the pages it cites.

## The pages

- Bitcoin Developer Guide: Payment Processing: https://developer.bitcoin.org/devguide/payment_processing.html (copy: `research/sources/bitcoin-developer-guide-payment-processing.txt`)
- ethereum.org: Proof-of-stake (PoS): https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/ (copy: `research/sources/ethereum-org-proof-of-stake.txt`)
- Solana: RPC overview, Configuring State Commitment: https://solana.com/docs/rpc (copy: `research/sources/solana-rpc-overview-commitment.txt`)
- Solana: Transaction Confirmation & Expiration: https://solana.com/developers/guides/advanced/confirmation (copy: `research/sources/solana-transaction-confirmation-and-expiration.txt`)
- Circle: USDC contract addresses: https://developers.circle.com/stablecoins/usdc-contract-addresses (copy: `research/sources/circle-usdc-contract-addresses.txt`)
- Circle: Quickstart: Transfer USDC on Solana: https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana (copy: `research/sources/circle-quickstart-transfer-usdc-on-solana.txt`)
- Stripe: Receive Stripe events in your webhook endpoint: https://docs.stripe.com/webhooks (copy: `research/sources/stripe-webhooks.txt`)
- GitHub Docs: Validating webhook deliveries: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries (copy: `research/sources/github-validating-webhook-deliveries.txt`)

## config-unreadable

- Level: error
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: the file is not JSON the reader can follow, or its top level is not an object, so no configuration was read.
- Cannot see: It stops at the first place that is not JSON, or at a top level that is not an object, so nothing in that file is checked.
- What to change: Write the configuration as one JSON object (docs/inputs.md), and fix the line named.
- Points of the pages: none; this check is about the configuration file itself.

## field-missing

- Level: error
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: a field the checks need is not in the configuration: the checkout name, the currency, the assets, the invoice, the webhook or the refunds, a field of an asset, or what marks a payment on its network as paid.
- Cannot see: It names the field and the object that lacks it; it does not guess the value, and the checks that need the field do not run for that part.
- What to change: Add the field named; docs/inputs.md lists what each part of the configuration needs.
- Points of the pages: none; this check is about the configuration file itself.

## field-unknown

- Level: warning
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: a key the tool does not read, often a misspelt one; its value was left out of every check.
- Cannot see: It cannot tell what a misspelt key was meant to say; it names a known key when one is close, and the value is left out of every check.
- What to change: Correct the spelling to a key of docs/inputs.md, or remove the key.
- Points of the pages: none; this check is about the configuration file itself.

## field-invalid

- Level: error
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: a value of the wrong type or form: text where a number belongs, a kind, policy, algorithm or destination the tool does not know, a field the network of the asset does not take, or an amount that is not a plain decimal.
- Cannot see: It names the value and the form it needs; the value is left out of the checks that need it.
- What to change: Write the value as docs/inputs.md shows: text for names, addresses and references, whole numbers for seconds, confirmations and decimals, plain decimal numbers for amounts and percents.
- Points of the pages: none; this check is about the configuration file itself.

## asset-duplicate

- Level: error
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: two assets share a name on one network (compared without case and outer spaces), so a payment cannot be told apart and a reader cannot tell which line a finding comes from.
- Cannot see: It compares names without case and outer spaces, on one network; the same name on two networks is two assets, and two names that differ in other ways, such as USDC and USDC.e, are two assets.
- What to change: Give each asset of a network a name of its own, or merge the two.
- Points of the pages: none; this check is about the configuration file itself.

## secret-in-config

- Level: error
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: the configuration holds a private key, a seed or a mnemonic, or a webhook signing secret written inline instead of the name of a reference to it; the tool never reads it and never shows it.
- Cannot see: It knows keys and seeds by the name of their key and by their shape, and a webhook secret by a key of the webhook named for a secret or by a secretRef that is not shaped like the name of a reference; a secret split over fields, encoded another way or written under another key is not caught. The page of GitHub on validating webhook deliveries says a webhook secret is never to be written into an application or pushed to a repository; this check is about the file and rests on no point.
- What to change: Remove the value from the file and from the history of the repository, treat it as exposed and replace it, and name the webhook secret by a reference such as env:CHECKOUT_WEBHOOK_SECRET.
- Points of the pages: none; this check is about the configuration file itself.

## confirmations-below-documented

- Level: error
- Kind: documented
- Looks at: a Bitcoin asset marks an invoice paid with no confirmation, or with fewer than the six confirmations the Bitcoin developer guide asks for on payments of high value, when its largest invoice is above --large-payment or not given.
- Cannot see: It reads the confirmations and the largest invoice the configuration gives; whether the gateway counts confirmations the way the guide does, and what risk analysis the team made for small payments, are for the review. The guide says six is somewhat arbitrary.
- What to change: Wait for six confirmations before an invoice of high value is paid, or give the asset a maxAmount at or below --large-payment and record the risk analysis the guide asks for.
- Points of the pages:
  - The guide asks software that takes payments of high value, or that is otherwise open to fraud, to wait for six confirmations or more before it treats a payment as accepted, and calls the number somewhat arbitrary. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
  - A payment with no confirmation has only been broadcast; the guide says not to trust one without an analysis of the risk, since a fraudster may get a different version of it into a block. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
  - A payment with a fee that is high enough waits ten minutes on average for its first confirmation, and since the newest block is often replaced by accident, one confirmation still leaves room for a double spend. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)

## confirmations-below-default

- Level: warning
- Kind: best practice
- Looks at: an asset on Ethereum, Polygon PoS, Arbitrum, Base or Tron marks an invoice paid after fewer confirmations than the tool's starting point for the network (--min-confirmations sets another), or after none.
- Cannot see: The numbers of the table for Ethereum, Polygon PoS, Arbitrum, Base and Tron are the tool's own starting points, not numbers from a page; the depth of reorganizations a network sees is not read.
- What to change: Raise the confirmations of the asset, wait for the finalized checkpoint on an EVM network, or set the threshold your team has chosen with --min-confirmations and record why.
- Points of the pages: none.
- The tool's own choice: the number of confirmations for a network other than Bitcoin is a best practice of this tool, not a rule in the pages it cites; none of the saved pages gives one, so the tool starts from its own table and lets --min-confirmations change it.

## solana-commitment-processed

- Level: error
- Kind: documented
- Looks at: a Solana asset marks an invoice paid at the processed commitment, a block that can still be rolled back.
- Cannot see: It reads the commitment the configuration names; whether the gateway queries its node with that commitment is for the review of the code.
- What to change: Mark a Solana invoice paid at the finalized commitment.
- Points of the pages:
  - Solana RPC has three commitment levels: processed, the newest block of the node, which can still be rolled back; confirmed, a block voted on by more than two thirds of the stake; and finalized, a block at maximum lockout. (Solana: RPC overview, Configuring State Commitment, https://solana.com/docs/rpc)
  - The guide says about 5 percent of blocks are never finalized because they sit on a fork that is dropped, that the finalized level takes that risk away, and that it trails the confirmed level by 32 slots or more. (Solana: Transaction Confirmation & Expiration, https://solana.com/developers/guides/advanced/confirmation)

## solana-commitment-confirmed

- Level: warning
- Kind: documented
- Looks at: a Solana asset marks an invoice paid at the confirmed commitment, voted on by a supermajority but not yet finalized.
- Cannot see: It reads the commitment the configuration names; how much of a risk a confirmed block is for the amounts the asset takes is for the team to weigh.
- What to change: Mark a Solana invoice paid at the finalized commitment, which the page on confirmation says removes the risk of a dropped fork, or record why confirmed is enough for the amounts the asset takes.
- Points of the pages:
  - Solana RPC has three commitment levels: processed, the newest block of the node, which can still be rolled back; confirmed, a block voted on by more than two thirds of the stake; and finalized, a block at maximum lockout. (Solana: RPC overview, Configuring State Commitment, https://solana.com/docs/rpc)
  - The guide says about 5 percent of blocks are never finalized because they sit on a fork that is dropped, that the finalized level takes that risk away, and that it trails the confirmed level by 32 slots or more. (Solana: Transaction Confirmation & Expiration, https://solana.com/developers/guides/advanced/confirmation)

## paid-before-finality

- Level: warning
- Kind: documented
- Looks at: an Ethereum asset marks an invoice paid after a count of confirmations instead of at the finalized checkpoint, when its largest invoice is above --large-payment or not given.
- Cannot see: It reads the configuration, not the node: whether the gateway asks for the finalized block when the configuration says "finalized" is for the review of the code. The two epochs it names are read from the slots and epochs of the page.
- What to change: Mark an Ethereum invoice of high value paid once its block is finalized (commitment "finalized"), or give the asset a maxAmount at or below --large-payment.
- Points of the pages:
  - On proof-of-stake Ethereum a block is final once a checkpoint above it has passed two votes of two thirds of the staked ether, first justified and then finalized, after which undoing it would burn a large share of the stake. (ethereum.org: Proof-of-stake (PoS), https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/)
  - Proof-of-stake Ethereum divides time into slots of 12 seconds and epochs of 32 slots, and its checkpoints, the blocks that finality is decided on, are the first block of each epoch. (ethereum.org: Proof-of-stake (PoS), https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/)

## evm-paid-before-finality

- Level: warning
- Kind: best practice
- Looks at: an asset on Polygon PoS, Arbitrum or Base marks an invoice paid after a count of confirmations instead of at the finalized block of the network, when its largest invoice is above --large-payment or not given.
- Cannot see: How each of these networks finalizes a block (a rollup through Ethereum, Polygon PoS through its own checkpoints) is not modelled; the check only asks that a payment of high value waits for what the network calls finalized.
- What to change: Mark an invoice of high value paid once the network reports its block as finalized (commitment "finalized"), or give the asset a maxAmount at or below --large-payment.
- Points of the pages:
  - On proof-of-stake Ethereum a block is final once a checkpoint above it has passed two votes of two thirds of the staked ether, first justified and then finalized, after which undoing it would burn a large share of the stake. (ethereum.org: Proof-of-stake (PoS), https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/)
- The tool's own choice: asking for finality on an EVM network other than Ethereum is a best practice of this tool, not a rule in the pages it cites; the page of ethereum.org describes the finality of Ethereum, and each of these networks finalizes in its own way.

## token-contract-missing

- Level: error
- Kind: documented
- Looks at: a token asset with no contract or mint address, so a token of any contract with the same symbol could pay an invoice.
- Cannot see: It cannot tell which token a symbol stands for; it asks for the address.
- What to change: Give the contract or mint address of the token on the network, copied from the issuer's own list.
- Points of the pages:
  - Circle lists the address of the USDC contract or mint on each mainnet it supports, Ethereum, Polygon PoS, Arbitrum, Base and Solana among them, and asks for every address on a mainnet to be checked, since the tokens hold real value. (Circle: USDC contract addresses, https://developers.circle.com/stablecoins/usdc-contract-addresses)

## token-contract-malformed

- Level: error
- Kind: best practice
- Looks at: a contract or mint address that is not in the form of its network: 0x and 40 hex digits on an EVM network, 32 to 44 base58 characters on Solana, T and 33 base58 characters on Tron.
- Cannot see: It reads the form of the address only: no EIP-55 checksum, no base58 checksum and no look-up on a chain, so a well-formed address of the wrong token passes unless it is USDC on a network Circle lists.
- What to change: Copy the address of the token again from the issuer's own list for the network.
- Points of the pages: none.
- The tool's own choice: reading the form of an address is a best practice of this tool, not a rule in the pages it cites; the pages show addresses in these forms but set no rule for a configuration, and no checksum is checked.

## token-contract-not-official

- Level: error
- Kind: documented
- Looks at: a USDC asset whose contract or mint address is not the one Circle lists for the network, so payments in another token named USDC would be counted.
- Cannot see: It knows the addresses of USDC that the saved copy of Circle's page lists for Ethereum, Polygon PoS, Arbitrum, Base and Solana; another token, USDC on another network, and an address Circle adds after the copy was saved are not compared.
- What to change: Use the address Circle lists for USDC on the network (docs/inputs.md), or rename the asset when it is another token, such as a bridged USDC.e.
- Points of the pages:
  - Circle lists the address of the USDC contract or mint on each mainnet it supports, Ethereum, Polygon PoS, Arbitrum, Base and Solana among them, and asks for every address on a mainnet to be checked, since the tokens hold real value. (Circle: USDC contract addresses, https://developers.circle.com/stablecoins/usdc-contract-addresses)

## token-decimals-mismatch

- Level: error
- Kind: documented
- Looks at: a USDC asset whose decimals are not 6, so every amount it reads is off by a power of ten.
- Cannot see: It knows the decimals of USDC only, from the Circle quickstart for Solana, and applies them to USDC on every network of Circle's page; the decimals of other tokens and of native assets are not judged.
- What to change: Set the decimals of USDC to 6.
- Points of the pages:
  - The Circle quickstart for Solana says USDC carries 6 decimals, so that one USDC is the amount 1,000,000 in the smallest unit. (Circle: Quickstart: Transfer USDC on Solana, https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana)

## deposit-address-shared

- Level: error
- Kind: best practice
- Looks at: an asset takes payments for every invoice at one shared address with no memo or payment reference, so a payment cannot be matched to its invoice.
- Cannot see: It reads the policy the configuration names; whether the gateway refuses a payment without its memo or reference key, and whether a fresh address is really never used twice, is for the review of the code.
- What to change: Issue a fresh deposit address for each invoice, or ask for a memo or reference key that names the invoice and refuse a payment without one.
- Points of the pages:
  - In the payment request the guide walks through, the merchant asks to be paid to a script with a public key that was never used before, and that key also serves to find the details of the order. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
- The tool's own choice: asking for a deposit address or a reference of its own for each invoice is a best practice of this tool, not a rule in the pages it cites; the Bitcoin guide shows a key never used before in its payment request, and the tool applies the idea to every network.

## invoice-expiry-missing

- Level: error
- Kind: documented
- Looks at: the invoice has no expiry, or one of 0 seconds, so a total priced in a national currency stays open while the rate moves.
- Cannot see: It reads the expiry the configuration gives; how the gateway handles a payment that comes after it is not seen.
- What to change: Give the invoice an expiry in seconds; the Bitcoin guide says processors use 10 to 20 minutes.
- Points of the pages:
  - An order priced in a national currency and paid in bitcoin has to expire, or the payer can wait for the price to move; the guide says payment processors let invoices run for 10 to 20 minutes. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
  - With a shorter expiry an invoice is more likely to run out before the payment arrives, which may mean asking for more or refunding by hand; with a longer one the rate has more time to move. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)

## invoice-expiry-below-confirmation-time

- Level: warning
- Kind: documented
- Looks at: the invoice must be paid, not only detected, before it expires (expiryRequires "paid", the default), and it expires sooner than an asset can reach the confirmations or commitment that mark it paid, from the time of a block of its network.
- Cannot see: The time to be paid is worked out from the time of a block in the table and the confirmations or commitment of the asset; the times of Bitcoin, Ethereum and Solana come from the pages, the others are the tool's own figures, and a network out of the table, or a finalized block of a network whose finality the table does not time, is not compared. Blocks come late as well as early.
- What to change: Let the invoice run longer than the time to confirm on every network it accepts, or hold an invoice open once its payment is detected and write expiryRequires "detected".
- Points of the pages:
  - With a shorter expiry an invoice is more likely to run out before the payment arrives, which may mean asking for more or refunding by hand; with a longer one the rate has more time to move. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
  - A payment with a fee that is high enough waits ten minutes on average for its first confirmation, and since the newest block is often replaced by accident, one confirmation still leaves room for a double spend. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
  - Proof-of-stake Ethereum divides time into slots of 12 seconds and epochs of 32 slots, and its checkpoints, the blocks that finality is decided on, are the first block of each epoch. (ethereum.org: Proof-of-stake (PoS), https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/)
  - A slot of Solana is set to about 400 milliseconds and may vary between 400 and 600. (Solana: Transaction Confirmation & Expiration, https://solana.com/developers/guides/advanced/confirmation)

## rate-lock-exceeds-expiry

- Level: warning
- Kind: best practice
- Looks at: the quoted exchange rate is held longer than the invoice runs, so a quote outlives the invoice it was made for.
- Cannot see: It compares two numbers of the configuration; where the rate comes from and how far it can move are not seen.
- What to change: Hold the rate no longer than the invoice runs, and quote again for a payment that comes after.
- Points of the pages:
  - An order priced in a national currency and paid in bitcoin has to expire, or the payer can wait for the price to move; the guide says payment processors let invoices run for 10 to 20 minutes. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
- The tool's own choice: comparing the time a rate is held with the expiry of the invoice is a best practice of this tool, not a rule in the pages it cites; the Bitcoin guide asks for totals in a national currency to expire, not for a rule on how long a rate is held.

## payment-tolerance-missing

- Level: warning
- Kind: best practice
- Looks at: the invoice gives no underpayment or overpayment tolerance, or a negative one, so what happens to a payment that is a little short or over is left to chance.
- Cannot see: It asks for the tolerances to be written down; whether a tolerance is too wide for the business is for the team.
- What to change: Give an underpaymentTolerance and an overpaymentTolerance in percent, from 0, and say what the checkout does with a payment outside them.
- Points of the pages:
  - With a shorter expiry an invoice is more likely to run out before the payment arrives, which may mean asking for more or refunding by hand; with a longer one the rate has more time to move. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
- The tool's own choice: asking for written tolerances is a best practice of this tool, not a rule in the pages it cites; the Bitcoin guide says a late or short payment may need more money or a refund by hand, not how far off a payment may be.

## webhook-not-https

- Level: error
- Kind: documented
- Looks at: the webhook URL does not use https, so payment events travel in clear text and can be changed on the way.
- Cannot see: It reads the scheme of the URL; the certificate, the TLS version and whether the host is public are not checked.
- What to change: Give the webhook a public https URL.
- Points of the pages:
  - Stripe delivers events over HTTPS, wants a public HTTPS address before it registers an endpoint, and allows plain HTTP only while the endpoint runs on the machine of a developer. (Stripe: Receive Stripe events in your webhook endpoint, https://docs.stripe.com/webhooks)

## webhook-unsigned

- Level: error
- Kind: documented
- Looks at: the webhook has no signature, or "none", so anyone who knows the URL can post a payment event that marks an invoice paid.
- Cannot see: It reads the algorithm the configuration names; whether the receiver checks the signature, and in constant time, is for the review of the code.
- What to change: Sign every webhook with HMAC-SHA256 under a secret named by a reference, and refuse an event whose signature does not match.
- Points of the pages:
  - Every event carries a signature made with HMAC and SHA-256 under the secret of the endpoint; unchecked, the page says, an attacker could post false events that fulfil orders or change records. (Stripe: Receive Stripe events in your webhook endpoint, https://docs.stripe.com/webhooks)
  - GitHub signs each delivery with HMAC-SHA256 in the X-Hub-Signature-256 header, keeps the HMAC-SHA1 header for older code only, and asks for the two hashes to be compared in constant time. (GitHub Docs: Validating webhook deliveries, https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

## webhook-weak-signature

- Level: error
- Kind: documented
- Looks at: the webhook is signed with an algorithm other than HMAC-SHA256 or HMAC-SHA512, such as HMAC-SHA1, MD5 or a hash with no key, or with one the tool does not know.
- Cannot see: It knows HMAC-SHA256 and HMAC-SHA512 as strong, a short list of weak algorithms, and treats any other name as unknown; a strong algorithm with a short or reused secret is not caught.
- What to change: Sign webhooks with HMAC-SHA256, and compare signatures in constant time.
- Points of the pages:
  - Every event carries a signature made with HMAC and SHA-256 under the secret of the endpoint; unchecked, the page says, an attacker could post false events that fulfil orders or change records. (Stripe: Receive Stripe events in your webhook endpoint, https://docs.stripe.com/webhooks)
  - GitHub signs each delivery with HMAC-SHA256 in the X-Hub-Signature-256 header, keeps the HMAC-SHA1 header for older code only, and asks for the two hashes to be compared in constant time. (GitHub Docs: Validating webhook deliveries, https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

## webhook-replay-unprotected

- Level: warning
- Kind: documented
- Looks at: the webhook gives no timestamp tolerance, or one of 0, so a payment event captured once can be sent again later.
- Cannot see: It reads the tolerance the configuration gives; whether the timestamp is part of the signed payload, and whether the clocks of the two servers agree, are not seen.
- What to change: Sign a timestamp with every event and refuse one older than a tolerance, such as the 5 minutes of the Stripe libraries.
- Points of the pages:
  - To stop a replay, the signed header holds a timestamp, and a payload whose signature is valid but whose timestamp is old can be refused; the libraries allow 5 minutes, and a tolerance of 0 switches the check off. (Stripe: Receive Stripe events in your webhook endpoint, https://docs.stripe.com/webhooks)

## webhook-idempotency-missing

- Level: error
- Kind: documented
- Looks at: the webhook names no idempotency key, so an event delivered twice can count one payment twice.
- Cannot see: It asks for the field that identifies an event to be named; whether the receiver stores the ids it handled, and for how long, is for the review of the code.
- What to change: Name the field that identifies an event, such as event.id, record each one handled, and skip one seen before.
- Points of the pages:
  - An endpoint can receive one event more than once, so the page asks it to record the ids of the events it has handled and to pass over an event whose id it already has. (Stripe: Receive Stripe events in your webhook endpoint, https://docs.stripe.com/webhooks)

## webhook-retry-missing

- Level: warning
- Kind: documented
- Looks at: the webhook has no retry policy, or one of 0 attempts, so a payment event lost to one failed delivery is never sent again.
- Cannot see: It reads the number of attempts; whether the back off spreads them over enough time to outlast an outage is not judged.
- What to change: Retry failed deliveries with exponential back off over hours or days, and let an operator send an event again by hand.
- Points of the pages:
  - In live mode Stripe goes on trying to deliver an event for up to three days with exponential back off, and an event can also be sent again by hand. (Stripe: Receive Stripe events in your webhook endpoint, https://docs.stripe.com/webhooks)

## refund-to-sender

- Level: warning
- Kind: documented
- Looks at: refunds go back to the address the payment came from, which may belong to an exchange or a shared wallet and not to the payer.
- Cannot see: It reads the destination the configuration names; how the gateway finds the address a payment came from is not seen.
- What to change: Ask the payer for a refund address (destination "customer-provided") instead of sending a refund to the sending address.
- Points of the pages:
  - Sending a refund back to the script the payment came from is called very unsafe, because a shared web wallet may not know which of its users it is for; the guide asks the payer for a refund address instead. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)

## refund-address-unreviewed

- Level: warning
- Kind: best practice
- Looks at: refunds may go to an address other than the sender with no review, so a refund can be sent to an address that someone else asked for.
- Cannot see: It reads the review flag; who reviews a refund, and how, is for the team.
- What to change: Set review to true, so that a person checks a refund to an address that is not the sender before it is sent.
- Points of the pages:
  - Sending a refund back to the script the payment came from is called very unsafe, because a shared web wallet may not know which of its users it is for; the guide asks the payer for a refund address instead. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
- The tool's own choice: asking for a review of a refund to a new address is a best practice of this tool, not a rule in the pages it cites; the Bitcoin guide asks for a refund address from the payer and says nothing of a review.

## network-not-in-table

- Level: info
- Kind: best practice
- Looks at: the network is not in the tool's table of networks, so its confirmations, finality and the form of its token addresses were not judged.
- Cannot see: Whether a network out of the table needs more confirmations or a commitment, and how its token addresses are written, is not judged.
- What to change: Check by hand what marks a payment on the network as final and how its token addresses are written, or name the network as the table does (docs/inputs.md).
- Points of the pages: none.
- The tool's own choice: keeping a short table of networks is a best practice of this tool, not a rule in the pages it cites; the pages describe Bitcoin, Ethereum and Solana, and the rest of the table is the tool's own.
