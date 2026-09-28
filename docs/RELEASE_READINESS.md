# Windows beta readiness — 2026-09-28

Candidate: 1.4.19. Review scope: Windows desktop fork, not the inherited web server or mobile release.

## Verified locally

- Desktop persistence, corruption recovery, import validation, voice races, reminders and window preference tests: 39 passed.
- Full frontend suite after test repairs and previous-day recovery tests: 1,640 passed (135 files); repeated after dependency updates before release.
- Electron fresh-profile smoke: empty history, offline UI/fonts, previous-day recovery, native export, rejected invalid import, confirmed restore, key save/delete, route navigation and restart persistence.
- Voice integration: fake microphone and local WebSocket provider; logging, correction, undo, duplicate protection, reconnect, rest cues, stop and disk failure behavior.
- Manual recording, closing with queued writes, exercise personalization and motivation scenarios passed.
- Native desktop widget on the current Windows 11 host: child of Explorer, not topmost; receives clicks on desktop; ordinary application covers it; sampled desktop pixels outside widget unchanged.
- Runtime dependency audit previously returned zero vulnerabilities. Full build dependency audit identified legacy mobile asset tooling; compatible dependencies updated and unused @capacitor/assets removed. Final full audits returned zero known vulnerabilities for both root and frontend dependencies. Reports are generated under ignored desktop/test-output.
- Current tracked-file scan found no private-key/GitHub/AWS credential patterns. This is a limited pattern scan, not a guarantee about every credential or all Git history.
- Previously inspected app.asar contained no training.json, voice-key.bin, test-output or exercise media.

## Repairs in this candidate

Updated obsolete test expectations and awaited asynchronous React test actions. Added explicit previous-day recovery without inventing an end time or changing the workout date. Added key deletion in Settings. Restricted ordinary desktop IPC to the main renderer/main frame. Rejected extreme/corrupt window bounds. Replaced obsolete primary smoke flow with current UI scenarios. Added Windows CI, corrected Windows onboarding/privacy documentation, updated build dependencies, and removed legacy mobile asset generation tooling from the Windows development install.

## Additional verification

Main-renderer sandbox/context isolation verified; Node unavailable in renderer; 12 forged IPC calls rejected; path traversal returned 403; widget has no training IPC bridge. Local clean npm ci in root/frontend followed by installer build passed. Upstream website/container publication workflows are restricted on this fork to explicit workflow_dispatch; no desktop release was published.

## Release gates still to verify

- Fresh Windows CI checkout/install/build result.
- Candidate 1.4.19 installed upgrade: PASS locally, personal training unchanged, real Deepgram greeting audio received, reconnect and key persistence after restart verified. Microphone left off.
- Separate clean Windows machine/VM and different display scaling/monitor arrangements.
- Actual network-provider failures/long-duration voice sessions and Russian recognition across different microphones.
- Explorer crash/restart and Windows reboot. Existing native layering test is not a reboot test.
- Media licensing: NOTICE.md explicitly describes unresolved ownership/permission. Before broad distribution, resolve rights or disable the optional downloader in the public build.

## Distribution limitations

Installer is unsigned; no automatic updater. No GitHub Release has been published. Code remains AGPL-3.0-or-later with upstream attribution; corresponding source and notices must accompany distribution. CI artifacts are test outputs, not a stable-release declaration. No independent penetration test or legal clearance has been performed.
