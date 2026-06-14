# ADR-003: AI Marketing Copilot Design

## Status
Accepted

## Context
Marketers need conversational insights regarding their customer segments and simple triggers to draft targeted marketing campaigns based on dialogue.

## Decision
We implemented Xeno Copilot using Groq's `llama-3.3-70b-versatile` model.
- We utilize the Groq API completion system with a structured prompt.
- We pass real-time database stats (total customers, revenue, segment sizes) inside the prompt as system-level context.
- We enforce Groq's JSON mode (`response_format: { type: "json_object" }`) to guarantee structured responses containing conversational text, estimated revenue gains, and campaign templates.
- The chatbot frontend parses this JSON, renders conversational text bubbles, and adds a **Generate Campaign** button if a structured campaign template is suggested.

## Tradeoffs
- **Pros**: Extremely reliable structured JSON output, fast response times (using Groq's high throughput), interactive campaign generation bridging chat and builder screens.
- **Cons**: Every message requires passing the entire aggregated KPI state, which increases input token counts.

## Alternatives Considered
- **Gemini 1.5 Flash**: Previously used for completions. Rejected in favor of Groq due to Groq's significantly faster inference latency and strict JSON mode compliance.
- **Client-side LLM calls**: Invoking LLMs from the browser directly. Rejected to protect the `GROQ_API_KEY` from being exposed to the client-side.

## Future Improvements
- Implement a chat history buffer to maintain dialogue context across multiple follow-ups.
- Transition to Groq's function-calling / tool-use capabilities to let the LLM execute actions directly.
