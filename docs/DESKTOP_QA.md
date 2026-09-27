# Desktop verification — 1.1.0

Verified on Windows 11 x64, Node 24.17.0, Electron 44.4.5.

## Automated evidence

- Frontend regression coverage at initial desktop implementation: 127 test files / 1,585 tests passed. After the shared routine-row change, the two drag/move suites passed 30 tests. These full-suite results precede the 1.1.0 visual redesign.
- Storage: 6 tests passed (`npm run test:desktop`), covering durable ordered writes, validation, corruption recovery and bounded backups.
- Latest `npm run test:smoke`: PASS in an isolated offline profile. Template creation, log/restart/resume/finish, native JSON export, invalid import rejection, valid restore, PDF export, Russian search, keyboard navigation, themes, compact window and exercise removal all passed.
- Companion/widget checks: Burger/Cake selection synchronizes; warmup and pin actions work; completed-set counts survive restart; closing the main window leaves the widget running and its button reopens the active workout. No widget scroll overflow.
- Actual Cyrillic font rendering was checked with Chromium `CSS.getPlatformFontsForNode`: custom Unbounded for the heading and Manrope for navigation.
- Latest smoke report: zero renderer exceptions and zero HTTP/backend requests in the core workflow.
- `npm run dist`: NSIS x64 installer 1.1.0 built successfully. Installation with `/S` exited 0.
- Actual installed executable: version 1.1.0, `packaged: true`; offline local images and mascots load. Routines, workouts, bodyweight, schedule and active session deep-equal the pre-upgrade snapshot. Light theme, companion choice, widget visibility and pin survive full application restart. No renderer errors.
- Optional offline media download previously completed: 2,648 / 2,648 files, zero errors. These files are not included in Git or the installer.

Machine-readable reports and screenshots are under `desktop/test-output/` (gitignored). Installed verification uses the real profile without creating training records; synthetic workouts are confined to the smoke profile.

## Staged visual review

The user-selected references guide cream surfaces, black outlines, hard shadows, colored folder tabs and retro food characters. Locally bundled Manrope and Unbounded include Cyrillic. Both companions appear on the home screen and wide workout screens; the separate widget displays the selected companion and real workout/timer state. No design score or user acceptance is claimed.

Stage 1: inspected home, workout and plan screenshots. Stage 2: inspected compact layout and native widget, then corrected a widget scrollbar, incomplete set-card borders and a narrow-sidebar overlap caused by CSS specificity. Stage 3: reran smoke checks and inspected screenshots from the installed executable. The compact layout now has an explicit sidebar/content containment assertion; widget bounds are also asserted.

Screenshots cover empty state, home routines, schedule, workout, plan, library, settings, light/dark themes and an 820px window. Reduced-motion preferences disable companion animation. Widget preload exposes only read-only state and a fixed action allowlist, with sender/main-frame checks; all training mutations remain in the main renderer/store.

## Remaining limits

- Installer is unsigned; Windows may display SmartScreen/publisher prompts.
- Host reboot, other Windows versions, other physical computers and high-contrast mode were not tested. A full accessibility audit was not performed.
- No Windows autostart, automatic updater, cloud sync or AI coach. Timers run while the app is running; timer continuation across full application restart is not promised.
- Russian names cover the home exercises; much of the upstream catalogue retains English names.
- Exercise media licensing is separate; see NOTICE.md. Same-disk backups do not protect against disk loss.

## 1.1.1 — Rubik and desktop identity

On 2026-09-25 the user requested Rubik everywhere and a replacement application logo/icon. Rubik now covers desktop headings, body text, controls, keyboard hints, paths and native widget text. The local variable font includes Cyrillic and its OFL license. Earlier Manrope/Unbounded assets were removed.

A project-native SVG dumbbell on a yellow tile supplies the sidebar, About section and widget brand. A matching PNG supplies the native window/tray; a nine-resolution ICO (16–256px) supplies the EXE, installer and uninstaller. The embedded icon was extracted from the installed executable and visually inspected. Original upstream web icons are retained.

