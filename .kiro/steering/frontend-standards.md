---
inclusion: fileMatch
fileMatchPattern: '*.tsx|*.jsx'
---

# Frontend Development Standards

## UI Structure
- Keep page-level layouts dense and operational rather than decorative.
- Use the existing Tailwind and shadcn/ui conventions already present in the repo.
- Keep navigation predictable: sidebar links, command palette, and route-level pages should match.

## Components
- Prefer small, focused React components.
- Keep state local unless it needs to be shared across the app.
- Avoid adding a new abstraction when an existing component or utility already matches the pattern.

## Accessibility
- Use semantic HTML and accessible labels for controls.
- Keep color contrast readable in both light and dark themes.
- Ensure drawers, dialogs, and menus have predictable keyboard behavior.

## Interaction Design
- Keep tables and filters usable with large result sets.
- Make destructive or sensitive actions explicit.
- When opening external pages, protect the opener context.

