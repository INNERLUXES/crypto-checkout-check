# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

A check of a checkout configuration is full of time: invoice expiries, the time a rate is held, the timestamp tolerance
of a webhook and the time a payment takes to reach its confirmations are all spans of seconds. It is tempting to let the
calendar in as well: a report stamped with the time of the run, a note on when a page was last changed, the date a token
contract was deployed or a network was upgraded. Each of these would make the same configuration give a different output
on a different day, so the saved output of the examples could never be compared with a new run, and two people reading
the same commit could see two reports.

The checks do not need a date. Whether an invoice expires before a payment can be confirmed, whether a rate is held
longer than the invoice runs and whether a webhook has a replay window can all be read from the configuration, because
every span in it is a number of seconds, and the time of a block is a number of milliseconds in the table of networks.
The public pages the checks rest on are named by addresses that hold no year.

## Decision

1. The tool reads no clock, no time zone and no locale. It never prints the current time and never says when a page, a
   contract or a release was published. A span of seconds is compared with another span of seconds, never with the time
   of the run. The same file gives the same output on every machine and on every day.
2. No document, example or test of this repository holds a date or a number that reads like a year: not the licence,
   not the changelog, not the documents, not the comments of the code, not the examples. `npm run check` and a test fail
   on any word of four digits that starts with 19 or 20. The saved copies of the public pages under research/sources are
   the pages' own words and are the one place the check does not read for prose; even so, the lines that carry a date or
   a number that reads like a year (a date to pay by in an example, an API version made of a date, a dated link) were
   left out of the copies, so the test that reads every file for a year passes over them too. research/sources.md lists
   every line that was left out.
3. A version, a span of seconds, an amount or the number of a standard is not a year and is not caught: 1.0.0, Node 22,
   an expiry of 900, an amount of 25000, SARIF 2.1.0 and NIST SP 800-218 hold no year. The times of the table of
   networks are written as seconds times 1000, so that no figure of the code reads like one. A test of test/repo.test.js
   runs the pattern over such values and checks that none of them is caught, and that a year in the same place still is.
4. The sources are chosen with addresses that hold no year, and the notes on them name no publication date.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change, because it does
  not move with the calendar.
- The report holds no date and no deadline; a token contract that is to be replaced or a network that is to be upgraded
  is for the team to find on the page of its issuer.
- The examples use expiries, amounts and confirmations that do not read like a year, and a check catches one that does.