Verification: the Rubik smoke run passed with no renderer errors or external requests. After the logo change, `npm run dist` and silent installation exited 0. A focused check of the installed 1.1.1 executable verified actual custom Rubik rendering through Chromium platform-font inspection, every visible text element across six sections, local logos in app/widget, no horizontal overflow and no widget vertical overflow. The complete training state deep-equaled the pre-upgrade snapshot. Installed home/widget screenshots were inspected; no renderer errors occurred. Host reboot and Windows shell icon-cache refresh were not tested.

## 1.2.0 — Burger progress and the Windows desktop layer

The widget is attached as a WS_CHILD window to the Explorer window containing SHELLDLL_DefView. Always-on-top and the pin action were removed, including migration of saved pin preferences. Koffi 3.3.1 calls Win32 from the main process; renderer privileges remain unchanged.

Burger progress is stored with training data. Session completion and its reward are one persisted transaction. Empty sessions/backfills/imports cannot grant rewards; processed session IDs prevent duplicates. Calendar reconciliation uses the previously saved schedule, local calendar boundaries and explicit rest overrides; the update does not penalize pre-activation days. Victory at zero is terminal.

Evidence on Windows 11:
- Challenge tests: 7 PASS; desktop storage tests: 7 PASS, including malformed challenge rejection.
- Relevant finish/backfill/adopt/restore regressions: 42 PASS.
- Native application smoke: PASS, including actual finish 100 → 90 in the widget, persistence after restart, backup/restore, timers and existing training flows; zero renderer errors/external requests. Editor checks now await the rendered rows after navigation.
- Isolated missed-day and victory scenarios: 105% growth and 0%/hidden Burger rendered correctly; victory assertion waits for the scale transition to finish.
- Native desktop-layer check: real Explorer parent, WS_CHILD=true, WS_EX_TOPMOST=false, Electron alwaysOnTop=false. After Shell.MinimizeAll the widget remained visible and Win32 hit testing reached it. A normal covering BrowserWindow then received the hit instead. Shell windows were restored afterwards.
- NSIS 1.2.0 install exited 0. Actual installed executable reported version 1.2.0 / packaged=true; native dependency loaded and the widget's real parent was the Explorer desktop. Main/widget rendered offline with no errors/overflow. Existing profile fields were unchanged except the new game state and save timestamp; initial game was 100%, zero misses.

Limits: Windows reboot, Explorer restart/recovery, alternate shells, mixed-DPI monitor changes and other computers were not tested. Windows autostart remains off. Previous timer, unsigned installer and local-backup limitations still apply.

## 1.2.1 — correct a false-positive desktop rendering check

The user's real desktop screenshot exposed a rendering failure missed by 1.2.0 QA: the HWND was visible and received hit tests, but its pixels were wallpaper. Chromium-only screenshots did not prove that Windows displayed its content. The earlier desktop visibility claim was therefore insufficient.

Reproduced with a real CopyFromScreen capture: zero widget background pixels despite all native parent/hit tests passing. Removing transparency or disabling GPU acceleration did not fix it; those changes were discarded. Calling BrowserWindow.showInactive() before native reparenting activates Electron visibility and fixes the screen output. Native SWP_SHOWWINDOW alone was insufficient. The production fix is three lines (two comments and the showInactive call).

`desktop-host-smoke.mjs` now captures actual screen pixels through `capture-widget-screen.ps1` and asserts the violet content and yellow action button are visible, in addition to desktop ownership, click hit testing, no topmost style and ordinary-window occlusion. Its isolated window position avoids overlap with an already running installed widget.

Verified on installed 1.2.1: packaged=true; actual screen contained 48.03% violet background and 4.31% yellow button pixels. The screen capture was visually inspected. Native desktop parent, click hit test, normal-window occlusion and exact preservation of profile fields (except save timestamp) passed. NSIS install exited 0. No broad frontend retest was run for this native visibility-only fix. Existing reboot/Explorer recovery/mixed-DPI limits remain untested.

## 1.2.2 — remove legacy wallpaper around the desktop widget

The user screenshot exposed a second rendering issue: transparent margins of the Explorer child window showed legacy photographic wallpaper over the current animated pink desktop. The widget now has an opaque backing and a native window contour matching its rounded card and hard shadow. thickFrame=false removes the invisible native frame offset. The showInactive activation from 1.2.1 is retained.

