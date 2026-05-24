# AAN Tech Stack Reference

## Locked Stack — Do Not Deviate

| Layer | Library/Tool | Notes |
|---|---|---|
| Build | Vite (latest stable) | Entry: `index.html`, `vite.config.js` |
| Frontend | Vanilla JS (ES2022+) | No React, Vue, Svelte, Angular |
| Styling | Custom CSS | No Tailwind, Bootstrap, Bulma, or any CSS framework |
| Auth | Firebase Auth SDK v10 | Single admin user only |
| Database | Supabase JS v2 | PostgreSQL via REST |
| PDF | jsPDF + jspdf-autotable | Client-side, A4 layout |
| Excel | SheetJS (xlsx) | Client-side `.xlsx` export |
| Hosting | Netlify | Deploy from GitHub `main` branch |

## Forbidden Patterns

- No `import` of any CSS framework (`tailwind`, `bootstrap`, `bulma`, etc.)
- No `import` of any JS framework or library beyond the locked stack above
- No jQuery
- No `<script src="...cdn...">` tags — use npm imports only
- No inline styles on elements that appear multiple times — use CSS classes

## Environment Variables (Vite prefix: `VITE_`)

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Access in code: `import.meta.env.VITE_FIREBASE_API_KEY`

## Module File Structure

```
src/
├── shared/          ← utilities used by all modules
│   ├── firebase.js
│   ├── supabase.js
│   ├── toast.js
│   ├── hours-utils.js
│   ├── amount-words.js
│   └── draft-manager.js
├── auth/
│   ├── auth.js
│   └── auth.css
├── dashboard/
│   ├── dashboard.js
│   └── dashboard.css
├── bills/
│   ├── bill-creator.js
│   ├── bill-creator.css
│   ├── bill-list.js
│   └── bill-list.css
├── pdf/
│   └── pdf-generator.js
├── excel/
│   └── excel-export.js
└── clients/
    ├── clients.js
    └── clients.css
```

## Critical Business Logic Rules

- **Hours:** User inputs Hours (integer) + Minutes (0/15/30/45). Store as decimal. Display as AAN notation.
  - `toDecimalHours(7, 30)` → `7.5`
  - `toAanHoursDisplay(7.5)` → `"7.30 hrs"`
- **Amount (hourly):** `decimalHours × rate`
- **Amount (daily):** `days × rate`  
- **SGST:** `subtotal × 0.09` (round to 2 decimal)
- **CGST:** `subtotal × 0.09` (round to 2 decimal)
- **Grand Total:** `subtotal + sgst + cgst`
- **Amount in Words:** Indian format — Crores → Lakhs → Thousands → Hundreds, ending with "Only"
