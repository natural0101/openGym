# openGym for Windows

An offline, single-profile Windows x64 application built from openGym 1.3.8. There is no Docker, server, account, or API key to configure. The desktop interface is Russian; the upstream exercise catalogue and training engine remain available.

## Install and train

1. Run `openGym-Setup-1.4.1-x64.exe`. Installation is per-user and does not need administrator rights.
2. Open **openGym** from the Start menu or desktop shortcut.
3. The **Сегодня** page starts empty. Start the microphone and dictate completed work; sets appear on that day immediately. Open **Мои упражнения** to browse animations, select your exercises and save personal names and rest intervals. No prebuilt programme is required.
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

**На рабочий стол** opens the native desktop widget. Drag its header to reposition it. The widget is a child of the Windows Explorer desktop, behind normal application windows. There is no always-on-top mode. Clicking the mascot changes the companion; the main button returns to openGym. While a rest timer runs the secondary button skips that rest. Closing the main window leaves a visible widget running; use the openGym tray menu → **Выйти** to quit everything. The widget's visibility and position are restored on the next app launch. Old pin preferences are discarded. The application does not automatically start with Windows.

`widget-preferences.json` stores window preferences separately from training data. Widget IPC only exposes a small fixed action list; all training edits still go through the main window/store.

Rubik is bundled under its SIL Open Font License in `frontend/public/fonts`. Burger and Cake were generated for this project; see `docs/DESKTOP_ASSETS.md`.

## Burger challenge

Starts at 100% from the first launch of 1.2.0, without charging earlier missed days. Each newly finished session with completed work removes 10 percentage points; empty sessions, history imports and backfills do not grant progress. Each closed local calendar day with a scheduled routine and no completed session adds 5 points, capped at 150%. Rest days and explicit rest overrides do not count as misses. A day with several planned routines incurs at most one missed-day penalty. Session completion is counted on its local completion date.

Burger visibly shrinks/grows in the app and desktop widget. At 0% it disappears and victory persists; later misses do not undo a completed challenge. This is a consistency game, independent of bodyweight data. The saved schedule is used to settle elapsed days on restart before any plan edits are applied. Progress is included in normal JSON backups.

Developer checks: `npm --prefix frontend test -- src/desktop/burger-game.test.js`, `npm run test:desktop`, `npm run test:smoke`, `node desktop/burger-states-smoke.mjs`, `node desktop/desktop-host-smoke.mjs`. The last test briefly minimizes windows through the Windows shell and restores them afterwards to verify actual desktop hit testing and ordinary-window occlusion.

## Voice companion (1.3.0)

Open **Голосовой напарник** in the sidebar, save a Deepgram API key, then click **Начать разговор**. The key needs Voice Agent access and available credit. Russian STT (Flux Multilingual), the managed conversation model and managed Cartesia TTS use the same Deepgram account. No separate OpenAI or Cartesia key is required.

The assistant can find exercises, start a session, record completed strength sets and treadmill minutes/speed, correct or undo a set in the current session, control rest and finish into history. Only finishing a nonempty current workout rewards Burger. The app acknowledges a change after the durable save resolves; replayed function IDs cannot add duplicate records. Unspecified weights/repetitions require clarification. Complex unilateral/drop-set edits and past-session edits remain in the normal editor.

Use the microphone button in the desktop widget to start/stop. The widget stays on the desktop, behind normal windows. A visible widget keeps the conversation alive when the main window closes; the microphone status is visible in the widget. Stop explicitly to end the paid connection. Microphone access never starts automatically on launch.

Audio and current/last-workout context are sent to Deepgram and its model providers while connected. Deepgram bills connection time, including pauses. Local training features still work offline. Conversation text is kept in memory only; training changes persist. The key is encrypted with Electron safeStorage/Windows, stored separately in voice-key.bin in the app profile, excluded from training JSON backups and never returned to the renderer. Re-enter it after moving to a different profile/computer.

Focused checks: npm --prefix frontend test -- src/desktop/voice-actions.test.js; node desktop/voice-smoke.mjs. Voice smoke uses a local mock WebSocket server, synthetic microphone input and a separate profile; it does not use a real key. Live Deepgram tests are separate and explicitly documented in DESKTOP_QA.md.


### Voice continuity (1.3.1)

Section navigation and reopening the main window from the widget preserve the microphone connection. Manual reconnect supplies the recent conversation and confirmed command results to Deepgram; this context stays in memory only until the app exits. Saved training remains on disk. Recording or finishing a workout does not request microphone shutdown. Provider/microphone failures show an error instead of silently displaying an ordinary stop.


## Today and exercise-aware rest (1.4.0)

Main navigation is Сегодня / Мои упражнения / Статистика; history is available from Today and voice configuration from Settings. Completed sets remain visible after finishing a workout. Voice records today only; selecting another date browses that day. Personal names are attached to stable exercise IDs and used in voice search/context/results.

Strength voice logs start rest after durable saving: lower compound150s, upper compound120s, isolation75s, core60s, fallback90s. Explicit hard effort or <=5 repetitions add30s each. Per-exercise overrides take precedence. These are adjustable starting intervals, not measured recovery. Cardio and corrections do not start rest; duplicate receipts do not restart it. «Упражнение закончил» starts a longer transition without finishing the whole session. Natural expiry sends a single Deepgram InjectAgentMessage with default non-interrupting behavior; if a turn is active it can be refused. Cancelling/skipping rest sends no reminder.

Available plate combinations are not configured yet; the assistant must not invent a supported weight increment. All1324 built-in catalogue titles have Russian desktop names; personal names still take precedence.


## Grouped Russian catalogue (1.4.1)

Мои упражнения opens the catalogue with a home-equipment filter. Choose a muscle group, search a Russian name or select equipment; switch to Мой список for selected exercises. The preview contains the existing local animation, Russian instructions, muscles and personal name/rest controls. Removing a favourite does not remove training history. Seven source descriptions that conflict with their own titles are withheld with a visible explanation. Source comparison and translation limits are in DESKTOP_CATALOGUE.md.