Verified in development and on installed 1.2.2 (packaged=true, NSIS exit 0): actual Windows screen capture contains the full card and current pink surroundings, without the old wallpaper rectangle. Outside the native contour, all 12,999 sampled pixels in the upper 65% match the hidden-widget baseline. The lower area contains animated wallpaper and was visually inspected instead of asserted pixel-identical. The new compare-widget-surroundings.ps1 makes this scope explicit.

Native desktop ownership, no topmost flag, desktop click hit testing, ordinary-window occlusion, hide/show rendering and preservation of all existing training fields except the save timestamp passed. Evidence is in desktop/test-output/desktop-layer-report.json and the installed screen capture in outputs/openGym-Desktop-Verified.png (workspace outputs directory). No frontend behavior changed; prior reboot, Explorer recovery and mixed-DPI limits remain untested.

## 1.3.0 — Russian voice companion

Implemented a single-key Deepgram Voice Agent connection, local encrypted credential storage, PCM microphone/output pipeline, interruption handling, connection-loss cleanup, durable workout tool calls, a voice screen and widget microphone control. Voice tools operate only on the active session and do not overwrite historical workouts.

Verified:
- 30 focused tests (voice transactions, Burger and completed-workout boundary) and 7 storage tests passed.
- voice-smoke.mjs passed the real renderer/preload/main-process boundary with a local mock service: microphone PCM, encrypted key, missing-key failure, exercise search, set logging/correction/undo, treadmill, rest, completion, duplicate protection, disconnect/reconnect, widget stop and disk-failure handling. Disk failure returned saved=false. No renderer errors.
- Full desktop smoke passed existing offline training, resume, finish, native JSON backup/restore, PDF, settings, compact layout and widget workflows; zero renderer exceptions/external requests in the non-voice workflow.
- A separate live Deepgram run used synthesized Russian speech through Chromium's microphone capture pipeline: treadmill 10 minutes at 4 km/h, correction to 12 minutes, then completion. Actual provider tool calls wrote one workout with min=12 and speed=4 in an isolated test profile. Returned audio was received. No synthetic record was added to the user's profile.
- Native desktop-host smoke passed after adding microphone control: desktop child, topmost=false, click hit test, ordinary-window occlusion, real Windows screen colors, unchanged surrounding static pixels and no widget clipping.
- Production dependency audit: zero known vulnerabilities (npm audit --omit=dev).

Visual QA covers /voice (empty/configured, connected, transcript, validation, error/disconnected), /settings and the desktop widget at wide and 820px widths. Rubik, existing cream surfaces and black borders are retained; focusable labelled controls, visible stop, error text and saved-versus-conversation distinction were inspected. Screenshots: desktop/test-output/voice-conversation.png and voice-compact.png. Full-page screenshots of a scrolled viewport were discarded in favor of viewport captures with scroll reset; the installed result uses CopyFromScreen. Quality self-review: 26/30, PASS WITH RISKS, supported by the above tests and rendered evidence, not a substitute for them. The skill's optional design-workbench documentation packet is not present in this repository.

Remaining limits: real human speech under treadmill noise, accents and microphone echo have not been benchmarked; speech models can misunderstand and must clarify uncertain inputs. Live validation used synthesized Russian speech. Session recovery is manual reconnect with context from saved training. Provider/network outages stop listening and preserve recorded sets. Windows reboot, Explorer recovery and mixed-DPI changes remain untested.

Provider references checked 2026-09-27: https://developers.deepgram.com/docs/voice-agent-tts-models (managed Cartesia), /docs/voice-agent-llm-models, /docs/flux/language-prompting, /docs/voice-agent-function-call-request and /docs/voice-agent-function-call-response. Flux rejects deprecated agent.language, so language_hints=[ru] is used instead.

Installed verification: NSIS 1.3.0 /S exited 0; installed EXE reported packaged=true/version=1.3.0. Live Deepgram accepted the saved key and returned PCM audio both before and after full app restart. All original training fields except the save timestamp deep-equal the pre-upgrade snapshot. Actual Windows screen capture: outputs/openGym-Voice-Installed.png in the workspace output directory. Installed widget native parent, no-topmost, hit testing, ordinary-window occlusion and 12,999 unchanged static surrounding samples passed; actual pink Cake widget and microphone button were visually inspected. Microphone was stopped after verification.


