# Limits

The tool is not an auditor. It reads one checkout configuration, and its result is an input to a review before the
checkout goes live: not a security audit and not a guarantee that no payment will be lost or counted twice. A clean run
means only that none of the problems in [method.md](method.md) were found in the file.

## What it cannot see

- **The code of the gateway.** It reads the configuration, not the code that watches the chains, matches payments to
  invoices, signs and sends webhooks and sends refunds. Whether that code waits for the confirmations the configuration
  names, checks a signature in constant time, stores the ids of the events it handled and refuses a payment without its
  memo is for the team and the reviewers of the code to make sure. A setting written in the code and not in the
  configuration is not seen.
- **The chains.** It contacts no chain and no RPC endpoint, so it cannot tell whether a contract address is a token at
  all, which token it is, how many decimals it really has, or how deep the reorganizations of a network go. The
  decimals and the contract are the values the configuration gives.
- **Checksums of addresses.** An address is checked for its form (0x and 40 hex digits on an EVM network, base58 of the
  right length on Solana and Tron); the mixed case checksum of EIP-55 and the checksum of a Tron address are not checked.
- **Tokens other than USDC.** The only official addresses the tool knows are the USDC addresses the saved copy of
  Circle's page lists for Ethereum, Polygon PoS, Arbitrum, Base and Solana, and the only decimals it knows are the 6 of
  USDC, from Circle's quickstart for Solana, which it applies to USDC on every one of those networks. A USDT, DAI or
  bridged USDC.e contract is checked for its form only. An asset is USDC by its name; an asset of another name with the
  USDC contract is not compared.
- **Numbers no page gives.** The six confirmations and the ten minutes of Bitcoin, the 12 seconds and the epochs of
  Ethereum, and the 400 milliseconds and the 32 slots of Solana come from the saved pages. The confirmations of
  Ethereum, Polygon PoS, Arbitrum, Base and Tron, and the time of a block of Polygon PoS, Arbitrum, Base and Tron, are the
  tool's own starting points; set your own confirmations with `--min-confirmations`. The time to the finalized checkpoint
  of Ethereum, two epochs, is the tool's reading of the page, and the table has no time for the finalized block of the
  other EVM networks. Blocks come late as well as early, so a time to be paid is an estimate.
- **The webhook endpoint.** The URL is read for its scheme; the certificate, the TLS version, whether the host is public
  and whether it answers are not checked. A signature is read by its name; the strength of the secret behind it is not.
- **The business.** Whether a `maxAmount`, a tolerance or an expiry is right for the shop, and how a payment that comes
  late, short or over is handled, are for the team.
- **Networks out of the table.** The table names Bitcoin, Ethereum, Polygon PoS, Arbitrum, Base, Solana and Tron. An
  asset on another network is a note, and what marks it paid and the form of its token addresses are not judged.
- **Every secret.** The search for keys and seeds knows them by the name of their key and by their shape: a mnemonic of
  12 to 24 lowercase English words, an extended private key, 64 hex digits or a key in WIF. A webhook secret is known by
  a key of the webhook named for one and by a `secretRef` that is not shaped like a reference name. A secret split over
  fields, encoded another way or written under another key is not caught. A clean run does not say that the repository
  holds no secret.
- **What a misspelt key meant.** A key the tool does not read is reported and left out. A misspelt `idempotencyKey`
  makes the webhook look as if it had none; read the `field-unknown` findings first.

## What the reader does not read

[inputs.md](inputs.md) lists the fields. A file that is not strict JSON is one `config-unreadable` finding, and nothing
else is checked. A value that is missing, of the wrong type or a secret is a finding, and the checks that need it leave
it out: a clean run says nothing about that part. YAML, TOML, comments, amounts written as text and numbers with an
exponent are not read.

## Size limits

| Limit | Value |
| --- | --- |
| file size | 4 MB |
| nesting of objects and arrays | 1,000 levels |
| values (nodes) in a file | 2,000,000 |
| a string | 1,000,000 characters |
| assets | 1,000; the rest are not read |
| confirmations | 1,000,000 |
| retry attempts | 1,000 |
| a span of seconds | 100,000,000 |
| decimals | 36 |
| an amount or a percent | 40 digits on each side of the point; a percent at most 100 |
| a text the search for keys looks at | 4,000 characters |
| a reference name | 128 characters after its scheme |

Input past a limit is a `config-unreadable` or `field-invalid` finding or, for the file size, an input error with exit
code `2`. The tool never passes a run because something could not be read.

## What a run does not do

It never reads or asks for a private key, a seed or a webhook secret, contacts no chain, RPC endpoint or webhook,
fetches nothing and connects to nothing, runs no program, evaluates nothing it reads, reads no clock and no locale,
follows no symbolic link and writes nothing to disk. [threat-model.md](threat-model.md) lists the risks of reading a
file from a pull request and their controls.
