# crypto-checkout-check

Crypto checkout check. Give it the configuration of a crypto payment gateway or checkout, as a JSON file: for each
accepted asset the network (Bitcoin, Ethereum, Polygon PoS, Arbitrum, Base, Solana, Tron or another), whether it is the
native coin or a token, the token contract or mint and its decimals, the confirmations or the commitment that mark an
invoice paid, the largest invoice and whether each invoice gets a fresh deposit address or a memo; the invoice expiry,
the time a quoted rate is held and the underpayment and overpayment tolerances; the webhook URL, signature, secret
reference, timestamp tolerance, idempotency key and retry policy; and the refunds. It reads the file and lists the
settings to fix before the checkout goes live, the ones that lose payments or count them twice: too few confirmations, a
Solana commitment below finalized, a large payment marked paid before finality, a USDC contract or decimals that are not
the ones Circle lists, a shared deposit address with no memo, an invoice that expires before it can be paid, a webhook
that is not https, unsigned, weakly signed, open to replay or without an idempotency key or retries, a webhook secret
written inline, and refunds sent back to the sender or with no review. Every finding has its id, level, message and file
and line, and the run exits with a code a pipeline can act on.

**It is an input to a review before the checkout goes live: not a security audit and not a guarantee that no payment
will be lost or counted twice.** It is not an auditor. It reads one file only: it contacts no chain, RPC or webhook,
fetches nothing, runs nothing, needs no key or secret and reads no clock, so it does not see the code of the gateway,
the chains or the webhook endpoint; the checks are a heuristic. A clean run means only that none of the problems of its
checks were found in the file, and the team still has to test the gateway against a payment that is reorganized away, an
event delivered twice and a payment that comes late, short or over.

