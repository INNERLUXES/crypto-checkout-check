# Inputs

The tool takes one path: the checkout configuration, a JSON file. There is no configuration file of the tool itself, no
environment variable and no standard input; the options are on the command line. The tool never asks for a private
key, a seed, a webhook secret or an RPC endpoint, and needs none.

```
crypto-checkout-check <checkout.json> [--format text|markdown|json|sarif] [--json] [--min-severity <level>]
                      [--fail-on <level>] [--large-payment <amount>] [--min-confirmations <network>=<n>]
                      [--explain] [--list-checks]
```

| Option | Meaning |
| --- | --- |
| `--format <name>` | `text` (default), `markdown`, `json` or `sarif` |
| `--json` | the same as `--format json` |
| `--min-severity <level>` | the lowest level shown: `info` (default), `warning` or `error` |
| `--fail-on <level>` | the lowest level that fails the run: `info`, `warning` or `error` (default) |
| `--large-payment <amount>` | the amount, in the currency of the checkout, above which an invoice is of high value, a plain decimal such as 1000 or 2500.50 (default 1000); an asset whose `maxAmount` is above it, or not given, is held to six confirmations on Bitcoin and to finality on an EVM network |
| `--min-confirmations <network>=<n>` | the confirmations below which `confirmations-below-default` reports an asset on `ethereum`, `polygon`, `arbitrum`, `base` or `tron`, a whole number from 0 to 100,000; may be given once for each network, by its id or an alias. Bitcoin, whose six confirmations come from a page, and Solana, which is paid at a commitment level, are refused |
| `--explain` | add the points of the pages behind each finding to the text, markdown and JSON reports |
| `--list-checks` | list the checks with their level and kind, in text, markdown or JSON, and exit |
| `--help`, `--version` | the usage, the version |

Every option that takes a value takes it once, except `--min-confirmations`, which takes one value for each network. A
value may not start with `--`. `-` (standard input) and an address such as `https://...` are refused. A folder is
refused: name the file. Two paths are a usage error.

## The configuration

The configuration is one JSON object. Every key is read with its line, and a key that is not in the lists below is a
`field-unknown` finding.

| Field | Needed | Read as |
| --- | --- | --- |
| `checkout` | yes | the name of the checkout or the shop, text |
| `currency` | yes | the currency invoices are priced in, such as USD, text; amounts are written in it |
| `assets` | yes | a list of assets, at least one; each is an asset the checkout accepts |
| `invoice` | yes | an object; see below |
| `webhook` | yes | an object; see below |
| `refunds` | yes | an object; see below |
| `notes` | no | text, not read by any check |

## An asset

| Field | Needed | Read as |
| --- | --- | --- |
| `name` | yes | text, the symbol of the asset, such as BTC or USDC; two assets of one network may not share a name (compared without case and outer spaces). An asset named USDC is held to Circle's address and decimals |
| `network` | yes | the network the payment is made on, by the name or an alias of the table below, in any case; another name is a note (`network-not-in-table`) |
| `kind` | yes | `native` for the coin of the network, `token` for a token on it; a token on Bitcoin is `field-invalid` |
| `contract` | for a token | the address of the token contract or mint; missing on a token is `token-contract-missing`; a native asset takes none |
| `decimals` | for a token | the decimals of the asset, a whole number from 0 to 36 |
| `confirmations` | see below | the confirmations that mark an invoice paid, a whole number from 0 to 1,000,000 |
| `commitment` | see below | the commitment that marks an invoice paid: `processed`, `confirmed` or `finalized` on Solana, `finalized` on an EVM network |
| `maxAmount` | no | the largest invoice paid with the asset, a plain decimal in the currency of the checkout; missing means an invoice of any size |
| `depositAddress` | yes | `per-invoice` when every invoice gets a fresh address, `shared` when payments go to one address |
| `reference` | no | `none` (the default), `memo` or `reference-key`: what tells two payments to a shared address apart |
| `notes` | no | text, not read by any check |

What marks an invoice paid depends on the network:

| Network | Takes | Needed |
| --- | --- | --- |
| Bitcoin, Tron | `confirmations` | `confirmations` |
| Ethereum, Polygon PoS, Arbitrum, Base | `confirmations` or `commitment` `finalized`, not both | one of them |
| Solana | `commitment` | `commitment` |
| a network out of the table | `confirmations` or `commitment` | one of them |

## The invoice

| Field | Needed | Read as |
| --- | --- | --- |
| `expirySeconds` | yes | the time an invoice runs, in whole seconds; missing or 0 is `invoice-expiry-missing` |
| `expiryRequires` | no | `paid` (the default) when a payment must reach the confirmations or commitment that mark it paid before the invoice expires, `detected` when it is enough that the payment is seen on the network in time |
| `rateLockSeconds` | no | the time a quoted exchange rate is held, in whole seconds |
| `underpaymentTolerance` | no | how far short of the total a payment may be and still count, in percent from 0 to 100; missing or negative is `payment-tolerance-missing` |
| `overpaymentTolerance` | no | how far over the total a payment may be before the rest is refunded or reviewed, in percent from 0 to 100; the same |
| `notes` | no | text |

## The webhook

