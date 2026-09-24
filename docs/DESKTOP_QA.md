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
