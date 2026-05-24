# 📋 Task Plan — AAN Billing Software
> **Status:** 🟡 BLUEPRINT DRAFT — Awaiting 6 Decisions
> **Last Updated:** 2026-05-23

---

## 🎯 North Star
Build a web-based billing software for AA. Nagare Infra Machinery that digitizes their physical bill book — letting them create, manage, print, and export GST-compliant bills for machinery rental services.

---

## 📦 Modules (7 Total)

| # | Module | Status |
|---|---|---|
| 1 | Authentication (Login/Logout) | ⏳ Pending decisions |
| 2 | Dashboard (Bill stats, quick actions) | ⏳ Pending decisions |
| 3 | Bill Creator (Multi-line form) | ⏳ Pending decisions |
| 4 | Bill Viewer / List | ⏳ Pending decisions |
| 5 | PDF Generator (Print-ready bill) | ⏳ Pending decisions |
| 6 | Excel Export | ⏳ Pending decisions |
| 7 | Client / Machine Master Data | ⏳ Pending decisions |

---

## 🏗️ Phase Checklist

### Phase 0 — Initialization ✅
- [x] Analyze physical bill books (Bills 156, 157, 158)
- [x] Extract bill schema
- [x] Extract brand identity & colors
- [x] Analyze login/dashboard design references
- [x] Create `gemini.md` (Project Constitution)
- [x] Create `findings.md`
- [x] Create `progress.md`
- [x] Create `task_plan.md` (this file)
- [ ] Get answers to 6 pending decisions → **BLOCKED HERE**

### Phase 1 — Blueprint 🔄
- [ ] **Q1–Q6 answered by user**
- [ ] Finalize tech stack in `gemini.md`
- [ ] Finalize DB schema in `gemini.md`
- [ ] Write Architecture SOPs in `architecture/`
- [ ] User approves blueprint

### Phase 2 — Link (API Connections)
- [ ] Initialize Supabase project
- [ ] Test auth connection
- [ ] Test DB read/write
- [ ] Store keys in `.env`

### Phase 3 — Architect (Build)
- [ ] **Module 1:** Auth (Login page → glassmorphism)
- [ ] **Module 2:** Dashboard
- [ ] **Module 3:** Bill Creator form
- [ ] **Module 4:** Bill List / Viewer
- [ ] **Module 5:** PDF Generator (exact bill layout)
- [ ] **Module 6:** Excel Export
- [ ] **Module 7:** Client + Machine master data

### Phase 4 — Stylize
- [ ] Apply AAN brand colors (#D32F2F, #FFC107, #1A237E)
- [ ] Match login glassmorphism design
- [ ] Match dashboard card layout
- [ ] PDF matches physical bill format exactly
- [ ] User review & feedback

### Phase 5 — Trigger (Deploy)
- [ ] Deploy to hosting (Netlify / Vercel)
- [ ] Final testing on live URL
- [ ] Maintenance log updated in `gemini.md`

---

## ❓ 6 Pending Decisions (Blocking Phase 1)

| # | Question | Decision |
|---|---|---|
| Q1 | AAN's own GST number | ⚠️ **PENDING** — user to provide |
| Q2 | Bill number start | **1** (fresh digital system) |
| Q3 | Hours input format | **Two separate fields** (Hours + Minutes) |
| Q4 | Single vs multi-user | **Single user** — admin/owner only |
| Q5 | Deployment target | **Hosted online** — Netlify |
| Q6 | Tech stack | **Firebase Auth + Supabase** backend ✅ |

---

## 🔧 Confirmed Tech Stack ✅

| Layer | Technology | Why |
|---|---|---|
| Frontend | Vite + Vanilla JS | Lightweight, no framework overhead, fast build |
| Auth | Firebase Auth | Single admin user, secure, owner-only login |
| Backend / DB | Supabase (PostgreSQL) | Hosted Postgres, REST API, real-time |
| PDF | jsPDF + jspdf-autotable | Client-side, matches bill table format |
| Excel | SheetJS (xlsx) | Client-side Excel export |
| Hosting | Netlify | Free, simple deploy from GitHub |
| Styling | Custom CSS (no framework) | Full control over print styles |

---

## 📊 DB Schema (Draft — pending confirmation)

```sql
-- Clients
clients (id, name, site_name, mobile, address, gst_no)

-- Machines
machines (id, description, vehicle_no, rate_type[hourly|daily], default_rate)

-- Bills
bills (id, bill_no, date, client_id, subtotal, sgst, cgst, grand_total, 
       advance, balance, amount_in_words, created_at)

-- Bill Line Items
bill_items (id, bill_id, sr_no, date, challan_no, machine_id, 
            description, vehicle_no, qty_unit, rate, amount)
```
