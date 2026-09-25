# Desktop visual assets

The user chose two style references: https://ru.pinterest.com/pin/12525705209750940/ and https://ru.pinterest.com/pin/600878775323123749/. They guide geometry, palette, typography and character direction; their raster images are not redistributed in the application.

- Rubik variable: Google Fonts repository, `ofl/rubik/Rubik[wght].ttf`, SIL Open Font License (included beside the font). Used throughout the application and native widget.
- `frontend/public/mascots/burger.png`: original generated transparent retro cartoon hamburger with glasses, cap and dumbbell.
- `frontend/public/mascots/cake.png`: original generated transparent strawberry cake with headband, gloves and sneakers.

Both mascots were generated with the built-in imagegen tool on 2026-09-24 for this application. PNG alpha channels were checked; original output pixels are retained. UI animation is implemented in CSS, respects reduced-motion preferences and is triggered by a user interaction or a logged set. No synthetic workout history or calorie/reward claims are attached to the characters.

- `frontend/public/desktop-logo.svg`: project-native vector mark, a diagonal dumbbell on a yellow tile, created 2026-09-25. `desktop-icon-512.png` and the multi-resolution `desktop/icon.ico` are raster exports of this SVG, not imagegen assets. The same mark is used in desktop navigation, About, widget, tray and Windows packaging.
