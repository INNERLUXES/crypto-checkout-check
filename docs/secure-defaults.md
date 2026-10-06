# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest
of the document is about what the tool cannot do for you: which file you give it, where the output goes, and who may
change the configuration it reads. A clean result is not a security audit and not a guarantee that no payment will be
lost or counted twice; it is a file with none of the problems the checks look for, not a finding that the gateway handles
payments safely.

## How the tool behaves by default

- **Never a secret.** The tool needs no private key, no seed, no webhook secret and no RPC endpoint, and has no option to
  take one. A key named for one and a value shaped like one, anywhere in the file, and a webhook secret written inline
  instead of a reference to it, is a `secret-in-config` error that fails the run; the value is left out of every check
  and never written to a report or an error message, in any format.
- **Reads, never runs.** The tool reads the one configuration file it is given. It follows no symbolic link, fetches no
  URL, refuses an argument that looks like an address, contacts no chain, RPC endpoint or webhook, evaluates nothing and
  writes nothing to disk.
- **Every check on from the first run.** Too few confirmations on Bitcoin, the processed commitment on Solana, a token
  with a missing, malformed or unofficial contract or the wrong decimals, a shared address with no reference, an invoice
  with no expiry, and a webhook that is not https, unsigned, weakly signed or without an idempotency key are errors;
  confirmations below the starting point of a network, the confirmed commitment on Solana, a payment of high value marked
  paid before finality, an invoice that expires before it can be paid, a rate held past the invoice, missing tolerances,
  no replay window, no retries and refunds to the sender or without review are warnings; a network out of the table is
  a note. There is no configuration file of the tool that could set a check off.
- **Payments of high value by default.** An asset with no `maxAmount` is taken to accept invoices of any size, so the
  checks for payments of high value apply to it; the limit is 1000 in the currency of the checkout until
  `--large-payment` says otherwise.
- **Fail closed on what it cannot read.** A file that is not JSON, or not an object, is an error finding that fails the
  run at the default `--fail-on` of `error`. A missing field and a value of the wrong type are findings of their own, so
  a part of the configuration that was not read is never taken for one that is fine; an asset whose way of being paid
  could not be read is named in a note. A misspelt key is a warning that names the key it is probably meant to be. A
  file that is not text, is too large or is a link stops the run with exit code `2` and no report.
- **Amounts as written.** An amount or a percent is compared from the characters of the file, never through a floating
  point number, and a number with an exponent is refused, so a largest invoice of 1000.000000000000000001 is above a
  limit of 1000.
- **Unknown arguments are errors.** An option the tool does not know, a value that looks like an option and an option
  given twice stop the run, so a typo such as `--fail-no` cannot leave a default in place.
- **No pattern from the input.** No regular expression is built from a file or from an argument.
- **Bounded work.** The reader has limits of size, nesting, values and string length, and works with a stack of its own;
  a configuration has at most 1,000 assets (docs/limits.md), so a large or deep file cannot exhaust the stack, the
  memory or the time.
- **No prototype tricks.** Keys from a file are kept in lists and compared with the names the tool reads, never set as
  properties of an object, so `__proto__` is only a name.
- **Clean output.** Text from the input, file names, checkout names, assets, networks, contracts and URLs included, has
  control characters, line separators and direction controls replaced and its length capped before it reaches a report
  or an error message; the markdown report also escapes what markdown gives a meaning to.
- **The same input gives the same output.** No clock, no zone, no locale and no random number
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **No dependencies.** Node 22 or newer and nothing else.

## Settings that make the check stricter

- **`--fail-on warning`.** Confirmations below the starting point of a network, the confirmed commitment on Solana,
  payments of high value marked paid before finality, an expiry shorter than the time to be paid, a rate held past the
  invoice, missing tolerances, no replay window, no retries, refunds to the sender or without review and misspelt keys
  fail the run too. Use it once the configuration is meant to be final, and record in the pull request each warning the
  team keeps on purpose, such as a confirmed commitment on Solana for small amounts.
- **`--large-payment` lower than 1000.** More invoices count as payments of high value, so more assets are held to six
  confirmations on Bitcoin and to finality on an EVM network.
- **`--min-confirmations <network>=<n>`.** Set the confirmations your team has chosen for Ethereum, Polygon PoS,
  Arbitrum, Base or Tron, above the tool's own starting points, from what you know of the network.
- **`--fail-on info`.** A network out of the table fails the run too; use it where every network must be checked by a
  person before an asset on it is accepted.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Crypto checkout check
    run: npx --yes github:INNERLUXES/crypto-checkout-check config/checkout.json --format markdown >> "$GITHUB_STEP_SUMMARY"
```

- Give the job read access to the contents and nothing more. The tool needs no secret, no key, no webhook secret and no
  RPC endpoint; never give it one.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because
  `npx` runs what it downloads.
- Keep one configuration as the source of the checkout settings that the gateway, its tests and its documents use, and
  check it on every change. A value copied by hand into the code of the gateway can drift from the one that was checked;
  read the values from the configuration in the code, or compare the two in their tests.
- Copy the contract and the decimals of each token from the list of its issuer, and review a change to them like code:
  the tool knows the official addresses of USDC only, and a well-formed address of the wrong token passes.
- Keep the webhook signing secret in a secret store and name it in `secretRef`; the pipeline that checks the
  configuration never needs its value.
- Test the gateway against a payment that is reorganized away, a webhook event delivered twice, an event with an old
  timestamp, a payment that is a little short or over and a payment to a shared address with no memo, in its own test
  suite. This tool checks the configuration; the tests check that the gateway does what it says.
- Do not hide the exit code with a trailing `|| true`. To keep the report without failing, keep `--fail-on` at `error`
  and keep the SARIF or JSON report as an artifact of the job, or upload the SARIF to code scanning.
- Treat a report built from a file you do not trust as untrusted data.
- If the tool ever reports `secret-in-config`, treat the secret as exposed: remove it from the file and from the history
  of the repository, and replace it (roll the webhook secret, move the funds a key controls to a new key). The tool does
  not show the value, but the file itself was readable to everyone with access to the repository.

## Protecting the configuration

The checkout configuration decides when an order counts as paid. Keep it in the repository next to the code of the
gateway, put its path in `CODEOWNERS` with the people who approve changes to payment settings, and require their review
in branch protection. Review a change to a confirmation count, a token contract, an expiry or the webhook like a change
to the code that moves money: one confirmation on Bitcoin, or a contract of the wrong token, lets a payment be counted
that never stays paid.

Once the checkout is live, a change to the configuration changes how every new invoice is paid. Roll it out with the
same review as the first release, and watch the reconciliation of payments and orders after it.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with
`ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
