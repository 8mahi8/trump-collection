# V2 2026-10-28 UI browser evidence, no-auth E2E and clipped-card repair

## Critical discovery — an actual CI run existed but commit status API hid it
The `fetch_commit_workflow_runs` connector includes only `pull_request` runs. This project's workflows run on **push**. For accurate status, query the GitHub Actions REST run collection with the connected GitHub `fetch` action:
`https://api.github.com/repos/8mahi8/trump-collection/actions/runs?branch=refactor%2Funified-core-and-school-network-20261027&per_page=15`
Then fetch jobs/logs via run/job IDs. **Do not** infer that absent commit statuses means CI did not run.

## Confirmed automated test results
- Previous Chromium/WebKit online E2E `#40705626479` **failed** despite three complete games and chat passing: `AssertionError` at Memory layout, `{"cols":8,"tileCount":24,"boardBottom":285,"handTop":0,"actionsBottom":368,"height":375}`. The Memory game intentionally has no hand; `.v2-hand:empty` is display:none and its bounding rectangle starts at y=0. This was a **false positive** in the test, not evidence that Memory's board was clipped.
- Replaced hand-top assertion with footer-top and actual 24 tile bounding rectangles; captured the Memory screenshot **before** assertions. Commit `e04607d6`.
- **Confirmed success**: `https://github.com/8mahi8/trump-collection/actions/runs/40706570656` at `e04607d6`. The CI logs explicitly show no-auth chat/escaping, Daifugo sort and selection fast path, mixed 2-human+CPU Daifugo/Babanuki/Shichinarabe all full games, 2-human Memory match and spectator behavior on **both Chromium and WebKit**, plus configured Google Sites standalone build and 1-human+CPU Memory on Chromium. Firebase RTDB **emulator only**, no production rules/DB writes, no auth.
- At commit `e48662d5` (CSS repair below), Foundation V2 `#40707321678` and V2 Memory CPU browser `#40707321535` both **success**.
- The **latest**, new screenshot/artifact test and Babanuki-card-clipping E2E after `485159c0` / `8fd18093` were still **running** at report time. Verify final status before any completion claim.

## Actual browser visual review and correction
- Downloaded the previous failed CI artifact `12823498478` with complete standalone HTML. It included 667×375 and 800×450 Chromium screenshots of the revised lobby and match. The lobby has distinct two-line game cards; CPU home and Babanuki match were loaded in headless Chromium using `page.set_content(bundledHtml)`, not an invented mock.
- In actual 667×375 CPU Babanuki, measured the **opponent back card bottom ~209 px vs board bottom ~192 px**, a real ~17px clipping caused by the tall draw row in an undersized board. This was *not caught* by previous tests.
- Tested CSS dynamically in Chromium at 667×375, 800×450 and 1024×768 and saved local screenshots: make non-interactive self-hand cards 39px, hide redundant draw selection hint, compact backrow padding, set opponent back card width **44px**. Results show opponent card bottoms within board. Committed production styling to `v2/ui/table.css` at `e48662d5`.
- Added browser regression to `dev/verify-v2-online-ui.mjs` at `485159c0`: at first actionable Babanuki human turn, measure all opponent buttons at 667×375 and 800×450, demand min width 43px and no vertical clipping, capture images before assertions.
- Manual Chromium CPU session with latest CSS dynamically injected: **14 successful card draws, 0 clipping cases, 0 browser exceptions**.
- Expanded `.github/workflows/room-v2-ui-emulator.yml` artifact glob from `online-*.png` to `*.png`, so Babanuki/Sevens/Memory screenshots are retained for human inspection. Also enabled concurrency cancellation of superseded *future* emulator runs on the same branch; commit `8fd18093`.

## Remaining gates
1. Check the latest `8fd18093` Actions run `40707705212`, including the new Babanuki touch width checks, and repair any failure.
2. Download its artifact (should now contain all screenshot PNGs for Chromium and WebKit) and open **actual images**, verify 667×375 / 800×450 Babanuki, Seven, Memory, and room lobby.
3. User's school Google Sites version still needs separate real multi-iPad Safari test. This branch remains Draft PR #2, not deployed or merged.
4. Do not modify main, production Firebase Rules/data, Google Sites published version, or Drive without user request.

## Design principles
- Keep architecture plugin-based; new games must remain unavailable until their `onlineReady` integration gate passes.
- Prioritize preserving legible cards and explicit hand/turn state on the short iPad landscape; empty/non-interactive hands need separate layout expectations.
- Test **displayed** element rectangles, not a hidden placeholder, when asserting clipping.
