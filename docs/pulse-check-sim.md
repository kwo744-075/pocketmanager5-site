# Pulse Check simulator dataset

- Source data lives in `PocketManager5_sitetmpupload_samples/supabase_checkins_unified.csv`. The file is a Supabase export that already contains all four time windows (12pm, 2:30pm, 5pm, 8pm) for every store.
- The API route at `/api/pulse-check/sim-data` streams the CSV on the server, converts it with `XLSX.sheet_to_json`, and filters rows by `shopNumber`. Passing `?format=csv` returns the raw file for download.
- `app/pulse-check5/page.tsx` now loads the dataset by calling that endpoint instead of reaching out to the legacy signed Supabase URL, so the simulator no longer depends on expiring tokens or Excel parsing on the client.

## Submission rule set

1. **Shop resolution first.** `runSimTest` refuses to run until the viewer has a resolved shop (real alignment or proxy).
2. **Dataset validation.** Rows returned from the endpoint go through `buildSimEntriesFromRows`, which enforces:
   - Recognized slot labels (text such as "12pm", "230pm", etc. map to the `TimeSlotKey` order of 12:00 → 14:30 → 17:00 → 20:00).
   - Numeric values for all supported metrics (cars, sales, Big 4, coolants, diffs, fuel filters, donations, Mobil 1). Missing data surfaces as an issue before submission.
3. **Queue construction.** Only the first valid record per slot is used, and the slots are processed chronologically so the simulator mirrors the real unlock cadence.
4. **Submission flow.** Each slot is merged into the UI grid as a `draft`, `submitSlot` is invoked, and a randomized 3–7 second delay (`waitWithCancellation`) simulates real pacing between windows.
5. **Cancellation safety.** Toggling the sim button flips `simControllerRef.cancelled`, which immediately halts the queue, updates the status banner, and prevents further submissions.

This setup keeps the simulator deterministic (data lives in git) while still reflecting the Supabase export that field teams review.