A crypto checkout turns a payment on a chain into a paid order, and a handful of settings decide when that happens. The
Bitcoin developer guide (https://developer.bitcoin.org/devguide/payment_processing.html) asks for six confirmations on
payments of high value, an expiry on every invoice priced in a national currency and a refund address from the payer;
the Solana pages say a processed block can still be rolled back; Circle lists the one USDC contract of each network; and
Stripe signs every webhook event with HMAC-SHA256, puts a timestamp in it against replay and warns that an event can
arrive twice. One confirmation on Bitcoin, a USDC contract that is not Circle's or a webhook with no idempotency key is
easy to write in a configuration and costly to find once orders ship. This tool reads the configuration on every change
and points at the line.

- **One check per problem.** Thirty checks, each with what it looks at, what it cannot see, the public pages it rests on
  and what to change. Each check is either documented (in a page of the Bitcoin developer guide, ethereum.org, Solana,
  Circle, Stripe or GitHub) or a best practice of this tool, and its message says which.
- **Never a secret.** The tool needs no private key, no seed, no webhook secret and no RPC endpoint. A webhook secret
  written into the file instead of a reference to it, a key named for a private key or a seed, and a value shaped like a
  mnemonic, an extended private key, a private key in hex or a key in WIF, are errors, and the value is never shown in
  any report.
- **Numbers from the pages, and the tool's own marked as such.** Six confirmations and ten minutes a block on Bitcoin,
  slots of 12 seconds and epochs of 32 on Ethereum, and slots of 400 milliseconds on Solana come from the saved pages;
  the confirmations of the other networks are the tool's own starting points, and `--min-confirmations` sets yours.
- **Amounts as written.** The largest invoice, the tolerances and `--large-payment` are compared from the characters of
  the file, never through a floating point number.
- **A JSON reader of its own.** It keeps the line and column of every value, so a finding points at the line of the
  asset or the field; what the configuration does not say is listed as a finding, never taken for a value that is fine.
- Reports as text, markdown, JSON and SARIF, with an exit code for a pipeline: `0` no finding at or above the
  `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network.

```
npm test
```

```
tests 146
pass 144
fail 0
skipped 2
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link or a device (a link to a configuration file, and `/dev/null` named as a file); they are guarded with
`process.platform`, run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same tests
with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/crypto-checkout-check.git
cd crypto-checkout-check
node bin/crypto-checkout-check.js examples/bad/checkout.json
```

Or without a clone, in your own project:

```
npx --yes github:INNERLUXES/crypto-checkout-check config/checkout.json
```

`examples/` holds two made-up checkout configurations. Every address in them is one character written many times and is
not a real contract, except the USDC addresses copied from the saved copy of Circle's page, and neither holds a key or a
real secret. `examples/bad/checkout.json` holds a finding of nearly every check: BTC paid after one confirmation with no
largest invoice, ETH paid after three confirmations on invoices of up to 50000 USD, USDC on Ethereum with a contract that
is not Circle's and 18 decimals, USDC on Base with a short contract, SOL paid at the processed commitment, USDC on Solana
at the confirmed commitment with a shared address and no reference, USDT on Tron with no contract and no deposit policy,
LTC on a network out of the table, a second USDC on Base, DAI on Polygon PoS with a kind the tool does not know and a
misspelt decimals, an invoice that must be paid within 10 minutes with a rate held for 30, a negative underpayment
tolerance and no overpayment tolerance, a webhook on http signed with HMAC-SHA1, a signing secret written inline, a
timestamp tolerance of 0, no idempotency key and 0 retries, and refunds sent back to the sender.
`examples/good/checkout.json` passes at error and warning level: BTC after six confirmations, ETH and USDC on Ethereum and
USDC on Polygon PoS at the finalized checkpoint, USDC on Base after 12 confirmations for invoices up to 1000 USD, USDC on
Solana at the finalized commitment with a reference key, USDT on Tron after 19 confirmations, invoices of 15 minutes that
hold once a payment is detected, a signed and replay-protected webhook with an idempotency key and retries, and reviewed
refunds to an address the customer gives; the one note it still shows is a network that is not in the tool's table.

## Usage

```
crypto-checkout-check <checkout.json> [options]
```

```
--format <name>                   text, markdown, json or sarif (default: text)
--json                            the same as --format json
--min-severity <level>            the lowest level of a finding that is shown: info, warning, error (default: info)
--fail-on <level>                 the lowest level of a finding that fails the run: info, warning, error (default: error)
--large-payment <amount>          the invoice amount above which a payment is of high value (default: 1000)
--min-confirmations <network>=<n> the confirmations below which confirmations-below-default reports an asset on
                                  ethereum, polygon, arbitrum, base or tron; once for each network
--explain                         show the points of the pages behind each finding (text, markdown and JSON)
--list-checks                     list the checks with their level and kind, and exit
--help                            show the usage
--version                         show the version
```

Name one file: the configuration. [docs/inputs.md](docs/inputs.md) lists every field. The path in the report is
relative to the folder you run the command in, with forward slashes on every system, followed by the line.

A short configuration looks like this:

```json
{
  "checkout": "Harbor Example Store",
  "currency": "USD",
  "assets": [
    {
      "name": "USDC",
      "network": "solana",
      "kind": "token",
      "contract": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "decimals": 6,
      "commitment": "finalized",
      "maxAmount": 25000,
      "depositAddress": "shared",
      "reference": "reference-key"
    }
  ],
  "invoice": { "expirySeconds": 900, "expiryRequires": "detected", "rateLockSeconds": 900, "underpaymentTolerance": 0.5, "overpaymentTolerance": 1 },
  "webhook": { "url": "https://harbor.example/hooks/payments", "secretRef": "env:CHECKOUT_WEBHOOK_SECRET", "signature": "hmac-sha256", "timestampTolerance": 300, "idempotencyKey": "event.id", "retry": { "maxAttempts": 12, "backoff": "exponential" } },
  "refunds": { "enabled": true, "destination": "customer-provided", "review": true }
}
```

The report of the bad example starts with what was read, the findings in one line, and the checks with the number of
findings of each; then the findings, errors first, each with what to change:

```
crypto-checkout-check: examples/bad/checkout.json
file: 118 lines, 3,115 bytes
checkout: Lantern Example Store; 10 assets on 7 networks (bitcoin, ethereum, base, solana, tron, litecoin and polygon); invoices expire after 600 seconds (10 minutes); webhook http, signed with hmac-sha1
findings: 28 (15 error, 12 warning, 1 info)

Checks (30)

  check                                   level    kind           findings
  config-unreadable                       error    input          0
  field-missing                           error    input          2
  field-unknown                           warning  input          1
  field-invalid                           error    input          1
  asset-duplicate                         error    input          1
  secret-in-config                        error    input          1
  confirmations-below-documented          error    documented     1
  confirmations-below-default             warning  best practice  1
  solana-commitment-processed             error    documented     1
  solana-commitment-confirmed             warning  documented     1
  paid-before-finality                    warning  documented     1
  evm-paid-before-finality                warning  best practice  1
  token-contract-missing                  error    documented     1
  token-contract-malformed                error    best practice  1
  token-contract-not-official             error    documented     1
  token-decimals-mismatch                 error    documented     1
  deposit-address-shared                  error    best practice  1
  invoice-expiry-missing                  error    documented     0
  invoice-expiry-below-confirmation-time  warning  documented     1
  rate-lock-exceeds-expiry                warning  best practice  1
  payment-tolerance-missing               warning  best practice  2
  webhook-not-https                       error    documented     1
  webhook-unsigned                        error    documented     0
  webhook-weak-signature                  error    documented     1
  webhook-replay-unprotected              warning  documented     1
  webhook-idempotency-missing             error    documented     1
  webhook-retry-missing                   warning  documented     1
  refund-to-sender                        warning  documented     1
  refund-address-unreviewed               warning  best practice  0
  network-not-in-table                    info     best practice  1

```

A finding names its check, its level, the file and the line of the field and what to change. With `--explain` it also
gives the points of the pages behind it and, for a best practice check, the tool's own choice:

```
  ERROR    confirmations-below-documented          examples/bad/checkout.json:11
           Asset BTC on bitcoin marks an invoice paid after 1 confirmation, and the asset gives no maxAmount, so an invoice of any size can be paid with it, above the --large-payment limit of 1000 USD. The Bitcoin developer guide asks software that takes payments of high value to wait for at least six confirmations, about an hour; until then a double spend can still take the payment back.
           fix: Wait for six confirmations before an invoice of high value is paid, or give the asset a maxAmount at or below --large-payment and record the risk analysis the guide asks for.
           basis: The guide asks software that takes payments of high value, or that is otherwise open to fraud, to wait for six confirmations or more before it treats a payment as accepted, and calls the number somewhat arbitrary. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
           basis: A payment with no confirmation has only been broadcast; the guide says not to trust one without an analysis of the risk, since a fraudster may get a different version of it into a block. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
           basis: A payment with a fee that is high enough waits ten minutes on average for its first confirmation, and since the newest block is often replaced by accident, one confirmation still leaves room for a double spend. (Bitcoin Developer Guide: Payment Processing, https://developer.bitcoin.org/devguide/payment_processing.html)
```

After the findings come the assets, each with what marks it paid, about how long that takes from the time of a block of
its network, its largest invoice, its deposit policy and the state of its contract:

```
Assets (10)

  asset  network   kind    dec  paid at    to paid                   max amount  deposit      contract
  BTC    bitcoin   native  8    1 conf     600 seconds (10 minutes)  -           per-invoice  -
  ETH    ethereum  native  18   3 conf     36 seconds                50000       per-invoice  -
  USDC   ethereum  token   18   finalized  768 seconds               50000       per-invoice  not official
  USDC   base      token   6    12 conf    24 seconds                5000        per-invoice  malformed
  SOL    solana    native  9    processed  0.4 seconds               500         per-invoice  -
  USDC   solana    token   6    confirmed  0.4 seconds               5000        shared       official
  USDT   tron      token   6    19 conf    57 seconds                1000        -            missing
  LTC    litecoin  native  8    6 conf     -                         1000        per-invoice  -
  usdc   base      token   6    12 conf    24 seconds                1000        per-invoice  official
  DAI    polygon   -       -    64 conf    128 seconds               1000        per-invoice  -
```

The end of the report holds the notice and the result:

```
  usdc   base      token   6    12 conf    24 seconds                1000        per-invoice  official
  DAI    polygon   -       -    64 conf    128 seconds               1000        per-invoice  -

This report is an input to a review before the checkout goes live: not a security audit and not a guarantee that no payment will be lost or counted twice.

RESULT: FAIL - 15 findings at or above error (15 error, 12 warning, 1 info)
```

The good example passes:

```
  USDT   tron      token   6    19 conf    57 seconds              1000        per-invoice            form only
  LTC    litecoin  native  8    6 conf     -                       1000        per-invoice            -

This report is an input to a review before the checkout goes live: not a security audit and not a guarantee that no payment will be lost or counted twice.

RESULT: PASS - no finding at or above error (1 info)
```

## How the configuration is read

1. The path is resolved against the folder you run the command in. A link, a folder, a device or a file over 4 MB is
   refused, and so is a file that is not UTF-8 (or UTF-16 with a byte order mark) or holds a null byte, with exit code
   `2` and no report.
2. The JSON reader of the tool reads the file with the line and column of every value and the characters of every
   number. It reads strict JSON and refuses a key written twice in one object.
3. Every key and every string is looked at for a private key or a seed, and the keys of the webhook and its `secretRef`
   for a signing secret written inline. One that is found is an error at its line, and its value is left out of
   everything that follows and never shown.
4. The fields of the configuration, of each asset, of the invoice, the webhook and the refunds are read with their lines.
   A key the tool does not read is a `field-unknown` finding; a missing field and a value of the wrong type are findings
   of their own, and that value is left out of the checks that need it. The network of each asset decides whether it is
   paid by confirmations or at a commitment.
5. Each asset is checked against the numbers of its network and the official USDC table; then the invoice is compared
   with the time each asset takes to be paid, and the webhook and the refunds are checked.

[docs/method.md](docs/method.md) says what each check reads, and [docs/inputs.md](docs/inputs.md) lists the fields, the
networks with their numbers and the tokens.

## What it checks

| Check | Level | Kind | What it reports |
| --- | --- | --- | --- |
| `confirmations-below-documented` | error | documented | a Bitcoin asset paid before six confirmations on invoices above `--large-payment`, or with none |
| `confirmations-below-default` | warning | best practice | confirmations below the tool's starting point for Ethereum, Polygon PoS, Arbitrum, Base or Tron, or `--min-confirmations` |
| `solana-commitment-processed` | error | documented | a Solana asset paid at the processed commitment |
| `solana-commitment-confirmed` | warning | documented | a Solana asset paid at the confirmed commitment |
| `paid-before-finality` | warning | documented | an Ethereum asset paid after confirmations, not finality, on invoices above `--large-payment` |
| `evm-paid-before-finality` | warning | best practice | the same on Polygon PoS, Arbitrum or Base |
| `token-contract-missing` | error | documented | a token with no contract or mint |
| `token-contract-malformed` | error | best practice | a contract not in the form of its network |
| `token-contract-not-official` | error | documented | a USDC contract other than the one Circle lists for the network |
| `token-decimals-mismatch` | error | documented | USDC with decimals other than 6 |
| `deposit-address-shared` | error | best practice | one shared deposit address with no memo or reference key |
| `invoice-expiry-missing` | error | documented | an invoice with no expiry |
| `invoice-expiry-below-confirmation-time` | warning | documented | an invoice that must be paid before it expires, and expires before an asset can be |
| `rate-lock-exceeds-expiry` | warning | best practice | a rate held longer than the invoice runs |
| `payment-tolerance-missing` | warning | best practice | no underpayment or overpayment tolerance, or a negative one |
| `webhook-not-https` | error | documented | a webhook URL that is not https |
| `webhook-unsigned` | error | documented | a webhook with no signature |
| `webhook-weak-signature` | error | documented | a webhook signed with something other than HMAC-SHA256 or HMAC-SHA512 |
| `webhook-replay-unprotected` | warning | documented | no timestamp tolerance, or 0 |
| `webhook-idempotency-missing` | error | documented | no idempotency key, so an event delivered twice counts twice |
| `webhook-retry-missing` | warning | documented | no retry policy, or 0 attempts |
| `refund-to-sender` | warning | documented | refunds sent back to the address the payment came from |
| `refund-address-unreviewed` | warning | best practice | refunds to another address with no review |
| `network-not-in-table` | info | best practice | a network out of the tool's table, judged by hand |
| `secret-in-config` | error | input | a key or a seed, or a webhook secret written inline; its value is never shown |
| `asset-duplicate` | error | input | two assets of one name on one network |
| `field-invalid` | error | input | a value of the wrong type or form, or a field the network does not take |
| `field-unknown` | warning | input | a key the tool does not read, often a misspelt one |
| `field-missing` | error | input | a field the checks need |
| `config-unreadable` | error | input | a file that is not JSON, or holds no configuration object |

A documented check rests on a page of the Bitcoin developer guide, ethereum.org, Solana, Circle, Stripe or GitHub. A
best practice check is this tool's own choice, and its message says "a best practice of this tool, not a rule in the
pages it cites". `--list-checks` shows the kind of each check. Some of the levels are worth a word:

- `confirmations-below-documented` applies the six confirmations of the Bitcoin guide to invoices above
  `--large-payment` (1000 in the currency of the checkout by default), and to every invoice of an asset with no
  `maxAmount`; a payment with no confirmation is always reported.
- `confirmations-below-default` is a warning and a best practice. No saved page gives a number for Ethereum, Polygon PoS,
  Arbitrum, Base or Tron; the tool starts from 12, 64, 12, 12 and 19, and `--min-confirmations` sets the number your
  team has chosen.
- `paid-before-finality` and `evm-paid-before-finality` are warnings: waiting for finality makes a checkout slower, and
  the finding asks the team to choose on purpose for payments of high value.
- `invoice-expiry-below-confirmation-time` compares only when the invoice must be paid, not only detected, before it
  expires (`expiryRequires`, "paid" by default); many gateways hold an invoice once its payment is seen.
- `webhook-replay-unprotected` and `webhook-retry-missing` are warnings: an idempotency key stops a replayed event from
  counting twice, and a reconciliation job can find a lost one.
- `network-not-in-table` is a note. The table holds Bitcoin, Ethereum, Polygon PoS, Arbitrum, Base, Solana and Tron.

## What is not checked

[docs/limits.md](docs/limits.md) lists what the tool cannot see. Among them: whether the gateway does what the
configuration says (test it against reorganized blocks and duplicate events), whether a contract address is the token it
is said to be beyond the USDC addresses Circle lists, the decimals of tokens other than USDC, the checksum of an address,
the depth of the reorganizations of a network, the certificate of the webhook endpoint, the strength of the secret behind
a signature, networks out of the table, and secrets in a shape the searches do not know.

## Formats

`--format text` (the default) is for a terminal. `--format markdown` is a report for a job summary or a pull request,
with a table of findings and the table of assets. `--format json` writes every finding with its `id`, `severity`,
`message`, `file`, `line`, `column`, `entry` and `fix`, the table of assets, and with `--explain` the points of the
pages. `--format sarif` writes SARIF 2.1.0, with the checks as rules, the configuration as the artifact and a result for
each finding with its line and column, for code scanning; the table of assets has no place in it. The saved output of
the examples is in [examples/output](examples/output).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | no finding at or above the `--fail-on` level (default `error`) |
| `1` | a finding at or above it |
| `2` | a usage error, or an input error such as a path that does not exist, a link or a folder, or a file that is not text or is too large; there is no report |

Findings below `--min-severity` are not shown, and still count for the result.

## Limits

The tool reads one file; it contacts no chain or webhook and connects to nothing. A run reports the problems of
docs/method.md that the file holds. [docs/limits.md](docs/limits.md) lists what it cannot see, with the size limits: 4 MB
for a file, objects and arrays nested up to 1,000 deep, 1,000 assets, and amounts of up to 40 digits on each side of the
point. [docs/threat-model.md](docs/threat-model.md) lists the risks of reading a file from a pull request and their
controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the file, looks for keys and seeds, reads the configuration, runs the checks and builds the report of the run |
| `src/files.js` | the bounded reading of a file by its byte order mark, with no link followed |
| `src/json.js` | the JSON reader: lines and columns, keys written twice, limits, a stack of its own |
| `src/secrets.js` | the search for keys and seeds by the name of a key and the shape of a value, kept from wallet-derivation-check |
| `src/config.js` | the fields of the configuration, its assets, invoice, webhook and refunds, the search for webhook secrets written inline, and the input checks |
| `src/decimal.js` | amounts and percents read from the characters of the file and compared with BigInt |
| `src/networks.js` | the networks, their families, the time of a block and what marks a payment final, and the form of a token address |
| `src/tokens.js` | the USDC addresses and decimals from Circle's pages |
| `src/analyze.js` | the checks on each asset, the invoice, the webhook and the refunds |
| `src/rules.js` | the checks, their levels and kinds, and the result |
| `src/report.js`, `src/text.js`, `src/size.js` | the text, markdown, JSON and SARIF output, the cleaning of text from the input and number formats |
| `src/data.js` | the public pages and the points the checks rest on, in this project's own words |
| `research/sources/` | text copies of the pages, as they were read |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

The documented checks rest on eight public pages, nothing else. Each page was read before it was listed, a text copy of
it is kept in [research/sources](research/sources), and [research/sources.md](research/sources.md) has a note on each
and lists the lines the copies leave out. [docs/rules-and-sources.md](docs/rules-and-sources.md) lists every check with
the points of the pages it rests on, what it cannot see and what to change. Where a check is a best practice and not a
rule in the pages, it says so.

- Bitcoin Developer Guide, Payment Processing: https://developer.bitcoin.org/devguide/payment_processing.html
- ethereum.org, Proof-of-stake (PoS): https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/
- Solana, RPC overview, Configuring State Commitment: https://solana.com/docs/rpc
- Solana, Transaction Confirmation & Expiration: https://solana.com/developers/guides/advanced/confirmation
- Circle, USDC contract addresses: https://developers.circle.com/stablecoins/usdc-contract-addresses
- Circle, Quickstart: Transfer USDC on Solana: https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana
- Stripe, Receive Stripe events in your webhook endpoint: https://docs.stripe.com/webhooks
- GitHub Docs, Validating webhook deliveries: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

## Background

The payment settings of a crypto checkout are decided before its first invoice, and every order it takes is paid with
them for as long as they stand. They are read line by line when a shop adds a network or a stablecoin, when a gateway is
prepared for a security review, or when engineers are brought in to build the payment service, its webhooks and its
tests. How such work is staffed and carried out is described on the page
[Blockchain Payment Services](https://innerluxes.dev/blockchain/payments).

## License

MIT
