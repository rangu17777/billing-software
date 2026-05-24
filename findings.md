# 📋 Findings — AA. Nagare Infra Machinery Billing Software

## Discovery Date: 2026-05-23

---

## 🏢 Company Profile

| Field | Value |
|---|---|
| **Company Name** | AA. Nagare Infra Machinery |
| **Short Name / Logo** | AAN |
| **Tagline** | "Strength in Every Move" |
| **Address** | A/p. Ambadwet, Tal. Mulshi, Dist - Pune |
| **Phone** | 7875396396 / 9921353533 |
| **Email** | aanagre.machinery@gmail.com |
| **GST No.** | 27BISPN4599L1Z3 (Company's own GSTIN) |
| **Business Type** | Infrastructure machinery rental & services |

---

## 🧾 Bill Structure (From Physical Bill Books)

### Header Section
- Company logo (AAN) + Full company name + tagline
- Company address, phone, email
- **To:** Client name
- **Site Name:** Project site location
- **Bill No.:** Sequential bill number (e.g., 156, 157, 158)
- **Date:** Bill date (DD/MM/YYYY format)
- **Mob.:** Client mobile number

### Line Items Table
| Column | Description |
|---|---|
| Sr. No. | Serial number |
| Date | Date of service (DD/MM format) |
| Challan No. | Delivery challan reference number |
| Description | Machine type (JCB, Tractor, Tractor-2, etc.) |
| Vehicle No. | Vehicle registration number (e.g., 0396, 0386) |
| Qty./Unit | Hours worked (e.g., 7.30, 8.00) or "full day" / "2/fullday" |
| Rate | Rate per unit (e.g., 1000/hr for JCB, 3500/day for Tractor) |
| Amount | Calculated amount (Qty × Rate) |

### Footer / Totals Section
- **Total:** Sum of all line item amounts
- **SGST (9%):** State GST at 9%
- **CGST (9%):** Central GST at 9%
- **Grand Total:** Total + SGST + CGST
- **Client Details:** Full client name, address, GST number
- **Advance:** Advance payment received
- **Balance:** Grand Total - Advance
- **Rs. In Words:** Grand total amount in words (Indian format)
- **Authorised Signatory:** Signature area with "For AA. NAGARE INFRA MACHINERY"

---

## 🎨 Design References

### Login Page (from reference image)
- Glassmorphism card design on vibrant background
- Email + Password fields with icons
- "Keep me logged in" checkbox + "Forgot password?" link
- Login button with gradient
- Social login (Apple, Google, X)
- Trust indicator at bottom

### Dashboard (from reference image)
- Clean, modern layout with rounded cards
- Navigation bar with multiple sections
- Welcome message with user stats
- Progress tracking, Time tracker, Calendar
- Onboarding task list
- Warm color palette with card-based layout

### Brand Colors (from logos)
- **Primary Red:** #D32F2F (AAN logo red)
- **Primary Orange:** #E65100 (AAN logo orange)
- **Dark Navy:** #1A237E (text color)
- **Accent Yellow:** #FFC107 (from machinery theme)
- **White:** #FFFFFF (backgrounds)

---

## 📐 Key Business Logic

1. **Rate Calculation:**
   - Hourly rate: Amount = Hours × Rate (e.g., 7.30 hrs × ₹1000 = ₹7300)
   - Full day rate: Amount = Days × Rate (e.g., 1 full day × ₹3500 = ₹3500)

2. **GST Calculation:**
   - SGST = Total × 9% (rounded)
   - CGST = Total × 9% (rounded)
   - Grand Total = Total + SGST + CGST

3. **Bill Numbering:** Sequential, auto-incrementing

4. **Multiple machines per bill:** A single bill can have JCB + Tractor entries on same date

5. **Amount in Words:** Indian numbering system (Lakhs, Thousands, Hundreds)

---

## 🔍 Constraints Discovered

- Bills use Indian date format (DD/MM/YYYY)
- Indian currency (₹) with Indian numbering
- GST-compliant billing (SGST + CGST)
- Physical bill book digitization — must match the existing paper format
- Multiple vehicle types with different rate structures (hourly vs daily)
- Challan-based tracking system
