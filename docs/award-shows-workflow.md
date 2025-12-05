# Award Shows Workflow Requirements

## Source Inputs

- **Employee Performance (EPR)** — Excel export with manager-level roster (hire date, NPS, oil change counts, employee scores).
- **Power Ranker** — Shop leaderboard covering period, rank, DM, RD, division, KPI deltas.
- **Period Winner by Shop** — Region rollup used to pre-fill qualifiers / tie-breakers.
- **P10 Inventory + supporting PPT/PDF references** — Used only for validating layout / brand guardrails of the final deck.

All sample files now live under `PocketManager5_sitetmpupload_samples/` so the Next.js app can read them while we shape the parser.

## Sample workbook schema (Dec 4 capture)

| Workbook | Sheets | Key headers | Notes |
| --- | --- | --- | --- |
| Power Ranker – Shop | 1 (`Sheet1`) | Division, Region, District, `Shop Number`, `Overall Ranking`, `Net Sales - Variance - CY`, `Net Sales - Ranking (30%)`, `NPS %`, `NPS % - Ranking (20%)`, `Email Collection % - CY`, rank-weighted KPI slots for Ticket, Big 4, Coolant, CPD | 56 shop rows. Metric columns mix absolute % strings plus ranking integers; need to strip `%`/commas and pair each metric with its weight for PPT callouts. |
| Period Winner by shop | 1 (`Sheet1`) | District, Store, Cars CY/Budget/PY, Cars variance (abs + %), Net Sales CY/Budget/PY, Net Sales variance (% + $), Email %, Discounts %, Big 4 %, Radiator %, Differential %, NPS CY | 52 rows. Some cells use dots `.` for blanks and prefixed currency values. Provides deeper KPI context for RD slides. |
| EPR sample | 1 (`Sheet1`) | Workday Employee ID, Tech Name, Job Title, Store #, Score, NPS %, Survey count, Email %, PMIX, Big4, Bay Time, Oil Changes, Gross/Net ARO, Discount per Oil Change, product attachment %, Donations, Hire Date, Region, District | 477 rows. Hire Date column mixes dates + `-` placeholders; convert to ISO for anniversaries/birthdays. |
| P10 Inventory Region | 6 (`P10 - 10-04` … `P10 PTD`) | District, component-level +/- counts (Lubricants/Oil, Filters, Wipers, Cabins), Adjustment variance $, On-time counts, Count compliance %, Comp Sales $, Comp attainment %, Big 4 %, Coolant %, period target | Sheets represent weekly snapshots plus PTD rollup (≈382 rows each). Only needed if we later blend inventory callouts into slides. |

> These summaries come from `tmp/inspectAwardSamples.mjs` (`node tmp/inspectAwardSamples.mjs`). Keep the script handy as headers drift.

## Target Experience

1. **Qualifiers**
   - Power Ranker + Period Winner uploads generate qualifying shop & manager pools (region floors, oil change min, NPS min).
   - Result feeds both DM “Region Award Winner Qualifiers” banner and RD confirmation grid used for Award Shows slide.

2. **Employee Performance ingest**
   - EPR upload becomes the authoritative employee dataset. Includes hire dates (for anniversaries), NPS surveys, oil changes, retention, CSI, safety.
   - Data hydrates the Recognition Captain dataset rows (existing upload slot) so the current KPI guardrails keep working.

3. **Shop KPI ingest**
   - Shop-level workbook (Power Ranker / Period Winner) powers car count, ticket, CSI, growth %, retention, safety, delta metrics.
   - Need to reconcile metric names so RECOGNITION_METRIC_LOOKUP maps raw headers (`Car Count`, `Δ Ticket`, etc.) to internal keys.

4. **Manual awards + DM/RD edits**
   - DM level: pick Employee of the Month, Rising Star, MVP, etc., even when they fall outside auto qualifiers.
   - RD level: confirm / override DM picks and add regional Spotlight or Culture awards.
   - Manual entries flow into both the confirmation grid and PPT slides with attribution (who nominated, reason text, optional photo link).

5. **Confirmation + Exports**
   - Final step presents a matrix (per region) mirroring the Gulf Coast sample screenshot (columns for award title, winner shop, DM/RD comments).
   - CSV + PPT exports must respect the augmented dataset:
     - Summary CSV lists power ranker positions, manual awards, birthdays/anniversaries.
     - PPT deck includes: opener slide, qualifier recap, KPI tables, DM awards, RD awards, birthdays, anniversaries.