## 1.3.1 — voice continuity, 2026-09-27

Reproduced: did-start-loading fires for HashRouter changes, and the old handler stopped voice. A navigation probe observed status=off. Changed the handler to stop only for main-frame document navigation. This proves a navigation bug; it does not establish the cause of the user-reported stop immediately after saying to record a set.

Voice integration smoke passed: five routes and widget reopen retain the same socket; tool persistence/deduplication, reconnect history, disconnect reporting and failed disk writes pass with no renderer errors. Real Deepgram accepted conversation plus completed-function history on reconnect and returned the continuation greeting. Synthesized Russian treadmill speech triggered log_set and the session remained listening. Reports are in ignored desktop/test-output/voice-continuity-live-report.json and voice-smoke-report.json.

NSIS 1.3.1 installation exited 0. Installed EXE reported packaged=true/version=1.3.1. Actual Deepgram audio, section navigation without microphone shutdown, same-process reconnect and key persistence across full restart passed. Training deep-equaled the pre-upgrade snapshot except timestamp. voice-installed-report.json records the results; an actual Windows screenshot was captured and inspected. Microphone was stopped after verification.

Rollback: run the retained outputs/openGym-Setup-1.3.0-x64.exe /S; pre-upgrade training snapshot is desktop/test-output/before-voice-continuity-fix.json. No schema migration was introduced. Human speech in treadmill noise and the exact original interruption remain unverified.

Additional live regression: synthesized Russian «Я сделал жим гантелей стоя вверх на плечи. Гантели по десять килограммов, десять повторов. Пиши это.» produced context/search/log_set and remained listening. Reconnect returned continuation audio. Evidence: ignored voice-shoulder-live-report.json; isolated test profile only.


## 1.4.0 — Today, personal exercises and rest

40 focused tests passed: voice persistence/validation, personal names, adaptive rest, natural-expiry event vs cancellation, timer alerts. Today UI integration passed: 3 navigation tabs, empty day, personal exercise name/rest persistence, calendar and no overflow at1366/820px. Expanded voice-smoke passed with actual renderer/IPC/storage, auto-rest visible on Today, single reminder event, reconnect/disk-error/dedup regression; zero renderer errors.

Live Deepgram injected rest-completion speech successfully (voice-rest-live-report.json). Synthesized Russian shoulder press selected from the personal shortlist wrote exercise0426/10kg/10reps, remained listening, displayed the set on Today and started120s rest; reconnect retained context (voice-shoulder-live-report.json, today-live-deepgram.png). An initial live probe reused older ambiguous test history and chose a one-arm variant; the isolated test was reset and given the chosen personal exercise before verifying. Human speech accuracy remains unverified.

Installed NSIS1.4.0 exited0. Actual installed app reported1.4.0, decrypted existing key and returned32640 PCM bytes. User-authorized cleanup removed four exact template IDs and dictation-test-2026-09-27, their schedule and the single template-only Burger penalty. Backup: desktop/test-output/before-today-cleanup.json; desktop:restore also made a native backup. Active session, bodyweight, exercise weights and all remaining records preserved. Restart confirmed empty Today, three main tabs, microphone off, all2648 media ready and exercise image visible.

Visual QA: inspected Today empty installed Windows screenshot1300x850 and live set screenshot1366x900; cream/Rubik styling preserved, primary mic button and next action visible, duplicate floating rest bar removed. Personal exercise preview and empty/selected states inspected; compact820px no horizontal overflow. Evidence in ignored desktop/test-output/{today-ui-report.json,voice-smoke-report.json,today-installed-report.json} and outputs/openGym-Today-Installed.png. Scope is desktop; external HTTP/domain checks are not applicable.

Rollback application: retained openGym-Setup-1.3.1-x64.exe /S. Restore pre-cleanup JSON through Settings only if the user wants the removed templates/test record back; avoid overwriting newer workouts. Remaining limits: human treadmill noise, reboot/Explorer recovery, unconfigured plate weights, full Russian catalogue coverage, and repeating delayed coach prompts.
