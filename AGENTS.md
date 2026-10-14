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
