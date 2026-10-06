# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "crypto-checkout-check security", or use private vulnerability
reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up configuration file that shows the problem, the command you ran, what you expected and what
happened. Use made-up shops, assets and addresses, never the configuration of a checkout that is not public yet, and
never a real private key, seed, mnemonic or webhook secret, even an old one or one from a test network.

## Scope

In scope:

- an input that makes the tool show a private key, a seed, a mnemonic or a webhook secret, or any part of one, in a
  report or an error message, in any format
- a key, a seed or a webhook secret in one of the shapes docs/limits.md names that the tool does not report
- an input that makes the tool read a file other than the one it was given, or follow a symbolic link
- an input that makes the tool open a network connection, fetch a URL, contact a chain, an RPC endpoint or a webhook, run
  any other program, or evaluate anything it reads
- an input that makes the tool write a file
- an input that makes the tool hang, take very long, exhaust the stack or use unbounded memory, such as very large files,
  arrays and objects nested deep, very long strings, numbers with thousands of digits, or thousands of assets
- binary or invalid input that the tool reads as if it were JSON
- a field the tool did not read that a check reports as fine, a key written twice whose second value is taken without a
  finding, or a misspelt key that is not reported
- an amount or a percent that the tool compares in a way the decimal text of the file does not say, so that a check
  passes or fails because of it
- a run that passes at a `--fail-on` level although the input holds a finding at that level that docs/method.md says is
  reported
- text from a file or a file name that rewrites the terminal through control or direction characters, is shown unescaped
  in the output, or puts markup into the markdown report
- a name such as `__proto__` that changes how objects behave inside the tool

Out of scope: the forms docs/limits.md says the tool does not see, whether the gateway does what the configuration says
(a clean result is not a security audit and not a guarantee that no payment will be lost or counted twice), whether a
contract address is the token it is said to be beyond the USDC addresses Circle lists, the numbers of the table of
networks that are the tool's own starting points, secrets in shapes the searches do not claim to know, who may change the
configuration in your repository, and where your pipeline keeps the output.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
