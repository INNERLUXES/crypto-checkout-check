# Method

This document says how the tool reads a checkout configuration and what each check looks at. The tool is an input to a
review before the checkout goes live: not a security audit and not a guarantee that no payment will be lost or counted
twice. A clean run means only that none of the problems below were found in the file.

## Why the configuration

A crypto checkout turns a payment on a chain into a paid order. Between the two sit a handful of settings: how many
confirmations, or which commitment, mark an invoice paid on each network; which token contract counts as the token the
invoice asks for, and with how many decimals; whether each invoice gets an address of its own; how long an invoice runs
and how long its rate is held; how far a payment may be short or over; how the webhook that tells the shop is signed,
retried and deduplicated; and where refunds go. A Bitcoin payment marked paid after one confirmation can be taken back
by a double spend after the goods are gone; a USDC contract that is not Circle's lets a token of the same name pay; a
webhook with no idempotency key counts a payment twice when the event is delivered twice; a shared address with no memo
cannot tell two customers apart.

These choices sit in a configuration long before the checkout takes its first payment. The tool reads that
configuration as a file, so the same check runs on every change, and every finding points at a line.

## Reading the file

1. The path is resolved against the folder the command runs in. A link, a folder, a device or a pipe is refused; a file
   over 4 MB is refused before it is read; a file with a null byte, or bytes that are not UTF-8 (or UTF-16 with a byte
   order mark), is refused with exit code `2` and no report.
2. The text goes to a JSON reader of the tool's own (`src/json.js`), which keeps the line and column of every value and
   the characters every number was written with, and reads strict JSON: a comment, a trailing comma, a key written twice
   in one object or text after the value is a `config-unreadable` finding with the line.
3. Every key and every string of the file is looked at for a key or a seed (`src/secrets.js`). A key named for a private
   key, a seed or a mnemonic, and a string shaped like a mnemonic, an extended private key, a private key in hex or a key
   in WIF, is `secret-in-config`. The value is marked and left out of everything that follows, and no report shows it.
4. The fields are read (`src/config.js`) as docs/inputs.md lists them. A key of the webhook named for a secret, and a
   `secretRef` that is not shaped like the name of a reference, are `secret-in-config` and are marked the same way. A
   missing field is `field-missing`, a key the tool does not read is `field-unknown`, a value of the wrong type or form
   is `field-invalid`, and two assets of one name on one network are `asset-duplicate`. The value is then left out of
   every check that needs it. Amounts and percents are read by `src/decimal.js` into a whole number and a scale.
5. The network of each asset decides the fields it takes: confirmations on Bitcoin and Tron, a commitment on Solana, and
   confirmations or the `finalized` commitment on an EVM network. A network out of the table takes either.

## The checks of one asset

Each asset is checked on its own (`src/analyze.js`), with the family and the numbers of its network.

- The network against the table of networks: a network out of the table is a note.
- What marks an invoice paid: on Bitcoin, fewer than six confirmations when the largest invoice is above
  `--large-payment` or not given, or no confirmation at all; on Ethereum, Polygon PoS, Arbitrum, Base and Tron, fewer
  confirmations than the starting point of the table or the number `--min-confirmations` sets; on Ethereum and the other
  EVM networks, confirmations instead of the finalized checkpoint when the largest invoice is above `--large-payment` or
  not given; on Solana, the processed or the confirmed commitment.
- The token: a token with no contract; a contract that is not in the form of its network; USDC whose contract is not the
  one Circle lists for the network; USDC whose decimals are not 6. "USDC" is the name of the asset, compared without case;
  USDC.e and other names are other tokens.
- The deposit address: a shared address with no memo or reference key.

## The checks of the invoice, the webhook and the refunds

- The invoice: no expiry, or one of 0; a rate held longer than the invoice runs; an underpayment or overpayment
  tolerance that is missing or negative; and, when the invoice must be paid and not only detected before it expires
  (`expiryRequires` "paid", the default), an expiry shorter than the time an asset takes to be paid. That time is the
  confirmations of the asset times the time of a block of its network, or the time to the finalized checkpoint or
  commitment where the table gives one.
- The webhook: a URL that is not https; no signature or "none"; a signature other than HMAC-SHA256 or HMAC-SHA512; no
  timestamp tolerance, or one of 0; no idempotency key; no retry policy, or one of 0 attempts.
- The refunds, when they are on: refunds sent back to the sender; refunds to another address with no review.

## The checks

Each check says whether it is documented or a best practice. A documented check rests on a page of the Bitcoin developer
guide, ethereum.org, Solana, Circle, Stripe or GitHub. A best practice check is the tool's own choice; its message says
so, and so does `--list-checks`. [rules-and-sources.md](rules-and-sources.md) lists the pages and the points of each page
behind each check.

