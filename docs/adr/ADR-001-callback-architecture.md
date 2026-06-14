# ADR-001: Callback-Driven Microservices Architecture

## Status
Accepted

## Context
Xeno CRM needs to dispatch bulk messages (Email, WhatsApp, SMS) and track progressive user interactions (Sent -> Delivered -> Opened -> Clicked -> Converted) without blocking the CRM database or introducing heavy production messaging integrations during simulation testing.

## Decision
We decouple campaign creation and execution into two separate applications:
1. **`crm-service`**: Acts as the system of record.
2. **`channel-service`**: Simulates communication channels.

We communicate via HTTP POST requests:
- CRM dispatches target recipient arrays to channel-service `/send`.
- Channel-service schedules simulated behaviors asynchronously using delayed loops.
- As status changes occur, channel-service calls back CRM `/api/receipt`.
- We implement exponential backoff retries (up to 3 retries) inside `channel-service` to tolerate temporary CRM offline conditions.
- We implement state ranking in CRM to guarantee idempotency and forward-only status updates.

## Tradeoffs
- **Pros**: Zero dependencies on real SMS/WhatsApp providers, highly customizable simulation, clean microservice decoupling.
- **Cons**: HTTP communication between local services requires ports 3000 and 4000 to be open. Local timeouts and in-memory simulated delay queues do not persist if the service restarts.

## Alternatives Considered
- **Single-process queue**: Running the simulation inside the same Node.js runtime as the CRM. Rejected because a slow simulation or event loop blocking would impact shop/checkout checkout response times.
- **Real integration sandboxes**: Connecting to Twilio or SendGrid testing API keys. Rejected to ensure the project can be run locally offline with zero external account creation friction.

## Future Improvements
- Integrate a reliable job queue like BullMQ backed by Redis for managing simulation schedules.
- Transition from HTTP polling to WebSockets for instant frontend updates.
