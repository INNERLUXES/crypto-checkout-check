# 3. Check the configuration on disk, and contact no chain or webhook

## Status

Accepted

## Context

Some facts about a checkout live on a chain, at an endpoint or on a web page: the decimals a token contract returns, the
symbol of the contract at an address, the current height of a network and how deep its reorganizations go, whether the
webhook URL answers and with what certificate, and the current list of USDC addresses of Circle. A check could call an
RPC endpoint on every run, read `decimals()` and `symbol()` from each contract, post a test event to the webhook and
fetch the list of addresses. Each would need the network and an endpoint, would make the result depend on the state of a
chain and of a server, would need secrets such as the key of a paid RPC endpoint or the webhook secret in the pipeline,
and would let a file in a pull request make the pipeline reach any address it names.

What a team needs first, before the checkout goes live, is a list of what is wrong in the configuration and where: the
confirmations, the commitments, the contracts, the expiries, the webhook and the refunds, as the configuration writes
them.

## Decision

1. The tool reads the one file it is given, and nothing else. It contacts no chain, no RPC endpoint and no webhook,
   fetches nothing, needs no key, runs no program and calls no service.
2. The decimals of a token, the address of its contract and the largest invoice of an asset are values the
   configuration gives, copied by the team from the issuer's list and the business rules; the tool compares them with
   the few facts the saved pages give, and says so in docs/limits.md.
3. The rules the checks apply are listed in docs/method.md, and the public pages each documented check rests on are
   named in src/data.js and research/sources.md, each fetched and read before it was listed, with a copy of its text
   under research/sources; the tool never looks them up while it runs.
4. The table of networks in src/networks.js and the table of tokens in src/tokens.js are short. The numbers a saved page
   gives are marked as documented and a test checks them against the copy; the rest are the tool's own starting points
   and say so, and `--min-confirmations` changes them. A network out of the table is a note, never a guess.
5. The tool lists what to look at and what to change; it changes nothing.

## Consequences

- The result depends only on the file, and a run needs no network access, no secret and no endpoint.
- A contract address of the wrong token that is in the right form passes, unless it is USDC on a network Circle lists;
  docs/secure-defaults.md says to copy addresses from the issuer and review a change to them like code.
- A USDC address Circle adds after the copy was saved is not known until the table is updated in a release, with a
  test.
