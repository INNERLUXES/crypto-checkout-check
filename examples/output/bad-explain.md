# crypto-checkout-check: examples/bad/checkout.json

- File: 118 lines, 3,115 bytes
- Checkout: Lantern Example Store; 10 assets on 7 networks \(bitcoin, ethereum, base, solana, tron, litecoin and polygon\); invoices expire after 600 seconds \(10 minutes\); webhook http, signed with hmac-sha1
- Findings: 28 \(15 error, 12 warning, 1 info\)
- Result: **FAIL - 15 findings at or above error \(15 error, 12 warning, 1 info\)**

## Findings

| Level | Check | Where | Message |
| --- | --- | --- | --- |
| error | confirmations-below-documented | examples/bad/checkout.json:11 | Asset BTC on bitcoin marks an invoice paid after 1 confirmation, and the asset gives no maxAmount, so an invoice of any size can be paid with it, above the --large-payment limit of 1000 USD. The Bitcoin developer guide asks software that takes payments of high value to wait for at least six confirmations, about an hour; until then a double spend can still take the payment back. Fix: Wait for six confirmations before an invoice of high value is paid, or give the asset a maxAmount at or below --large-payment and record the risk analysis the guide asks for. |
| error | token-contract-not-official | examples/bad/checkout.json:27 | The contract of asset USDC on ethereum is 0x1111111111111111111111111111111111111111, but Circle's page of USDC contract addresses lists 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 for Ethereum: payments in another token named USDC would be counted as USDC. Fix: Use the address Circle lists for USDC on the network \(docs/inputs.md\), or rename the asset when it is another token, such as a bridged USDC.e. |
| error | token-decimals-mismatch | examples/bad/checkout.json:28 | Asset USDC on ethereum has 18 decimals, but the Circle quickstart for Solana says USDC carries 6: every amount read is too small by a factor of 1,000,000,000,000, so a full payment looks like an underpayment. Fix: Set the decimals of USDC to 6. |
| error | token-contract-malformed | examples/bad/checkout.json:37 | The contract of asset USDC on base is "0x8335", which has 4 characters after 0x, not 40; on Base it is 0x followed by 40 hex digits, not the zero address. This is a best practice of this tool, not a rule in the pages it cites. Fix: Copy the address of the token again from the issuer's own list for the network. |
| error | solana-commitment-processed | examples/bad/checkout.json:48 | Asset SOL on solana marks an invoice paid at the processed commitment. The Solana RPC page says a processed block can still be rolled back, and the page on confirmation says about 5 percent of blocks are never finalized. Fix: Mark a Solana invoice paid at the finalized commitment. |
| error | deposit-address-shared | examples/bad/checkout.json:60 | Asset USDC on solana takes the payments of every invoice at one shared address and asks for no memo or reference key, so two customers who pay the same amount cannot be told apart, and a payment can be counted for the wrong invoice or for none. This is a best practice of this tool, not a rule in the pages it cites. Fix: Issue a fresh deposit address for each invoice, or ask for a memo or reference key that names the invoice and refuse a payment without one. |
| error | field-missing | examples/bad/checkout.json:63 | Asset 7 has no depositAddress. Fix: Add the field named; docs/inputs.md lists what each part of the configuration needs. |
| error | token-contract-missing | examples/bad/checkout.json:63 | Asset USDT on tron is a token with no contract address, so a token of any contract named USDT could pay an invoice. Circle's page of USDC contract addresses asks for every address on a mainnet to be checked. Fix: Give the contract or mint address of the token on the network, copied from the issuer's own list. |
| error | asset-duplicate | examples/bad/checkout.json:81 | Asset 9 is usdc on Base, as is asset 4 at line 34; a payment cannot be told apart and a finding cannot be traced to one of them. Fix: Give each asset of a network a name of its own, or merge the two. |
| error | field-invalid | examples/bad/checkout.json:93 | The kind of asset DAI on polygon is "erc20"; it must be native or token. Fix: Write the value as docs/inputs.md shows: text for names, addresses and references, whole numbers for seconds, confirmations and decimals, plain decimal numbers for amounts and percents. |
| error | field-missing | examples/bad/checkout.json:107 | The webhook is signed with hmac-sha1 but has no secretRef; name the secret the signature is made with by a reference, such as env:CHECKOUT\_WEBHOOK\_SECRET. Fix: Add the field named; docs/inputs.md lists what each part of the configuration needs. |
| error | webhook-idempotency-missing | examples/bad/checkout.json:107 | The webhook names no idempotencyKey, so an event delivered twice can count one payment twice. Stripe says an endpoint may receive an event more than once and asks it to skip the ids it has handled. Fix: Name the field that identifies an event, such as event.id, record each one handled, and skip one seen before. |
| error | webhook-not-https | examples/bad/checkout.json:108 | The webhook URL uses http, not https, so payment events cross the network in clear text and can be read or changed on the way. Stripe asks for a public HTTPS address and allows plain HTTP only on a developer's own machine. Fix: Give the webhook a public https URL. |
| error | webhook-weak-signature | examples/bad/checkout.json:109 | The webhook is signed with "hmac-sha1", which is weaker than HMAC-SHA256. GitHub keeps HMAC-SHA1 for older code only and signs with HMAC-SHA256, as Stripe does. Fix: Sign webhooks with HMAC-SHA256, and compare signatures in constant time. |
| error | secret-in-config | examples/bad/checkout.json:110 | The webhook holds the key "signingSecret", a signing secret written into the file. The value is not shown; name the secret by a reference in secretRef instead. Fix: Remove the value from the file and from the history of the repository, treat it as exposed and replace it, and name the webhook secret by a reference such as env:CHECKOUT\_WEBHOOK\_SECRET. |
| warning | confirmations-below-default | examples/bad/checkout.json:19 | Asset ETH on ethereum marks an invoice paid after 3 confirmations, fewer than the tool's starting point of 12 for Ethereum; a block that is replaced takes the payment with it. This is a best practice of this tool, not a rule in the pages it cites. Fix: Raise the confirmations of the asset, wait for the finalized checkpoint on an EVM network, or set the threshold your team has chosen with --min-confirmations and record why. |
| warning | paid-before-finality | examples/bad/checkout.json:19 | Asset ETH on ethereum marks an invoice paid after 3 confirmations, before its block is finalized, and its largest invoice, 50000 USD, is above the --large-payment limit of 1000 USD. The page of ethereum.org on proof-of-stake says a block is final only once a checkpoint above it is justified and then finalized, which takes at least two epochs of 32 slots of 12 seconds. Fix: Mark an Ethereum invoice of high value paid once its block is finalized \(commitment "finalized"\), or give the asset a maxAmount at or below --large-payment. |
| warning | evm-paid-before-finality | examples/bad/checkout.json:39 | Asset USDC on base marks an invoice paid after 12 confirmations, before its block is finalized, and its largest invoice, 5000 USD, is above the --large-payment limit of 1000 USD. This is a best practice of this tool, not a rule in the pages it cites. Fix: Mark an invoice of high value paid once the network reports its block as finalized \(commitment "finalized"\), or give the asset a maxAmount at or below --large-payment. |
| warning | solana-commitment-confirmed | examples/bad/checkout.json:58 | Asset USDC on solana marks an invoice paid at the confirmed commitment. A confirmed block has the votes of a supermajority of the stake but is not yet finalized; the Solana page on confirmation says only the finalized level takes away the risk of a dropped fork. Fix: Mark a Solana invoice paid at the finalized commitment, which the page on confirmation says removes the risk of a dropped fork, or record why confirmed is enough for the amounts the asset takes. |
| warning | field-unknown | examples/bad/checkout.json:95 | The key "Decimals" of asset 10 is not one the tool reads, so its value was left out of every check. Did you mean "decimals"? The keys of asset 10 are name, network, kind, contract, decimals, confirmations, commitment, maxAmount, depositAddress, reference, notes. Fix: Correct the spelling to a key of docs/inputs.md, or remove the key. |
| warning | payment-tolerance-missing | examples/bad/checkout.json:101 | The invoice has no overpaymentTolerance, so what the checkout does with a payment that is a little short or a little over is not written down: it may be lost, refused or counted in full. This is a best practice of this tool, not a rule in the pages it cites. Fix: Give an underpaymentTolerance and an overpaymentTolerance in percent, from 0, and say what the checkout does with a payment outside them. |
| warning | invoice-expiry-below-confirmation-time | examples/bad/checkout.json:102 | The invoice expires after 600 seconds \(10 minutes\), but a payment in asset USDC on ethereum takes about 768 seconds to reach the finalized checkpoint: the invoice must be paid before it expires, so a payment sent on time can run out before it is marked paid, and the payer is asked for more or refunded by hand. The Bitcoin developer guide warns of this with a short expiry. Fix: Let the invoice run longer than the time to confirm on every network it accepts, or hold an invoice open once its payment is detected and write expiryRequires "detected". |
| warning | rate-lock-exceeds-expiry | examples/bad/checkout.json:104 | The quoted rate is held for 1,800 seconds \(30 minutes\), longer than the 600 seconds \(10 minutes\) the invoice runs, so a quote outlives its invoice and a payment after the expiry can still be priced at it. This is a best practice of this tool, not a rule in the pages it cites. Fix: Hold the rate no longer than the invoice runs, and quote again for a payment that comes after. |
| warning | payment-tolerance-missing | examples/bad/checkout.json:105 | The underpaymentTolerance of the invoice is negative, so no underpayment tolerance is defined and an exact payment may fall outside it. This is a best practice of this tool, not a rule in the pages it cites. Fix: Give an underpaymentTolerance and an overpaymentTolerance in percent, from 0, and say what the checkout does with a payment outside them. |
| warning | webhook-replay-unprotected | examples/bad/checkout.json:111 | The webhook has a timestampTolerance of 0, so a payment event captured once can be sent again later and still pass. Stripe signs a timestamp with each event, allows 5 minutes by default and says a tolerance of 0 turns the check off. Fix: Sign a timestamp with every event and refuse one older than a tolerance, such as the 5 minutes of the Stripe libraries. |
| warning | webhook-retry-missing | examples/bad/checkout.json:112 | The webhook retries 0 times, so a payment event lost to one failed delivery is never sent again and the invoice stays unpaid. Stripe retries for up to three days with exponential back off. Fix: Retry failed deliveries with exponential back off over hours or days, and let an operator send an event again by hand. |
| warning | refund-to-sender | examples/bad/checkout.json:116 | Refunds go back to the address the payment came from. The Bitcoin developer guide calls this very unsafe: the payment may have come from an exchange or a shared wallet that cannot tell which of its users the refund is for, and asks the payer for a refund address instead. Fix: Ask the payer for a refund address \(destination "customer-provided"\) instead of sending a refund to the sending address. |
| info | network-not-in-table | examples/bad/checkout.json:73 | The network "litecoin" of asset LTC on litecoin is not in the tool's table \(bitcoin, ethereum, polygon, arbitrum, base, solana, tron\), so what marks a payment on it as final and the form of its token addresses were not judged. This is a best practice of this tool, not a rule in the pages it cites. Fix: Check by hand what marks a payment on the network as final and how its token addresses are written, or name the network as the table does \(docs/inputs.md\). |