| Check | Looks at | Level |
| --- | --- | --- |
| `confirmations-below-documented` | Bitcoin `confirmations` below six with a large or unknown `maxAmount`, or 0 | error |
| `confirmations-below-default` | `confirmations` below the starting point of the network or `--min-confirmations` | warning |
| `solana-commitment-processed` | `commitment` processed on Solana | error |
| `solana-commitment-confirmed` | `commitment` confirmed on Solana | warning |
| `paid-before-finality` | Ethereum paid after `confirmations` with a large or unknown `maxAmount` | warning |
| `evm-paid-before-finality` | Polygon PoS, Arbitrum or Base paid after `confirmations` with a large or unknown `maxAmount` | warning |
| `token-contract-missing` | a token with no `contract` | error |
| `token-contract-malformed` | a `contract` not in the form of its network | error |
| `token-contract-not-official` | a USDC `contract` other than Circle's for the network | error |
| `token-decimals-mismatch` | USDC `decimals` other than 6 | error |
| `deposit-address-shared` | `depositAddress` shared with `reference` none or missing | error |
| `invoice-expiry-missing` | no `expirySeconds`, or 0 | error |
| `invoice-expiry-below-confirmation-time` | `expirySeconds` below the time an asset takes to be paid, when `expiryRequires` is paid | warning |
| `rate-lock-exceeds-expiry` | `rateLockSeconds` above `expirySeconds` | warning |
| `payment-tolerance-missing` | `underpaymentTolerance` or `overpaymentTolerance` missing or negative | warning |
| `webhook-not-https` | a `url` whose scheme is not https | error |
| `webhook-unsigned` | no `signature`, or "none" | error |
| `webhook-weak-signature` | a `signature` other than hmac-sha256 or hmac-sha512 | error |
| `webhook-replay-unprotected` | no `timestampTolerance`, or 0 | warning |
| `webhook-idempotency-missing` | no `idempotencyKey` | error |
| `webhook-retry-missing` | no `retry`, or `maxAttempts` 0 | warning |
| `refund-to-sender` | refunds on with `destination` sender | warning |
| `refund-address-unreviewed` | refunds on to another address with `review` not true | warning |
| `network-not-in-table` | a network the table does not hold | info |
| `secret-in-config` | a key or a seed, or a webhook secret written inline | error |
| `asset-duplicate` | two assets of one name on one network | error |
| `field-invalid` | a value of the wrong type or form | error |
| `field-unknown` | a key the tool does not read | warning |
| `field-missing` | a field the checks need | error |
| `config-unreadable` | a file that is not JSON, or holds no configuration object | error |

## The levels

- `confirmations-below-documented` is an error: a Bitcoin payment of high value marked paid before six confirmations can
  be taken back by a double spend after the order has shipped, and a payment with none is only a broadcast.
- `confirmations-below-default` is a warning and a best practice: its numbers are the tool's own starting points, and
  `--min-confirmations` sets the number a team has chosen.
- `solana-commitment-processed` is an error: a processed block can be rolled back. `solana-commitment-confirmed` is a
  warning: a confirmed block has the votes of a supermajority, but only the finalized level removes the risk of a
  dropped fork.
- `paid-before-finality` and `evm-paid-before-finality` are warnings: a reorganization of finished blocks is rare, and
  the cost of waiting for finality is a slower checkout; the finding asks the team to choose on purpose for payments of
  high value.
- `token-contract-missing`, `token-contract-malformed`, `token-contract-not-official` and `token-decimals-mismatch` are
  errors: each lets the wrong token pay, or reads every amount wrongly.
- `deposit-address-shared` is an error and a best practice: a payment that cannot be matched to its invoice is lost to
  the customer or counted for someone else.
- `invoice-expiry-missing` is an error: the Bitcoin guide says an invoice priced in a national currency has to expire.
  `invoice-expiry-below-confirmation-time`, `rate-lock-exceeds-expiry` and `payment-tolerance-missing` are warnings: each
  may be a choice the gateway handles some other way, and the finding asks the team to say so.
- `webhook-not-https`, `webhook-unsigned`, `webhook-weak-signature` and `webhook-idempotency-missing` are errors: each lets
  a payment event be read, forged or counted twice. `webhook-replay-unprotected` and `webhook-retry-missing` are warnings:
  an idempotency key stops a replayed event from counting twice, and a reconciliation job can find a lost event.
- `refund-to-sender` and `refund-address-unreviewed` are warnings: a refund is a choice the team makes case by case.
- `network-not-in-table` is a note: the table is short, and a network out of it is for a person to check.
