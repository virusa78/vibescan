---
inclusion: manual
---

# API Design Guidelines

## Surface Rules
- Keep internal app features behind Wasp operations when possible.
- Use public APIs only for surfaces that must be callable without the client runtime.
- Keep request and response contracts explicit and stable.

## Auth and Scope
- Require authentication for workspace-scoped reads and mutations unless there is a deliberate public endpoint.
- Validate workspace ownership on every operation that reads or mutates workspace data.
- Do not infer tenant identity from headers alone.

## Error Handling
- Use structured errors with clear machine-readable reasons.
- Return status codes that reflect the failure class: auth, validation, not found, rate limit, or conflict.
- Keep error messages actionable but not verbose.

## Versioning and Compatibility
- Preserve existing client contracts when expanding an operation.
- If a new response shape is needed, add it without breaking existing callers.
- Treat OpenAPI parity as part of the API contract when `/api/v1` changes.

