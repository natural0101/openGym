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
