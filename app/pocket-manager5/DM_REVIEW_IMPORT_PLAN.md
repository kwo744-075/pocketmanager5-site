# DM Review Import Implementation Plan

## Goals

- Replace the temporary `/api/dm-review/import` mock with a parser that hydrates the presenter form from real DM exports.
- Support all presenter modes (`daily`, `weekly`, `monthly`) while sharing as much mapping logic as possible.
- Keep import latency under ~1.5s for typical Excel/CSV uploads (<1MB) so the presenter feels instant.
- Provide actionable validation messages when a file is missing required columns or contains invalid data.

## Supported Inputs

| Source | Format | Notes |
| --- | --- | --- |
| DM Consolidated P&L export | `.xlsx` / `.xls` / `.csv` | Primary data set. Contains Sales, Cars, Labor %, Profit. |
| KPI Export | `.xlsx` / `.csv` | Contains Big 4 %, ARO $, Mobil 1 %, Coolants %, Diffs %. |
| Optional Notes Sheet | `.xlsx` | Optional tab with Turnover, Staffing, Talent, Region notes. |

All uploads feed the same endpoint. We will:

1. Detect the MIME type + extension for quick validation.
2. Use the [`xlsx`](https://www.npmjs.com/package/xlsx) package (already in dependencies) to parse the first worksheet by default; allow a query param for advanced users (e.g., `sheet=KPI`).
3. Normalize column headers by uppercasing + stripping symbols to simplify matching.
4. Apply a column-mapping dictionary per metric with fallbacks (e.g., `SALES`, `TOTAL SALES`, `NET SALES`).

## Parser Architecture

1. **Streaming Upload** – rely on Next.js route `request.formData()` (sufficient for <10MB). If larger files become an issue, switch to the `formidable` parser we already use elsewhere.
2. **Workbook Parsing** – use `xlsx.read(await file.arrayBuffer(), { type: "array" })`.
3. **Sheet Selection** – default to the first sheet; allow `sheet` field in form-data; auto-detect via heuristics (e.g., sheet contains `KPI`).
4. **Row Extraction** – flatten into an array of objects keyed by normalized headers.
5. **Metric Mapping** – look up metrics via config object, e.g.
   ```ts
   const METRIC_MAP = {
     salesActual: ["SALES", "NET SALES"],
     laborActual: ["LABOR %", "LABOR%"],
   };
   ```
6. **Mode Awareness** – handle `mode` in payload to choose default period label (`As of`, `Week ending`, `Period`).
7. **Error Handling** – accumulate missing metrics and return `422` with helpful message (e.g., `"Missing columns: SALES, PROFIT"`).
8. **Audit Metadata** – return `meta` object (already in stub) with parsed timestamp + columns matched. Consider persisting this to Supabase later for supportability.

## Supabase vs. In-App Parsing

| Option | Pros | Cons |
| --- | --- | --- |
| **In-App (Current Plan)** | 
- No additional infrastructure. 
- Reuses `xlsx` dependency already bundled. 
- Works offline/local dev. | 
- Upload size limited by serverless memory. 
- Need to ship parsing fixes via redeploy. |
| **Supabase Edge Function** | 
- Centralizes parsing logic for other clients (mobile). 
- Easier to log + monitor.
| 
- Requires auth + networking from client. 
- More complex deploy pipeline. |

Recommendation: Finish in-app parser first (fastest path), then assess if we need to promote logic to Supabase for multi-client reuse.

## Data Validation Rules

- **District/DM context**: optional; default placeholders already in UI.
- **Financial metrics**: require at least Sales and Profit actuals; warn (but don’t hard fail) if budgets missing.
- **KPIs**: allow partial matches; only warn on missing values.
- **Notes**: treat as optional strings.
- **Numeric normalization**: strip `$`, `%`, commas. Convert to strings for now; later we can store numbers to drive charts.

## Error Messaging

| Scenario | Response |
| --- | --- |
| No file attached | 400 `"An Excel or CSV upload is required."` |
| Unsupported type | 400 `"Only .xlsx, .xls, .csv files supported."` |
| Parse failure | 422 `"Could not read worksheet: <reason>"` |
| Missing metrics | 422 `"Missing columns: SALES, PROFIT"` |
| Unexpected | 500 `"Unable to process import right now."` |

## Implementation Checklist

1. **Refactor route**
   - Accept only specific MIME types.
   - Parse via `xlsx` and map metrics into `DmReviewDraft`.
   - Return warnings array alongside draft.
2. **Mapping Config**
   - Create `app/pocket-manager5/lib/dmReviewImportMap.ts` with column dictionaries and helper functions.
3. **Unit Tests**
   - Add targeted tests for mapper helpers (pure functions) to catch column regressions.
4. **Integration Tests**
   - (See section below) Add route-level tests using Node’s `FormData` to ensure end-to-end behavior.
5. **UI Hooks**
   - Surface warnings in the presenter (toast or inline message).
   - Possibly highlight fields that couldn’t be populated.

## Integration Test Plan

When ready, cover the following in `tests/dm-review-import-route.test.ts`:

1. **Successful import** – send a synthetic workbook with Sales + KPI columns, assert route returns populated draft + metadata.
2. **Missing file** – omit `file`, expect 400.
3. **Missing columns** – send workbook lacking required headers, expect 422 and error message referencing missing columns.
4. **Mode awareness** – pass `mode=weekly`, expect `dayOrWeekLabel` = `"Week ending"`.

We can generate small CSV strings on the fly and convert them to `File` objects via `new File([csv], "demo.csv", { type: "text/csv" })` in the test environment (Node 18 implements `File`).

## Future Enhancements

- Allow users to download/attach a mapping template.
- Persist the last uploaded draft to Supabase so DMs can hydrate from any device (paired with the new Clear Draft control).
- Offer multi-sheet selection UI if workbook contains multiple relevant tabs.
- Provide column auto-suggest UI if we can’t match certain headers.