| Field | Needed | Read as |
| --- | --- | --- |
| `url` | yes | the absolute URL the checkout posts payment events to, with a scheme and a host |
| `signature` | no | `hmac-sha256` or `hmac-sha512`, or another name, which is reported; `none` or missing is `webhook-unsigned` |
| `secretRef` | with an HMAC signature | the name of a reference to the signing secret, never the secret: an optional scheme such as `env:` or `vault:`, then a name of letters, digits, `_`, `.`, `/` and `-` that starts with a letter or `_`, such as `env:CHECKOUT_WEBHOOK_SECRET`. A value with the prefix of a signing or API secret, or a run of 24 or more letters and digits with no separator, is taken for the secret itself (`secret-in-config`) and never shown |
| `timestampTolerance` | no | how old a signed event may be, in whole seconds; missing or 0 is `webhook-replay-unprotected` |
| `idempotencyKey` | no | the field that identifies an event, such as `event.id`; missing is `webhook-idempotency-missing` |
| `retry` | no | an object with `maxAttempts` (needed, a whole number from 0 to 1,000), `backoff` (`exponential`, `linear` or `fixed`) and `notes`; missing, or 0 attempts, is `webhook-retry-missing` |
| `notes` | no | text |

A key of the webhook whose name ends in "secret", or that is `key`, `token`, `hmacKey`, `signingKey`, `apiKey` or
`password` in any case and with any separator, is a signing secret written inline: it is `secret-in-config` and its value
is never shown. `secretRef` is not one.

## The refunds

| Field | Needed | Read as |
| --- | --- | --- |
| `enabled` | yes | true when the checkout sends refunds, false when it does not; the other checks of the refunds run only when it is true |
| `destination` | when enabled | `sender` (the address the payment came from), `customer-provided` (an address the customer gives) or `operator` (an address an operator enters) |
| `review` | no | true when a person checks a refund before it is sent |
| `notes` | no | text |

## The networks

| Network | Aliases | Family | Time of a block | Paid at | Number from a page |
| --- | --- | --- | --- | --- | --- |
| `bitcoin` | btc, bitcoin-mainnet | utxo | 10 minutes | 6 confirmations | both |
| `ethereum` | eth, mainnet, ethereum-mainnet | evm | 12 seconds | 12 confirmations, or the finalized checkpoint after two epochs | the time of a slot and of an epoch; the 12 confirmations are the tool's own |
| `polygon` | polygon-pos, matic | evm | 2 seconds | 64 confirmations, or finalized | neither |
| `arbitrum` | arbitrum-one | evm | 0.25 seconds | 12 confirmations, or finalized | neither |
| `base` | base-mainnet | evm | 2 seconds | 12 confirmations, or finalized | neither |
| `solana` | sol, solana-mainnet | solana | 400 milliseconds | the finalized commitment, 32 slots after confirmed | both |
| `tron` | trx, tron-mainnet | tron | 3 seconds | 19 confirmations | neither |

The numbers that come from no page are the tool's own starting points; `--min-confirmations` sets the confirmations of
the EVM networks and Tron. The table has no time for the finalized block of Polygon PoS, Arbitrum or Base, so an asset
paid there at `finalized` is not compared with the expiry of the invoice.

## The tokens

| Token | Decimals | Network | Address, as Circle lists it |
| --- | --- | --- | --- |
| USDC | 6 | ethereum | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |
| USDC | 6 | polygon | 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 |
| USDC | 6 | arbitrum | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 |
| USDC | 6 | base | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| USDC | 6 | solana | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v |

An address on an EVM network is compared without case, since the case is only a checksum; a Solana address as written.
USDC on Tron, which Circle does not list, is checked for its form only, and a note says so.

## An example

```json
{
  "checkout": "Harbor Example Store",
  "currency": "USD",
  "assets": [
    { "name": "BTC", "network": "bitcoin", "kind": "native", "decimals": 8, "confirmations": 6, "maxAmount": 25000, "depositAddress": "per-invoice" },
    { "name": "USDC", "network": "solana", "kind": "token", "contract": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "decimals": 6, "commitment": "finalized", "depositAddress": "shared", "reference": "reference-key" }
  ],
  "invoice": { "expirySeconds": 900, "expiryRequires": "detected", "rateLockSeconds": 900, "underpaymentTolerance": 0.5, "overpaymentTolerance": 1 },
  "webhook": { "url": "https://harbor.example/hooks/payments", "secretRef": "env:CHECKOUT_WEBHOOK_SECRET", "signature": "hmac-sha256", "timestampTolerance": 300, "idempotencyKey": "event.id", "retry": { "maxAttempts": 12, "backoff": "exponential" } },
  "refunds": { "enabled": true, "destination": "customer-provided", "review": true }
}
```

## What stops the reading

| Problem | Result |
| --- | --- |
| a file that is not strict JSON (a comment, a trailing comma, a single quote, a key written twice in one object, text after the value), or is nested past the limits | one `config-unreadable` finding with the line and column, and nothing else is checked |
| JSON whose top level is not an object | one `config-unreadable` finding |
| a field missing, of the wrong type or unknown | a finding with the line; that value is left out of the checks that need it |
| an asset whose confirmations or commitment could not be read | a finding; the checks of what marks it paid are left out, and a note names the asset |
| a key or a seed, or a webhook secret written inline | a `secret-in-config` finding with the line; the value is left out of every check and never shown |

Line ends may be LF, CRLF or CR, and the file may be UTF-8 with or without a byte order mark or UTF-16 with one; the same
findings are written for each.

## Output paths

The path shown in a report is relative to the folder the command runs in, with forward slashes on every system, and the
whole path when the file is outside that folder. A finding is `file:line`: the line of the field it is about, or of the
object that lacks a field. The JSON, markdown and SARIF reports also carry the column.
