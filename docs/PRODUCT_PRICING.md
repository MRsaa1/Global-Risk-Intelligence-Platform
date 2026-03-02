# Product & pricing (CADAPT / Municipal)

Formal catalog of SaaS tiers and one-off products for the platform. Exposed via API and Municipal Dashboard → Subscription tab.

## Subscription tiers

| Tier ID | Amount (USD) | Period | Target |
|---------|--------------|--------|--------|
| standard | 5,000 | year | Municipalities (general) |
| professional | 10,000 | year | Municipalities (general) |
| enterprise | 20,000 | year | Municipalities (general) |
| **track_b_small** | **12,000** | **year** (~**1,000/month**) | Track B: small cities 5K–50K pop |
| **track_b_standard** | **24,000** | **year** (~**2,000/month**) | Track B: small cities 5K–50K pop |

- **API:** `GET /api/v1/cadapt/subscriptions/tiers` returns all tiers; Track B tiers include `amount_monthly`.
- **UI:** Municipal → Subscription → grid of tiers; Track B shows “$/month” and label “Track B (5K–50K)”.

## One-off products

| Product ID | Name | Price range (USD) | Notes |
|------------|------|-------------------|--------|
| **custom_report** | Custom Analysis Report | 15,000 – 30,000 | Risk/custom analysis deliverable |
| **decision_support** | Decision Support Consulting | 5,000 – 10,000 | Advisory / decision support |

- **API:** `GET /api/v1/cadapt/products` returns `products[]` with `id`, `name`, `price_min`, `price_max`, `currency`.
- **UI:** Municipal → Subscription → block “One-off products” with name and price range.

## References

- NOT_IMPLEMENTED.md (§ SaaS / продуктовая модель)
- Backend: `apps/api/src/api/v1/endpoints/cadapt.py` (`SUBSCRIPTION_TIERS`, `CADAPT_PRODUCTS`)
