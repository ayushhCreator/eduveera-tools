# Eduveera Tools — Product Requirements Document

Source of truth: `docs/Eduveera_Developer_Final_MVP_Brief_v2.pdf` ("the brief"). Every requirement below is either taken directly from the brief or explicitly marked **[Technical Recommendation]** where the brief is silent on implementation detail. Nothing else is in scope.

## 1. Product Overview

Eduveera Tools is a set of paperless-registry utility tools added to the existing Eduveera website. Budget and scope are deliberately small (brief: ~₹2,000–₹3,000 dev budget) — the mandate is a **working MVP**, not a polished product. Priority order per the brief: working functionality > accurate Hindi conversion > visual polish.

Four tools, one credit system, one admin panel:

1. **Image Compressor**
2. **Passport Photo**
3. **Hindi Converter** (Unicode ↔ Kruti Dev)
4. **Smart Detection** (helper for #3)

## 2. MVP Goals

- Ship four working tools behind a credit-gated system.
- Credits are auditable: every balance change is backed by a transaction record.
- Payment path works even without a payment gateway (manual UPI + UTR + admin approval).
- Admin can manage users, credits, and pending payments.
- Kruti Dev ↔ Unicode conversion is architected around **known, verified legacy mappings** — never guessed.

## 3. MVP Non-Goals

Directly excluded by the brief (Section 11):

- Native Android/iOS app.
- Advanced PDF editor.
- AI face detection or AI background removal.
- Large-scale analytics/reporting system.
- Referral/affiliate system.
- Complex subscription/billing management.
- Multi-language UI expansion beyond agreed labels (Hindi + English labels only).
- Any tool/feature not listed in the brief without prior approval.

Also non-goals for Day 1 (brief says "future"):
- A4 multi-copy passport photo sheet (architecture must allow it later, not build it now).
- Payment gateway (Razorpay) automation — manual UTR approval is the MVP path; gateway webhook is future.

## 4. User Types

| Type | Description |
|---|---|
| **Guest** | Unauthenticated visitor. Can view tool landing pages; must sign in to run a tool or hold credits. |
| **Registered User** | Signed-in user with a profile, a credit balance, transaction history, and payment history. |
| **Admin** | Elevated user who manages users, credits, and payment approvals via the admin panel. Not a separate signup path — granted via `admin_users` (see [DATABASE.md](DATABASE.md)). |

## 5. User Journeys

### 5.1 New user runs a tool
1. Visits site, opens a tool (e.g., Image Compressor).
2. Prompted to sign in / sign up if not authenticated.
3. If credit balance insufficient for the tool's cost, shown "buy credits" path (Section 5.6).
4. Uploads file / pastes text → processes → sees result → downloads.
5. On success, credits are deducted and a transaction is recorded. On failure, nothing is deducted.

### 5.2 Image Compressor
1. User uploads an image.
2. Chooses a target: **Under 100 KB**, **Under 50 KB**, **Under 30 KB**, or **Custom**.
3. Tool compresses image toward the target.
4. UI shows **original size** and **final size** (KB).
5. User downloads the compressed image.
6. Must work smoothly on mobile (brief, Section 3).

### 5.3 Passport Photo
1. User uploads a photo.
2. Crops / zooms / repositions within a fixed passport-style frame.
3. Tool outputs a fixed passport-style ratio/size image.
4. User downloads as JPG.
5. Day-1 explicitly does **not** require AI background removal (brief, Section 4) — keep it simple.
6. Architecture must leave room for a future A4 multi-copy sheet (not built now).

### 5.4 Hindi Unicode ↔ Kruti Dev Converter
1. User pastes text.
2. **Smart Detection** identifies whether the pasted text looks like Unicode Devanagari or a supported legacy/ASCII-style (Kruti Dev-family) pattern.
3. User confirms/selects direction (Kruti Dev → Unicode, or Unicode → Kruti Dev).
4. Tool converts and displays the result; user copies/downloads.
5. If Smart Detection cannot confidently classify the text, it must say so rather than guess (see [AI_RULES.md](AI_RULES.md)).

### 5.5 Smart Detection
- Pure classification helper, not a standalone deliverable: pasted text → "Unicode" / "supported legacy pattern" / "unknown."
- Must never label arbitrary ASCII as a Hindi legacy encoding on a guess — only recognized, verified patterns.

### 5.6 Buying credits (manual UPI/UTR path — MVP payment)
1. User selects a credit pack (₹ amount → credit quantity, admin-configured).
2. User pays via UPI outside the app (or via gateway if later integrated) and submits the **UTR** (or gateway payment ID) against that pack.
3. Payment row is created with status `pending`, linked to the user.
4. Admin reviews pending payments in the admin panel and approves or rejects.
5. On approval: credits are added to the user's balance and a transaction is recorded, atomically.
6. On rejection: no credits added; user sees rejection status.
7. **[Technical Recommendation]** A Razorpay (or similar Indian gateway) webhook can later automate step 3–5; the brief explicitly allows starting with manual UTR if gateway integration would delay the MVP (Section 6).

### 5.7 Admin journey
1. Admin logs in (Section 7 below).
2. Searches/views users and their credit balances.
3. Manually adds/removes credits for a user (always produces a transaction record).
4. Views full transaction history.
5. Views and actions pending UTR/payment requests (approve/reject).
6. Views basic tool-usage counts.

## 6. Feature Requirements

### 6.1 Image Compressor
- Presets: Under 100 KB, Under 50 KB, Under 30 KB, Custom (brief, Section 3).
- Show original size and final size.
- Prefer client-side processing where practical (brief) — see [ARCHITECTURE.md](ARCHITECTURE.md) for how this is reconciled with server-side credit deduction.
- Must work smoothly on mobile.

### 6.2 Passport Photo
- Upload → crop/zoom/reposition → fixed passport-style ratio/size → JPG download.
- No AI background removal in MVP.
- Exact output dimensions/DPI are **not specified in the brief** — flagged as a missing input in [TODO.md](TODO.md); a placeholder default must be confirmed with the client before shipping.
- Architecture must allow adding an A4 multi-copy sheet output later without a redesign.

### 6.3 Hindi Converter
- Kruti Dev → Unicode.
- Unicode → Kruti Dev.
- Must not treat arbitrary ASCII as a Hindi encoding — only support known, verified legacy mappings/patterns.
- Mapping tables must be modular so future legacy fonts can be added as new data modules, not code rewrites.
- Test corpus must include: matras, half letters, conjuncts, punctuation, numbers, mixed Hindi/English, real deed samples, and supported legacy/ASCII-style samples (brief, Section 2; detailed in [TESTING.md](TESTING.md)).
- **Missing input:** the brief contains no actual mapping table data and no real deed sample text. This is a blocking dependency for correctness — tracked in [TODO.md](TODO.md).

### 6.4 Smart Detection
- Classifies pasted text as Unicode / known-legacy / unknown.
- Feeds the Hindi Converter's direction selection; not a separately billed action (see credit policy below).

## 7. Credit System (product-level)

- Every user has a `user_id` + `credit_balance` (brief, Section 5).
- Every credit addition/deduction creates a transaction record — no silent balance changes.
- A successful tool action deducts credits; a failed one does not.
- Admin can add/remove credits manually.
- Pricing is configurable (per-tool credit cost, and ₹-to-credit packs), not hard-coded.
- **[Technical Recommendation]** Which actions are billable and at what rate: Image Compressor, Passport Photo, and Hindi Converter conversions are credit-metered tool actions; Smart Detection is a free assistive step (it produces no downloadable output, only a classification). Rationale and full mechanics in [ARCHITECTURE.md](ARCHITECTURE.md) and [DATABASE.md](DATABASE.md). Actual credit costs per tool are not specified in the brief — seeded as configurable placeholders, not fixed requirements.

## 8. Payment / UPI / UTR Flow (product-level)

- Preferred long-term: Indian payment gateway (brief names Razorpay as an example).
- MVP-acceptable: manual UPI payment + UTR submission + admin approval (brief, Section 6).
- User selects a credit pack; payment/UTR is linked to that user.
- Admin approves or rejects; approval adds credits and creates a transaction.
- Credits change **only** server-side, never from a client-supplied value.
- Gateway webhook automation is an explicit future step, not MVP scope.

## 9. Admin Panel (product-level)

- Admin login.
- Search/view users.
- View balance.
- Add/remove credits.
- View transaction history.
- View pending UTR/payment requests (approve/reject).
- Basic tool-usage count.

## 10. UI/UX Requirements

- Mobile-first.
- Clear tool cards/buttons on the landing/dashboard.
- Minimal steps per tool: upload/paste → process → download.
- Labels in Hindi + English (bilingual-friendly, not a full i18n system).
- Clear processing state and clear, specific error messages (not generic "something went wrong").

## 11. Security / Privacy Requirements (product-level)

Full detail in [SECURITY.md](SECURITY.md). Product-level requirements from the brief:

- Validate uploads and file types.
- Protect admin routes and credit-mutating APIs.
- HTTPS everywhere.
- Do not publicly expose user files.
- Do not retain photos/documents unnecessarily (delete/expire processed files after their useful window).

## 12. Acceptance Criteria

Taken verbatim from the brief's Acceptance Test / Handover section (12):

- [ ] Photo successfully compressed below 100 KB.
- [ ] Passport photo generated and downloaded.
- [ ] Kruti Dev ↔ Unicode conversion demonstrated on real deed text.
- [ ] Legacy/ASCII-style sample tested.
- [ ] Credit deduction/addition works correctly.
- [ ] Admin can manually adjust credits.
- [ ] Payment/UTR flow works (if included in this milestone).
- [ ] Source code, database/schema, admin access, and deployment access handed over.

## 13. Future Considerations (explicitly deferred by the brief)

- Razorpay (or other Indian gateway) integration with automated webhook verification.
- A4 multi-copy passport photo sheet output.
- Additional legacy font mapping tables beyond the initial verified set (modular by design).
- Any tool/feature not in this document requires prior approval before being added — see [AI_RULES.md](AI_RULES.md), "Do not add out-of-scope features."
