## 1. Restaurant tables (booking/occupancy)

- `restaurant_tables` table already exists — add a `Tables` tab in `app.restaurant.tsx` (alongside POS) for owners/managers to add/edit tables (number, capacity, location) and a visual grid showing status: **Free / Occupied / Reserved / Cleaning**.
- When a POS order is opened "for table X", that table flips to **Occupied** and the order is linked via `orders.table_id`. Closing/paying the order flips it back to **Free** (or **Cleaning** based on a setting).
- POS gets a "Dine in / Takeaway / Room charge" selector; Dine in requires picking a free table.

## 2. Dedicated Super Admin (separate from app)

- Hardcode allowed super-admin email = `clementmwila005@gmail.com` in `auth.functions.ts`.
- New server fn `ensurePlatformAdmin` auto-seeds that account with password `Jokermind12@` and the `super_admin` role on first call.
- `/super-admin/login` rejects any other email; "first-time setup" UI is removed.
- Super admin no longer appears in the normal `/app` sidebar — `/app/super-admin` redirects to `/super-admin` (its own shell with platform tools), and regular owners never see super-admin nav.

## 3. Receipts (print + WhatsApp + email)

- New `src/components/receipt.tsx` — clean printable A6/80mm receipt (business name, code, address, items, totals, payment method, served by, timestamp).
- New `src/lib/receipt.ts`:
  - `printReceipt(orderId)` → opens print dialog (CSS `@media print`).
  - `whatsappReceipt(orderId, phone?)` → opens `https://wa.me/<phone>?text=<encoded receipt text>`.
  - `emailReceipt(orderId, email?)` → `mailto:` with subject + body.
- Hook into POS "Pay / Charge to room" success, and add a Receipt button on each row in folio/orders history.
- Same component reused for **folio receipt** at room check-out.

## 4. Expenses module

- New table `expenses` (business_id, department `bar|restaurant|accommodation|general`, category, amount, note, paid_with, expense_date, recorded_by) with RLS + GRANTs.
- New route `/app/expenses` — list + add/edit/delete, filter by department and date range. Owner/manager only.

## 5. Reports — per-department P&L + combined

Rewrite `app.reports.tsx`:

- Period selector (Today / Week / Month / Custom) — already exists, keep.
- **Tabs**: `Combined | Bar | Restaurant | Accommodation`.
- Each tab shows:
  - **Revenue** (orders/folio lines for that dept; accommodation = room charges only).
  - **COGS** (sum of `stock_movements` of type `sale` × cost price for that dept).
  - **Expenses** (from `expenses` table filtered by department).
  - **Gross profit** = Revenue − COGS − Expenses.
  - **Shortages** = sum of stock adjustments where reason = shortage/wastage/damage (cost value), per dept.
  - **Inventory snapshot** — current stock value + low-stock list for that dept's products.
- Combined tab = totals across all three plus "General" expenses.
- Export to CSV button per tab.

## 6. Migration summary

- New `expenses` table (+ GRANTs + RLS: business members read; managers/owners write).
- `products` already has `department`; ensure `stock_adjustment_requests` / `stock_movements` carry department implicitly through product link (no schema change).
- `orders.table_id` already exists — no schema change there.
- Add `reason` enum value coverage for shortages if missing (text column, no change needed).

## Technical notes

- All new server fns use `requireSupabaseAuth`; writes are scoped via `current_business_id()` and role checks (`is_business_owner` or new `is_manager_or_owner` helper).
- Receipts are 100% client-rendered — no email infra/API keys required.
- Super-admin auto-seed uses `supabaseAdmin` inside the handler (dynamic import), runs only if no `super_admin` exists or that email isn't yet super-admin.
- Mobile-responsive: tables grid, expenses list, reports tabs all use the same responsive patterns already in the app. and also this is a tackstack app make it a fully vite app so it can be hosted on vercel
