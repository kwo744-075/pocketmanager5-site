# Cadence App Integration (Pocket Manager App)

This doc describes how the Pocket Manager Expo app should integrate with the Cadence (DM portal) web endpoints.

## Endpoints

- POST /api/cadence/dm-list
  - Payload: { shopId, shopName, message, category, priority }
  - Response: 201 { success: true, data: ... }

- POST /api/cadence/labor
  - Payload: { date, shopId, expectedLaborPct, actualLaborPct, notes }
  - Response: 201 { success: true, data: ... }

- POST /api/cadence/deposits
  - Payload: { date, shopId, bankVisitVerified, depositAmount, expectedAmount, cashOverShort, notes }
  - Response: 201 { success: true, data: ... }

## + DM List Pill

- Label: `+ DM List`
- Behavior: opens a quick ask form in the app. On submit the app POSTs to `/api/cadence/dm-list`.
- Fields the app should send (JSON):
  - `shopId` (string) // required
  - `shopName` (string) // optional but recommended
  - `message` (string) // required
  - `category` (string) // one of: Ops, People, Inventory, HR, Other
  - `priority` (string) // one of: Low, Normal, High
  - files: For now app can upload attachments later (not implemented in this pass). Page will accept file refs in future.

## Labor & Deposit

- The app will use the same payload shapes as the web forms.
- Labor: POST to `/api/cadence/labor` with `LaborEntryPayload`.
- Deposit: POST to `/api/cadence/deposits` with `DepositEntryPayload` and (later) upload images to Supabase Storage or S3 and include file URL references in the payload.

## Notes

- Current API routes are stubs returning mock data. They should be wired to Supabase in a future pass.
- All endpoints should return consistent JSON `{ success: boolean, data?: any, error?: string }`.
