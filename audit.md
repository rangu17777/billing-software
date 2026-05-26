# 📋 AAN Billing Software: Quick Audit & Presenter Guide

This is a concise, high-impact guide designed to help you quickly understand the webapp and explain its immediate business value to **AA. Nagare Infra Machinery (AAN)**.

---

## 🏛️ 1. What is the App?
A custom, secure, cloud-connected billing web application that digitizes AAN's physical bill books—automating calculations, securing database records, and instantly generating GST-compliant PDFs and Excel files.

---

## 💼 2. Top 5 Business Benefits for the Client
*   **Zero Math Errors:** Automatically converts machinery hours (e.g., `7.30` hours $\rightarrow$ 7.5 hours) and days (e.g., `full day`) into correct invoice amounts.
*   **Instant GST Compliance:** Automatically computes State GST (SGST 9%) and Central GST (CGST 9%) and prints AAN’s official GSTIN (**27BISPN4599L1Z3**) on every bill.
*   **Better Cash Flow:** A single dashboard tracks exactly how much money is outstanding (Balance Due) and how much advance has been paid across all clients.
*   **1-Click Sharing:** Instantly generates professional, brand-aligned PDFs and provides a one-click button to send them directly via WhatsApp.
*   **Fast Audits:** Generates a clean Excel spreadsheet of all bills to hand directly to the accountant for quarterly GST filing.

---

## 🚀 3. Core Features Checklist
*   **Metrics Dashboard:** Live totals for Billed Value, Received Advances, and Outstanding Balances.
*   **Transactional Bill Creator:**
    *   Search/create clients inline.
    *   Auto-fill machine details, registration plates, and rates.
    *   Hours-and-minutes selector popover (no manual decimal math needed).
    *   Automatic draft autosave (saves every 5 seconds to prevent data loss).
*   **Client & Fleet Master:** Centralized tab to manage recurring client profiles and machinery details.
*   **Print-Engine & PDF:** Beautiful Crimson Red & Navy Blue PDF designed to fit exactly on an A4 sheet.
*   **Excel Export:** Fast SheetJS `.xlsx` exporter.
*   **Admin Auth:** Owner-only login via Firebase.

---

## 🖥️ 4. How to Demonstrate to AAN in 3 Minutes

*   **Step 1: The Dashboard (The Health Check)**
    *   Log in and point out the **Total Outstanding Balance** card. Tell them: *"This is the exact money currently waiting to be collected from clients."*
*   **Step 2: Create a Smart Bill (The Magic)**
    *   Go to **New Bill**, select a client, and watch their address/GST details auto-fill.
    *   Add a machine (e.g., a JCB). Type `8.30` in Qty (or use the **Hrs...** popover). Watch the system calculate the rate correctly for $8.5$ hours.
    *   Add a second line, select a Tractor, and click the **full day** preset chip.
    *   Show how the 9% SGST and 9% CGST calculate automatically, alongside the pre-written **Amount in Words**.
*   **Step 3: Print & Share**
    *   Save the bill, open the generated PDF, and point out the clean company letterhead, matching colors, and signature lines.
    *   Click **Share** to demonstrate opening WhatsApp with a pre-formatted message.
*   **Step 4: Accountant Export**
    *   Go to the Invoices tab, click **Export to Excel**, and show how one spreadsheet lists every single transactional detail.

---

## 🛠️ 5. Technical Stack
*   **Frontend:** Vite + Vanilla JS (fast page loading, zero framework lag).
*   **Backend & DB:** Supabase (secure PostgreSQL database with Row-Level Security).
*   **Auth:** Firebase Authentication (owner-only console).
*   **PDF & Excel:** jsPDF (vector prints) & SheetJS (local spreadsheet generation).
*   **Hosting:** Netlify (continuous deployment).
