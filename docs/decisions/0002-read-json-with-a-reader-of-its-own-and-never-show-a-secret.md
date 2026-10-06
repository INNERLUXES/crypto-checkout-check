# 2. Read JSON with a reader of its own, and never show a secret

## Status

Accepted

## Context

The facts the checks need sit in the configuration: for each asset the network, the kind, the contract and the decimals,
what marks an invoice paid and the deposit address policy; the invoice; the webhook; and the refunds. `JSON.parse` would
read them, but it keeps no line and column, so a finding could not point at the line of an asset; it takes the last of
two values written under one key without a word; it builds objects whose keys come from the file; and it turns every
amount into a floating point number, so that a largest invoice written with many digits after the point and a limit
compare as the number type rounds them, not as the file writes them.

A checkout configuration sits next to the code of the gateway, and a careless file can hold a secret: the signing secret
of the webhook pasted next to its URL, the private key of a hot wallet, a mnemonic under a key named `seed`. A tool that
reads such a file and echoes its values in a report would copy the secret into a pipeline log, a pull request comment or
a SARIF upload, where many more people can read it.

A configuration that is not complete (an asset with no kind, a misspelt decimals) would also be read as if it were, and
a check could take a value it never saw for one that is fine.

## Decision

1. The file is read by src/json.js, a reader of the tool's own for strict JSON, with the line and column of every value,
   a key written twice as an error, and limits of nesting, values and string length. It does not recurse. Every number
   keeps the characters it was written with.
2. Amounts and percents are read from those characters by src/decimal.js into a whole number and a scale and compared
   with BigInt. A number with an exponent or more than 40 digits on a side of the point is a `field-invalid` finding,
   never rounded; a tolerance written with a minus sign is read as negative and reported.
3. The tool never asks for a private key, a seed or a signing secret: it checks the configuration as written. Before the
   configuration is read, src/secrets.js, kept unchanged from the sibling tool wallet-derivation-check, walks every key
   and every string of the file. A key named for a key or a seed, and a string shaped like a mnemonic, an extended private
   key, a private key in hex or a key in WIF, is a `secret-in-config` error at its line. The configuration reader then
   marks a webhook signing secret the same way: a key of the webhook named for a secret, and a `secretRef` that is not
   shaped like the name of a reference. The value is marked, the reader leaves it out as if it were not there, and no
   report and no error message shows it, in any format. A contract address of 40 hex digits is never taken for a key of
   64.
4. Every field the checks need and the file does not give, every key the tool does not read and every value of the
   wrong type is returned with its line and shown as a finding. A check never takes a value it did not read for one
   that is fine, and an asset whose way of being paid could not be read is named in a note.
5. A file that is not JSON, or not an object, stops with one `config-unreadable` finding and a line; the tool does not
   guess at the rest of the file.
6. The checks are a heuristic over the configuration as written, and every report says so; docs/method.md says what each
   check reads and docs/limits.md what it cannot see. The result is an input to a review before the checkout goes live:
   not a security audit and not a guarantee that no payment will be lost or counted twice.

## Consequences

- The tool needs no install and no network, and the same file gives the same report on Linux, Windows and macOS.
- A finding points at the line of the field or the asset.
- A secret in the file fails the run and is never copied into the output. The shapes are loose, so a value that only
  looks like a secret is reported too, such as a reference name made of one long run of letters and digits; that is the
  safe side, and a reference can always be written with a scheme and a separator, such as env:CHECKOUT_WEBHOOK_SECRET.
- Configurations in YAML or TOML, and settings written only in the code of the gateway, are not read (docs/limits.md).
