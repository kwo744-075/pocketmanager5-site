## Contests Sync Verification (Site ↔ App)

Use this checklist after wiring contests to the unified tables/views.

1) Start Bingo from SITE as DM/RD:
   - Go to `/pocket-manager5/contests/bingo`, start session.
   - Verify session row in `contest_sessions`.

2) Open Bingo in APP as shop:
   - Bingo board shows active session (same session_id).
   - Mark a square in APP → SITE marks update within ~2s.
   - Leaderboard on SITE shows top 3 updating.

3) Mark from SITE as shop user:
   - Marks appear in APP within ~2s.

4) Repeat for Blackout:
   - Objectives load.
   - Marks sync both directions.
   - Leaderboard updates on both.

5) Repeat for Fighting Back:
   - Objectives load.
   - Marks sync both directions.
   - Leaderboard updates on both.

6) Realtime logging:
   - Console shows subscribe status in both clients (site/app).

7) Data checks:
   - `contest_shop_progress_vw` updates for each shop.
   - `contest_leaderboard_vw` returns top 3 by marks_count.

8) Cleanup/guards:
   - Top Ranking KPIs remains unchanged.
   - No Speed Training routes/assets left in app.
   - No Clyde SIM routes/links left in site.
