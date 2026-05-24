---
skill: brand-identity
version: 1.0.0
project: AAN Billing Software
applies-to: ["*.html", "*.css", "*.js", "*.pdf*"]
trigger: "any time UI, CSS, PDF layout, visual design, or user-facing text decisions are made"
resources:
  - resources/design-tokens.json
  - resources/tech-stack.md
  - resources/voice-tone.md
---

# AAN Brand Identity

**Company:** AA. Nagare Infra Machinery  
**Tagline:** "Strength in Every Move"  
**GSTIN:** 27BISPN4599L1Z3  
**GST Rates:** SGST 9% + CGST 9%

## When to Apply

- Writing any CSS rule (color, spacing, radius, font, shadow)
- Designing a page, card, or component
- Building the PDF bill layout (column widths, fonts, margins)
- Writing any user-facing label, button, heading, or error message
- Choosing a library or framework (check tech-stack.md first)

## Resource Routing

| Task | Read |
|---|---|
| Color, spacing, font, shadow, PDF mm values | `resources/design-tokens.json` |
| Library/framework choices, forbidden patterns, env vars | `resources/tech-stack.md` |
| Labels, date/currency format, copy tone | `resources/voice-tone.md` |

## Non-Negotiable Rules

1. Load `resources/design-tokens.json` before writing ANY CSS color, radius, or spacing value.
2. Never use Tailwind, Bootstrap, or any CSS framework — custom CSS only.
3. Never use React, Vue, Svelte, or any JS framework — Vanilla JS only.
4. All monetary values use ₹ and Indian numbering (Lakhs, Crores).
5. All dates render as DD/MM/YYYY. Never use MM/DD/YYYY or ISO 8601 for display.
6. Hours display on bill: `7.30 hrs` means 7 hours 30 minutes (AAN notation). Store as `7.5` decimal internally.
7. The PDF bill must visually match physical bill books 156–158 in `dataAA/`.
8. The login page uses glassmorphism card — see `glassmorphism` token in design-tokens.json.
