---
inclusion: manual
---

# Security Guidelines

## Authentication
- Keep auth flows on the server side and avoid duplicating token handling in local storage.
- Avoid trusting user-controlled headers for upstream routing or tenant selection.
- Prefer server-owned session or credential handling where possible.

## Workspace Isolation
- Every query or action that touches tenant data must filter by workspace.
- Do not assume the currently authenticated user is entitled to every resource they can name.

## Webhooks and External Calls
- Validate outbound targets before sending anything to them.
- Re-check stored webhook targets in delivery workers, not only on create/update.
- Treat URL parsing, redirects, and localhost access as security-sensitive paths.

## Frontend Safety
- Use `noopener,noreferrer` for new tabs that point to external destinations.
- Do not render untrusted HTML directly.
- Keep secrets and sensitive IDs out of client-side persistence unless there is a very specific reason and a documented review.

