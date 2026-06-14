# ADR-002: Customer Segmentation Engine

## Status
Accepted

## Context
Marketers require instant, accurate customer groups (New Shoppers, Repeat Buyers, Dormant Shoppers, High Value Shoppers, etc.) to target campaigns effectively.

## Decision
We implemented a rule-based segmentation engine in the CRM backend.
- Segment memberships are calculated by querying Mongoose models (`User`, `Order`, `Cart`).
- We store memberships in a dedicated `segments` collection where each segment document contains a list of customer references `userIds`.
- Segments are updated automatically during checkout events and seeder script execution to keep classifications fresh.
- We expose REST API endpoints (`GET /api/segments`) to read sizes and query matching customers.

## Tradeoffs
- **Pros**: Easy to write, zero third-party tools, fast lookups when targeting because customer lists are pre-aggregated inside the segment documents.
- **Cons**: Running the entire segmentation query during checkouts performs full-scan aggregates on orders. If database sizes grow to millions of transactions, checkouts will experience latency.

## Alternatives Considered
- **On-the-fly execution query**: Querying matching customer IDs at the time of campaign dispatching rather than storing them. Rejected because querying segments on-the-fly would make marketer segment browsing in the UI slow and unresponsive.
- **External Customer Data Platform (CDP)**: Replicating database records to an external analytics store. Rejected due to unnecessary cost and infrastructure overhead for a lightweight MVP.

## Future Improvements
- Transition to incremental segmentation where checkout events only recalculate the specific shopper's segment membership rather than querying all customers.
- Set up a scheduled cron worker (e.g. daily at midnight) to run segmentation engine, or use MongoDB Aggregation pipelines with materialization views.
