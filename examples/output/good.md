# crypto-checkout-check: examples/good/checkout.json

- File: 105 lines, 2,858 bytes
- Checkout: Harbor Example Store; 8 assets on 7 networks \(bitcoin, ethereum, base, polygon, solana, tron and litecoin\); invoices expire after 900 seconds \(15 minutes\); webhook https, signed with hmac-sha256
- Findings: 1 \(1 info\)
- Result: **PASS - no finding at or above error \(1 info\)**

## Findings

| Level | Check | Where | Message |
| --- | --- | --- | --- |
| info | network-not-in-table | examples/good/checkout.json:77 | The network "litecoin" of asset LTC on litecoin is not in the tool's table \(bitcoin, ethereum, polygon, arbitrum, base, solana, tron\), so what marks a payment on it as final and the form of its token addresses were not judged. This is a best practice of this tool, not a rule in the pages it cites. Fix: Check by hand what marks a payment on the network as final and how its token addresses are written, or name the network as the table does \(docs/inputs.md\). |

## Assets (8)

| Asset | Network | Kind | Decimals | Paid at | Time to paid | Max amount | Deposit | Contract |
| --- | --- | --- | ---: | --- | ---: | ---: | --- | --- |
| BTC | bitcoin | native | 8 | 6 conf | 3,600 seconds \(1 hour\) | 25000 | per-invoice | - |
| ETH | ethereum | native | 18 | finalized | 768 seconds | 25000 | per-invoice | - |
| USDC | ethereum | token | 6 | finalized | 768 seconds | 25000 | per-invoice | official |
| USDC | base | token | 6 | 12 conf | 24 seconds | 1000 | per-invoice | official |
| USDC | polygon | token | 6 | finalized | - | 25000 | per-invoice | official |
| USDC | solana | token | 6 | finalized | 12.8 seconds | 25000 | shared, reference-key | official |
| USDT | tron | token | 6 | 19 conf | 57 seconds | 1000 | per-invoice | form only |
| LTC | litecoin | native | 8 | 6 conf | - | 1000 | per-invoice | - |

This report is an input to a review before the checkout goes live: not a security audit and not a guarantee that no payment will be lost or counted twice.