## Basis

### confirmations-below-documented

- The guide asks software that takes payments of high value, or that is otherwise open to fraud, to wait for six confirmations or more before it treats a payment as accepted, and calls the number somewhat arbitrary. (Bitcoin Developer Guide: Payment Processing, <https://developer.bitcoin.org/devguide/payment_processing.html>)
- A payment with no confirmation has only been broadcast; the guide says not to trust one without an analysis of the risk, since a fraudster may get a different version of it into a block. (Bitcoin Developer Guide: Payment Processing, <https://developer.bitcoin.org/devguide/payment_processing.html>)
- A payment with a fee that is high enough waits ten minutes on average for its first confirmation, and since the newest block is often replaced by accident, one confirmation still leaves room for a double spend. (Bitcoin Developer Guide: Payment Processing, <https://developer.bitcoin.org/devguide/payment_processing.html>)

### token-contract-not-official

- Circle lists the address of the USDC contract or mint on each mainnet it supports, Ethereum, Polygon PoS, Arbitrum, Base and Solana among them, and asks for every address on a mainnet to be checked, since the tokens hold real value. (Circle: USDC contract addresses, <https://developers.circle.com/stablecoins/usdc-contract-addresses>)

### token-decimals-mismatch

- The Circle quickstart for Solana says USDC carries 6 decimals, so that one USDC is the amount 1,000,000 in the smallest unit. (Circle: Quickstart: Transfer USDC on Solana, <https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana>)

### token-contract-malformed

- The tool's own choice: reading the form of an address is a best practice of this tool, not a rule in the pages it cites; the pages show addresses in these forms but set no rule for a configuration, and no checksum is checked

### solana-commitment-processed

- Solana RPC has three commitment levels: processed, the newest block of the node, which can still be rolled back; confirmed, a block voted on by more than two thirds of the stake; and finalized, a block at maximum lockout. (Solana: RPC overview, Configuring State Commitment, <https://solana.com/docs/rpc>)
- The guide says about 5 percent of blocks are never finalized because they sit on a fork that is dropped, that the finalized level takes that risk away, and that it trails the confirmed level by 32 slots or more. (Solana: Transaction Confirmation & Expiration, <https://solana.com/developers/guides/advanced/confirmation>)

### deposit-address-shared

- In the payment request the guide walks through, the merchant asks to be paid to a script with a public key that was never used before, and that key also serves to find the details of the order. (Bitcoin Developer Guide: Payment Processing, <https://developer.bitcoin.org/devguide/payment_processing.html>)
- The tool's own choice: asking for a deposit address or a reference of its own for each invoice is a best practice of this tool, not a rule in the pages it cites; the Bitcoin guide shows a key never used before in its payment request, and the tool applies the idea to every network

### field-missing

- A problem with the configuration file itself; it rests on no page.

### token-contract-missing

- Circle lists the address of the USDC contract or mint on each mainnet it supports, Ethereum, Polygon PoS, Arbitrum, Base and Solana among them, and asks for every address on a mainnet to be checked, since the tokens hold real value. (Circle: USDC contract addresses, <https://developers.circle.com/stablecoins/usdc-contract-addresses>)

### asset-duplicate

- A problem with the configuration file itself; it rests on no page.

### field-invalid

- A problem with the configuration file itself; it rests on no page.

### webhook-idempotency-missing

- An endpoint can receive one event more than once, so the page asks it to record the ids of the events it has handled and to pass over an event whose id it already has. (Stripe: Receive Stripe events in your webhook endpoint, <https://docs.stripe.com/webhooks>)

### webhook-not-https

- Stripe delivers events over HTTPS, wants a public HTTPS address before it registers an endpoint, and allows plain HTTP only while the endpoint runs on the machine of a developer. (Stripe: Receive Stripe events in your webhook endpoint, <https://docs.stripe.com/webhooks>)

### webhook-weak-signature

- Every event carries a signature made with HMAC and SHA-256 under the secret of the endpoint; unchecked, the page says, an attacker could post false events that fulfil orders or change records. (Stripe: Receive Stripe events in your webhook endpoint, <https://docs.stripe.com/webhooks>)
- GitHub signs each delivery with HMAC-SHA256 in the X-Hub-Signature-256 header, keeps the HMAC-SHA1 header for older code only, and asks for the two hashes to be compared in constant time. (GitHub Docs: Validating webhook deliveries, <https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries>)

### secret-in-config

- A problem with the configuration file itself; it rests on no page.

### confirmations-below-default

- The tool's own choice: the number of confirmations for a network other than Bitcoin is a best practice of this tool, not a rule in the pages it cites; none of the saved pages gives one, so the tool starts from its own table and lets --min-confirmations change it

### paid-before-finality

- On proof-of-stake Ethereum a block is final once a checkpoint above it has passed two votes of two thirds of the staked ether, first justified and then finalized, after which undoing it would burn a large share of the stake. (ethereum.org: Proof-of-stake \(PoS\), <https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/>)
- Proof-of-stake Ethereum divides time into slots of 12 seconds and epochs of 32 slots, and its checkpoints, the blocks that finality is decided on, are the first block of each epoch. (ethereum.org: Proof-of-stake \(PoS\), <https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/>)

### evm-paid-before-finality

- On proof-of-stake Ethereum a block is final once a checkpoint above it has passed two votes of two thirds of the staked ether, first justified and then finalized, after which undoing it would burn a large share of the stake. (ethereum.org: Proof-of-stake \(PoS\), <https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/>)
- The tool's own choice: asking for finality on an EVM network other than Ethereum is a best practice of this tool, not a rule in the pages it cites; the page of ethereum.org describes the finality of Ethereum, and each of these networks finalizes in its own way

### solana-commitment-confirmed

- Solana RPC has three commitment levels: processed, the newest block of the node, which can still be rolled back; confirmed, a block voted on by more than two thirds of the stake; and finalized, a block at maximum lockout. (Solana: RPC overview, Configuring State Commitment, <https://solana.com/docs/rpc>)
- The guide says about 5 percent of blocks are never finalized because they sit on a fork that is dropped, that the finalized level takes that risk away, and that it trails the confirmed level by 32 slots or more. (Solana: Transaction Confirmation & Expiration, <https://solana.com/developers/guides/advanced/confirmation>)

### field-unknown

- A problem with the configuration file itself; it rests on no page.

### payment-tolerance-missing

- With a shorter expiry an invoice is more likely to run out before the payment arrives, which may mean asking for more or refunding by hand; with a longer one the rate has more time to move. (Bitcoin Developer Guide: Payment Processing, <https://developer.bitcoin.org/devguide/payment_processing.html>)
- The tool's own choice: asking for written tolerances is a best practice of this tool, not a rule in the pages it cites; the Bitcoin guide says a late or short payment may need more money or a refund by hand, not how far off a payment may be

### invoice-expiry-below-confirmation-time

- With a shorter expiry an invoice is more likely to run out before the payment arrives, which may mean asking for more or refunding by hand; with a longer one the rate has more time to move. (Bitcoin Developer Guide: Payment Processing, <https://developer.bitcoin.org/devguide/payment_processing.html>)
- A payment with a fee that is high enough waits ten minutes on average for its first confirmation, and since the newest block is often replaced by accident, one confirmation still leaves room for a double spend. (Bitcoin Developer Guide: Payment Processing, <https://developer.bitcoin.org/devguide/payment_processing.html>)
- Proof-of-stake Ethereum divides time into slots of 12 seconds and epochs of 32 slots, and its checkpoints, the blocks that finality is decided on, are the first block of each epoch. (ethereum.org: Proof-of-stake \(PoS\), <https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/>)
- A slot of Solana is set to about 400 milliseconds and may vary between 400 and 600. (Solana: Transaction Confirmation & Expiration, <https://solana.com/developers/guides/advanced/confirmation>)

### rate-lock-exceeds-expiry

- An order priced in a national currency and paid in bitcoin has to expire, or the payer can wait for the price to move; the guide says payment processors let invoices run for 10 to 20 minutes. (Bitcoin Developer Guide: Payment Processing, <https://developer.bitcoin.org/devguide/payment_processing.html>)
- The tool's own choice: comparing the time a rate is held with the expiry of the invoice is a best practice of this tool, not a rule in the pages it cites; the Bitcoin guide asks for totals in a national currency to expire, not for a rule on how long a rate is held

### webhook-replay-unprotected

- To stop a replay, the signed header holds a timestamp, and a payload whose signature is valid but whose timestamp is old can be refused; the libraries allow 5 minutes, and a tolerance of 0 switches the check off. (Stripe: Receive Stripe events in your webhook endpoint, <https://docs.stripe.com/webhooks>)

### webhook-retry-missing

- In live mode Stripe goes on trying to deliver an event for up to three days with exponential back off, and an event can also be sent again by hand. (Stripe: Receive Stripe events in your webhook endpoint, <https://docs.stripe.com/webhooks>)

### refund-to-sender

- Sending a refund back to the script the payment came from is called very unsafe, because a shared web wallet may not know which of its users it is for; the guide asks the payer for a refund address instead. (Bitcoin Developer Guide: Payment Processing, <https://developer.bitcoin.org/devguide/payment_processing.html>)

### network-not-in-table

- The tool's own choice: keeping a short table of networks is a best practice of this tool, not a rule in the pages it cites; the pages describe Bitcoin, Ethereum and Solana, and the rest of the table is the tool's own

## Assets (10)

| Asset | Network | Kind | Decimals | Paid at | Time to paid | Max amount | Deposit | Contract |
| --- | --- | --- | ---: | --- | ---: | ---: | --- | --- |
| BTC | bitcoin | native | 8 | 1 conf | 600 seconds \(10 minutes\) | - | per-invoice | - |
| ETH | ethereum | native | 18 | 3 conf | 36 seconds | 50000 | per-invoice | - |
| USDC | ethereum | token | 18 | finalized | 768 seconds | 50000 | per-invoice | not official |
| USDC | base | token | 6 | 12 conf | 24 seconds | 5000 | per-invoice | malformed |
| SOL | solana | native | 9 | processed | 0.4 seconds | 500 | per-invoice | - |
| USDC | solana | token | 6 | confirmed | 0.4 seconds | 5000 | shared | official |
| USDT | tron | token | 6 | 19 conf | 57 seconds | 1000 | - | missing |
| LTC | litecoin | native | 8 | 6 conf | - | 1000 | per-invoice | - |
| usdc | base | token | 6 | 12 conf | 24 seconds | 1000 | per-invoice | official |
| DAI | polygon | - | - | 64 conf | 128 seconds | 1000 | per-invoice | - |

This report is an input to a review before the checkout goes live: not a security audit and not a guarantee that no payment will be lost or counted twice.
