# Repository Guidelines & Habits for SplitIt

## Versioning & Release Workflow
1. **Strict Semantic Versioning (SemVer)**:
   - Follow strict 3-segment SemVer (`major.minor.patch`, e.g., `v1.2.0`). Never introduce 4-segment or run-number tags (`vX.Y.Z.N`), as they break package managers and [Obtainium](https://github.com/ImranR98/Obtainium) update detection.
   - Use standard npm version scripts: `npm run release:patch`, `npm run release:minor`, or `npm run release:major`.

2. **Synchronize Android Assets**:
   - Always run `npm run android:sync` (`vite build && cap sync android`) after updating dependencies, assets, or versioning to keep `dist/`, `android/app/src/main/assets/public`, and Capacitor plugin registries synchronized.

3. **Tag-Driven Releases**:
   - GitHub Releases (`.github/workflows/android-release.yml`) are strictly **tag-driven** (`tags: ['v*']`).
   - Normal commits pushed to `main` perform CI compilation checks and upload temporary build artifacts, but will **never** automatically create releases or tags.
   - To trigger an official release with signed APK and AAB bundles, push with tags:
     ```bash
     git push origin <branch> --follow-tags
     ```

4. **Mandatory Version Bumping & Commits Upon Task Completion**:
   - Always bump the application version upon the completion of any feature, bug fix, or task before concluding your turn:
     - Use `patch` for bug fixes, performance optimizations, and incremental adjustments (e.g., `v1.2.1` &rarr; `v1.2.2`).
     - Use `minor` for new features, new platform support (e.g., Windows PC desktop app), or major workflow enhancements (e.g., `v1.2.1` &rarr; `v1.3.0`).
     - Use `major` for breaking architectural or data schema shifts.
   - Always run `npm run android:sync` after bumping the version to ensure `dist/`, `android/app/src/main/assets/public`, and Capacitor configs are synchronized with the new version number.
   - Always stage and commit all verified changes and the version bump at the conclusion of every coding task. Never leave verified changes unstaged or uncommitted in the working tree.
   - Use conventional commit standards (e.g., `feat(...)`, `fix(...)`, `chore(release): bump version to vX.Y.Z`) with clear, descriptive messages summarizing what was accomplished.
   - Automatically push verified commits and tags (`git push origin <branch> --follow-tags`) upon task completion so that CI compilation, GitHub Releases, and Obtainium update distribution trigger seamlessly without requiring manual user intervention.



## Android Native UI Standards (Capacitor)
- **Safe Areas & Insets**: Respect mobile viewport cutouts using CSS environment variables (`var(--safe-area-top)` / `env(safe-area-inset-top)` and `var(--safe-area-bottom)` / `env(safe-area-inset-bottom)`).
- **Navigation Chrome**: Maintain fixed native bottom navigation (`.bottom-nav-bar`) with tactile active pills and min 48x48px touch targets.
- **Hardware Back Button**: Register modal and view dismissals with `@capacitor/app` and `src/utils/backButton.js` (`useModalBackHandler`, `popBackAction`).
- **Modals & Bottom Sheets**: Use slide-up sheets with drag handles (`.bottom-sheet-handle`) and touch feedback.

## Native Mobile Printing & PDF Export
- **Print Bridge**: Native mobile printing on Android (`com.splitit.expensemanager`) is handled by `android.print.PrintManager` via `MainActivity.java` (`AndroidPrint` `@JavascriptInterface` and companion `AndroidPrintPlugin`).
- **Frontend Utility**: Always invoke printing through `triggerPrint(documentTitle)` in `src/utils/printHelper.js`:
  - On native Android, it triggers the native system print spooler with "Save as PDF" and physical printer support.
  - On Web/Desktop browsers, it dynamically updates `document.title` (for default PDF naming) and calls `window.print()`, safely restoring the title on `afterprint`.
- **Print CSS Isolation**: All print documents must respect `@media print` rules in `src/styles/global.css`:
  - Strictly hide all screen-only UI, navigation bars, bottom sheets, FABs, and action buttons (`display: none !important;`).
  - Preserve color fidelity using `print-color-adjust: exact !important;` and `-webkit-print-color-adjust: exact !important;`.
  - Prevent mid-card/row slicing across pages using `.print-avoid-break` and `break-inside: avoid; page-break-inside: avoid;`.

## Windows PC Desktop Application (Tauri v2)
- **Local Development & Build Scripts**:
  - `npm run tauri:dev`: Starts Vite dev server with instant HMR and attaches the Tauri desktop window.
  - `npm run build:pc`: Compiles the production bundle (`vite build`) and runs `tauri build`.
- **Packaging Targets (`release/`)**:
  - **NSIS Setup Installer**: `SplitIt-Setup-<version>.exe` (customizable install directory, Start Menu, and Desktop shortcuts).
  - **Portable Executable**: `SplitIt-Portable-<version>.exe` (zero-install standalone `.exe` that runs from anywhere or a flash drive).
- **Desktop Architecture & State Persistence**:
  - Core Process: `src-tauri/src/lib.rs` & `src-tauri/src/main.rs` (Rust backend with `tiny_http` OAuth loopback receiver and native backup file handlers).
  - Frontend Bridge: Official Tauri v2 plugins (`@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-opener`).
  - Window Metrics: Default `1280x820`, min `400x600`, dark theme, high-res application icons (`src-tauri/icons/`).
  - State Persistence: Microsoft Edge WebView2 persistent user profile, ensuring permanent `localStorage` and `IndexedDB`.
- **Desktop Native Printing & PDF Export**:
  - Automatically activates when `triggerPrint` or `window.print()` is executed.
  - Edge WebView2 routes through the native Windows print preview & spooler with dynamic document title default naming.
- **Tag-Driven CI/CD**:
  - Windows release builds run in `.github/workflows/pc-release.yml` on `v*` tags and `workflow_dispatch`.
  - Uses `dtolnay/rust-toolchain@stable` and `swatinem/rust-cache@v2`.
  - Uploads both Setup and Portable `.exe` packages to the GitHub Release without altering Android APK assets (preserving Obtainium update detection).

## Core Feature Invariants & Pre-Completion Regression Checklist
The following invariants are strictly mandatory and must NEVER be regressed or altered in future edits:
1. **Vertical Scroll Invariant**:
   - Never apply `overflow: hidden` or `overscroll-behavior-y: none` to `body`, `html`, `#root`, or view containers without a properly constrained flex scroll container.
   - Long lists (`AllTransactionsView`, `Settings`, `GroupDetailView`, `BalancesView`) must scroll vertically on touch devices and desktop mice without getting stuck.
   - All modals and bottom sheets (`ExpenseForm`, `GroupFormModal`, `GroupSettleUpModal`, `SettlementForm`, `JoinSharedGroupModal`) must maintain `max-height: 85dvh; overflow-y: auto; -webkit-overflow-scrolling: touch;`.
   - Body scroll locking (`body.modal-open`) must be cleanly restored (`overflow: ''`) when closing or unmounting modals, including when dismissed via Android's hardware back button.
2. **Expense Edit State Invariant**:
   - When editing an existing transaction in `ExpenseForm`, hydrated data (`description`, `amount`, `date`, `category`, `groupId`, `splitMode`, `splitType`, `splitShares`, custom `splits`, and multi-payer `payers` maps) must NEVER be wiped out or reset to default equal splits on initial render.
   - Dynamic recalculation must only trigger when the user *actively* changes the `splitMode` or manually modifies the total amount.
   - When `splitMode === 'SHARES'` or `'PERCENTAGE'`, existing share ratios and percentage values must be preserved when the amount changes, recalculating only derived currency amounts.
3. **Cross-Platform I/O Invariant**:
   - **Printing**: Always route through `triggerPrint(docTitle)` in `src/utils/printHelper.js`, utilizing Android's native print spooler (`MainActivity.java` via `@JavascriptInterface`) and Windows WebView2 print bridge.
   - **Data Backup Export/Import**: Always route through `exportBackupJson()` and `openDesktopBackupFile()` / `readJsonFile()` in `src/utils/fileHelper.js`. Never rely solely on web `<a download="blob:...">` (broken on Android WebView) or restrictive `<input type="file" accept=".json">` (which greys out JSON files in Android DocumentsUI; must accept `.json,application/json,text/plain,*/*`).
4. **Single-Source UI Chrome Invariant**:
   - Navigation chrome (Top App Bar titles, back buttons via `src/utils/backButton.js`, bottom navigation, and the primary Add Expense FAB) is managed centrally in `src/App.jsx`.
   - Child views (`DashboardView`, `GroupsView`, `GroupDetailView`, `BalancesView`, `MembersView`, `AllTransactionsView`, `Settings`) must never render duplicate mobile headers, duplicate back buttons, or duplicate `.fab-container` elements. Use `.desktop-only-header` and `.desktop-only-action` to avoid double UI elements on mobile.