6. **Ancillary pages**
   - Award Shows landing page listing current period runs, export links, birthdays/anniversaries at-a-glance.
   - People workspace needs DOB capture so birthdays list stays accurate (ties into `shop_staff` form + Supabase update).

   ## UI architecture plan

   ### Stepper + page layout

   1. **Step rail** — Add `AwardShowsStepper` across the top of `RecognitionCaptainWorkspace`. Steps: `Qualifiers`, `Uploads`, `Manual Awards`, `Review`, `Exports`.
   2. **State management** — Promote workspace state into a reducer so each step can read/write a shared `AwardShowRunDraft`:
       ```ts
       type AwardShowRunDraft = {
          period: string;
          qualifiers: QualifierUploadResult | null;
          eprFile?: UploadedFileMeta;
          shopFile?: UploadedFileMeta;
          manualAwards: ManualAwardEntry[];
          birthdays: CelebrationEntry[];
          anniversaries: CelebrationEntry[];
          confirmations: ConfirmationRow[];
       };
       ```
   3. **Persistence** — Auto-save reducer state to localStorage so DMs can pause mid-workflow before pushing data to Supabase.

   ### Step 1 · Qualifiers

   - UI: dual-upload cards (Power Ranker + Period Winner) with header validation results and “region coverage” chips.
   - Output: `QualifierUploadResult` containing parsed rows + derived metrics (eligible shops/managers, tie-breakers, rank deltas).
   - Integration: use the existing `PeriodWinnerThresholdBanner`, but source its dataset from qualifiers when available; fall back to KPI upload.

   ### Step 2 · Uploads (KPI + EPR)

   - Reuse `RecognitionUploadPanel`, but split into tabs: `Employee Performance`, `Shop KPI`, `Delta overrides`.
   - After both uploads succeed, compute dataset + awards via `/api/recognition/process`. Save returned runId.
   - Show side-by-side preview cards (EPR count vs. Shop count, mismatch warnings, last imported filenames).

   ### Step 3 · Manual awards

   - Components:
      - `ManualAwardsPanel`: DM picks per award type (Employee of the Period, Rising Star, Tech of the Month, Culture Champion, etc.).
      - `RegionalSpotlightPanel`: RD-only fields (textarea + image URL + CTA).
   - Data model per entry:
      ```ts
      type ManualAwardEntry = {
         id: string; // slug, e.g., "dm-employee-of-period"
         level: "DM" | "RD";
         scopeId: string; // district or region id
         winnerShop?: number;
         winnerName: string;
         rationale: string;
         createdBy: string;
         createdAt: string;
      };
      ```
   - Persist entries inside the run JSON and surface them beside auto awards in the confirmation grid.

   ### Step 4 · Review / confirmation grid

   - Layout matches Gulf Coast screenshot: columns for Award, Winner, Shop #, DM callout, RD callout, KPI metric.
   - Provide inline editing (textarea) so RD can tweak descriptions before locking the run.
   - Add celebratory panels:
      - `BirthdaysPanel` — top 6 birthdays in next 30/60 days (pulled from `shop_staff.birth_date`).
      - `AnniversariesPanel` — reuse existing logic but allow RD to remove/feature entries.
   - Include `Ready to export` checklist (uploads complete, manual awards filled, exporter role available).

   ### Step 5 · Exports

   - Reuse `ExportsPanel`, but inject new download targets:
      1. `Award Shows PPTX` — multi-section deck.
      2. `Award Summary CSV` — includes qualifier manifests, manual awards, celebrations.
      3. `Program Audit JSON` — raw payload for troubleshooting (admin only).
   - Show export history table with status + download link + `Confirm share` toggle.

   ### Landing page stub

   - Create `app/pocket-manager5/award-shows/page.tsx` with cards for:
      - Latest run per region (status, uploader, exports ready).
      - Celebrations (birthdays, anniversaries).
      - Quick links to DM/RD forms.
   - Link this route from `/pocket-manager5/page.tsx` and Recognition Captain hero area.

## System Touchpoints

- **Next.js UI** — Extend `RecognitionCaptainWorkspace` into a multi-step wizard (Qualifiers → Uploads → Manual Awards → Confirmation → Export).
- **API routes** — `/api/recognition/process`, `/api/recognition/export-*` must accept the richer payload (multiple files, manual awards data, PPT sections).
- **Supabase** — `recognition_captain_runs` table already stores dataset/awards JSON; add columns for manual awards, qualifier manifests, birthdays.
- **Forms** — `FormRenderer` needs DOB field for `shop_staff` and new Award Shows landing page forms (DM nominations, RD approvals).

### Supabase schema snapshot (Dec 4)

`supabase/recognition_captain.psql` creates `public.recognition_runs` with:

- Core metadata: `reporting_period`, `data_source`, optional `file_name`, `processed_by`, uploader ids.
- Metrics: `row_count`, `median_car_count`, `average_ticket`, `submission_notes[]`.
- JSON blobs: `summary_json`, `awards_json`, `dataset_json`, plus optional `rule_overrides`.

We will extend this view/table to capture:

1. Manual award payloads (per-region DM/RD picks, reasons, editors).
2. Qualifier manifests (raw Power Ranker + Period Winner extracts) for auditing.
3. Birthday/anniversary slices to avoid recomputation on export.
4. Export job metadata (link to PPT/CSV) or store separately but keyed by `recognition_runs.id`.

## Outstanding Questions / Assumptions

- Tie-break hierarchy for DM/RD winners follows spec from Gulf Coast sample (rank, NPS, survey count, shop number).
- Manual awards likely require audit trail (who edited, when) — plan to store `edited_by`, `edited_at` metadata in run JSON.
- Birthday source = `shop_staff.birth_date` (currently unused on web) — add client-side helper to compute upcoming 60-day window like anniversaries.
- Need to confirm whether PPT retains macro-enabled format (`.pptm`) or standard `.pptx` is acceptable once automation replaces manual macros.

This document anchors the scope before we wire parsers and UI. Next steps: inspect each sample workbook to map headers → internal metric keys (Todo #2) and draft the multi-step UI plan (Todo #3).