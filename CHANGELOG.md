# Changes

## 1.0.0

First release.

- Reads the configuration of a crypto payment gateway or checkout, as JSON, and lists the settings to fix before it goes
  live, with file and line, as an input to a review: not a security audit and not a guarantee that no payment will be
  lost or counted twice. It reads the file, contacts no chain, RPC endpoint or webhook, fetches nothing, runs nothing,
  needs no key or secret, follows no symbolic link and reads no clock.
- Reads the checkout name and currency; the assets, each with a name, a network, a kind (`native` or `token`), a
  contract and decimals, the confirmations or the commitment that mark an invoice paid, the largest invoice
  (`maxAmount`), the deposit address policy (`per-invoice` or `shared`) and a reference (`none`, `memo` or
  `reference-key`); the invoice with its expiry, whether a payment must be paid or only detected before it
  (`expiryRequires`), the time a rate is held and the under- and overpayment tolerances; the webhook with its URL,
  signature, secret reference, timestamp tolerance, idempotency key and retry policy; and the refunds with their
  destination and review.
- A table of networks (Bitcoin, Ethereum, Polygon PoS, Arbitrum, Base, Solana and Tron) with the time of a block and the
  confirmations or commitment of each, the numbers a saved page gives marked as documented and the rest as the tool's own
  starting points, and the USDC addresses and decimals Circle lists.
- A strict JSON reader with no dependency and no recursion, with the line and column of every value, a key written
  twice as an error, and limits of size, nesting, values and string length. Amounts and percents are compared from the
  characters of the file with BigInt, never through a floating point number.
- A search for keys and seeds before anything else is read, kept unchanged from the sibling tool
  wallet-derivation-check, and a search for a webhook signing secret written inline or given as a `secretRef` that is
  not a reference name: each is an error whose value is left out of every check and never shown.
- Thirty checks in three levels, each documented or a best practice of the tool and saying which: too few confirmations
  on Bitcoin (`confirmations-below-documented`) or below the starting point of a network (`confirmations-below-default`),
  the processed (`solana-commitment-processed`) or confirmed (`solana-commitment-confirmed`) commitment on Solana, a
  payment of high value marked paid before finality on Ethereum (`paid-before-finality`) or another EVM network
  (`evm-paid-before-finality`), a token contract that is missing (`token-contract-missing`), malformed
  (`token-contract-malformed`) or not the USDC address Circle lists (`token-contract-not-official`), USDC decimals other
  than 6 (`token-decimals-mismatch`), a shared deposit address with no reference (`deposit-address-shared`), no invoice
  expiry (`invoice-expiry-missing`), an expiry shorter than the time to be paid
  (`invoice-expiry-below-confirmation-time`), a rate held past the invoice (`rate-lock-exceeds-expiry`), missing or
  negative tolerances (`payment-tolerance-missing`), a webhook that is not https (`webhook-not-https`), unsigned
  (`webhook-unsigned`), weakly signed (`webhook-weak-signature`), open to replay (`webhook-replay-unprotected`), with no
  idempotency key (`webhook-idempotency-missing`) or no retries (`webhook-retry-missing`), refunds to the sender
  (`refund-to-sender`) or to another address with no review (`refund-address-unreviewed`) and a network out of the table
  (`network-not-in-table`); and six checks about the input (`config-unreadable`, `field-missing`, `field-unknown`,
  `field-invalid`, `asset-duplicate`, `secret-in-config`).
- A table of the assets with what marks each paid, the time it takes, its largest invoice, its deposit policy and the
  state of its contract, in every format but SARIF.
- Reports as text, markdown, JSON and SARIF 2.1.0; every finding has its id, severity, message, file, line and column;
  `--min-severity`, `--fail-on`, `--large-payment`, `--min-confirmations`, `--explain` with the points of the pages
  behind each finding, and `--list-checks`. Exit code `0` when no finding is at or above the fail-on level, `1` when one
  is, `2` for a usage or input error, with no result.
- Plain text copies of the public pages the documented checks rest on, under research/sources, with a note on each page.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
