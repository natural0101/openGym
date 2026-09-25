# openGym for Windows

An offline, single-profile Windows x64 application built from openGym 1.3.8. There is no Docker, server, account, or API key to configure. The desktop interface is Russian; the upstream exercise catalogue and training engine remain available.

## Install and train

1. Run `openGym-Setup-1.1.1-x64.exe`. Installation is per-user and does not need administrator rights.
2. Open **openGym** from the Start menu or desktop shortcut.
3. Choose **Подобрать домашний план** → **Гантели + дорожка**, inspect the routines and add them. This creates three strength routines and an optional walking session. Only unassigned Monday/Wednesday/Friday slots are filled; existing routines and history stay intact. The template is a starting point, not an individualized prescription. Choose your own comfortable dumbbell weight; change exercises and days in **Мой план**.
4. In **Настройки → Упражнения офлайн**, download the media once. The app and text instructions already work without this; the download adds 1,324 images and 1,324 animations. Interrupted downloads resume.

The installer is unsigned. Windows may display a publisher/SmartScreen prompt. No certificate or automatic updater is included.

## Data and backups

**Настройки → Открыть папку данных** opens the exact storage directory (normally `%APPDATA%/openGym`). The canonical file is `training.json`; `training.json.previous` is the previous valid version. Writes are serialized, flushed, and atomically renamed. A dated backup of the previous state is kept on the first change of a UTC day and before every explicit restore, with a rolling limit of 30 snapshots. This is local recovery, not an off-device backup.

Use **Экспортировать** to save a JSON copy somewhere else. **Восстановить** validates a chosen file, previews its counts, asks before replacement and retains the previous state. The active workout is saved too; simply close and reopen the app to resume. A damaged primary file is recovered from the previous file/backups when possible and the damaged original is retained. Unrecoverable corruption is surfaced rather than silently resetting data.

Training settings include units, rest duration, optional RIR/RPE, progression, sounds, appearance, equipment profiles and more. Advanced controls live under **Все настройки тренировок**. Ctrl+K opens quick navigation. PDF export is available from the plan's share menu. No cloud sync, AI coach, background reminder service or auto-update is enabled in this desktop edition.

## Build from source

Requires Node.js 22.12+ (tested on Node 24) and Windows x64:

```powershell
npm ci
npm --prefix frontend ci
npm run build
npm start
npm run test:desktop
npm --prefix frontend test
npm run test:smoke
npm run dist
```

The installer is written to `release/`. Electron renderer access is isolated through a small IPC bridge, with Node integration off, context isolation/sandbox on, a local custom protocol, CSP, navigation restrictions and no HTTP backend. Desktop behavior is compiled behind `VITE_DESKTOP=1`; `npm --prefix frontend run build` still produces the upstream web app.

`desktop/smoke.mjs` exercises a separate test profile in `desktop/test-output/`; it never uses the real profile. It creates test workouts, verifies restart/backup behavior and captures screenshots. No real training history is shipped in the installer.

## Licenses

The application remains AGPL-3.0-or-later. Upstream attribution and LICENSE/NOTICE.md are retained. Exercise media is not bundled in the installer or source: the optional downloader fetches the pinned upstream dataset revision `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`. Media rights are separate from the code and metadata licenses; see NOTICE.md. The offline files live only in the user's data directory.


## Desktop companions

The home screen includes Burger and Cake. Select either character; your choice is saved. The companion reacts to completed sets and shows the real rest/work timer. **Разминка · 2 минуты** starts a preparation timer without writing a workout record.

**На рабочий стол** opens the native desktop widget. Drag its header to reposition it. The arrow button pins/unpins it above other windows, clicking the mascot changes the companion, and the main button returns to openGym. While a rest timer runs the secondary button skips that rest. Closing the main window leaves a visible widget running; use the openGym tray menu → **Выйти** to quit everything. The widget's visibility, position and pin preference are restored on the next app launch. The application does not automatically start with Windows.

`widget-preferences.json` stores window preferences separately from training data. Widget IPC only exposes a small fixed action list; all training edits still go through the main window/store.

Rubik is bundled under its SIL Open Font License in `frontend/public/fonts`. Burger and Cake were generated for this project; see `docs/DESKTOP_ASSETS.md`.
