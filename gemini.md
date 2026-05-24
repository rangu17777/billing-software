# 🏛️ Project Constitution — AA. Nagare Infra Machinery Billing Software

> **Status:** 🟢 BLUEPRINT APPROVED — ALL ITEMS LOCKED
> 
> This file is LAW. All code must conform to the schemas and rules defined here.
> Updated only when: schema changes, rules added, or architecture modified.

---

## 📌 Project Identity

| Field | Value |
|---|---|
| **Project** | AAN Billing Software |
| **Client** | AA. Nagare Infra Machinery |
| **Version** | 0.0.0 (Pre-Blueprint) |
| **Created** | 2026-05-23 |

---

## 📐 Data Schemas

> ⚠️ **PENDING** — Schemas will be defined after Discovery Questions are answered.

### Bill Schema (Draft — from physical bill analysis)

```json
{
  "bill": {
    "billNo": "number (auto-increment)",
    "date": "string (DD/MM/YYYY)",
    "client": {
      "name": "string",
      "siteName": "string",
      "mobile": "string",
      "address": "string",
      "gstNo": "string"
    },
    "lineItems": [
      {
        "srNo": "number",
        "date": "string (DD/MM)",
        "challanNo": "string",
        "description": "string (JCB, Tractor, etc.)",
        "vehicleNo": "string",
        "qtyUnit": "string (hours or 'full day')",
        "rate": "number",
        "amount": "number"
      }
    ],
    "totals": {
      "subtotal": "number",
      "sgst": "number (9%)",
      "cgst": "number (9%)",
      "grandTotal": "number",
      "advance": "number",
      "balance": "number",
      "amountInWords": "string"
    }
  }
}
```

---

## 🔒 Behavioral Rules

1. **GST Compliance:** All bills MUST calculate SGST (9%) and CGST (9%) on the subtotal.
2. **Indian Format:** Dates in DD/MM/YYYY, currency in ₹, amounts in Indian numbering (Lakhs, Crores).
3. **Amount in Words:** Must use Indian English format (e.g., "Sixty Two Thousand Five Hundred Fourty Only").
4. **Bill Numbering:** Sequential, never duplicated, auto-incrementing.
5. **Rate Logic:** 
   - Hourly: Amount = Hours × Rate
   - Daily: Amount = Days × Rate
6. **Multi-line Bills:** A single bill can contain multiple machines across multiple dates.

---

## 🏗️ Architectural Invariants

> ✅ **CONFIRMED** — 2026-05-23

| Layer | Technology | Decision |
|---|---|---|
| Frontend | Vite + Vanilla JS | Lightweight, no framework |
| Authentication | Firebase Auth | Owner-only admin login |
| Backend / DB | Supabase (PostgreSQL) | Data storage, bill records |
| PDF Generation | jsPDF + jspdf-autotable | Client-side, matches bill layout |
| Excel Export | SheetJS (xlsx) | Client-side export |
| Hosting | Netlify | Deploy from GitHub |
| Styling | Custom CSS | Full control over print styles |

### Decision Log
| Question | Decision |
|---|---|
| Bill numbering | Start from **1** (fresh digital system) |
| Hours input | **Two separate fields** — Hours (number) + Minutes (0/15/30/45 or free input) |
| Auth provider | **Firebase Authentication** (single admin user) |
| App type | **Single user** — owner/admin only |
| Deployment | **Hosted online** (Netlify) |
| AAN GST No. | **27BISPN4599L1Z3** ✅ |

---

## 📝 Maintenance Log

| Date | Change | Reason |
|---|---|---|
| 2026-05-23 | Initial creation | Protocol 0 initialization |
| 2026-05-23 | Architectural invariants confirmed | User answered Q1–Q6 (GST still pending) |
| 2026-05-23 | Company GSTIN locked: 27BISPN4599L1Z3 | Blueprint 100% complete — all blockers resolved |
