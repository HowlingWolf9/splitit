# Repository Guidelines & Habits for SplitIt

## Versioning & Release Workflow
1. **Always Bump Version on Features & Releases**:
   - When implementing features, UI overhauls, or preparing commits for release, bump the version in `package.json` (and `package-lock.json`) following semantic versioning (`major`, `minor`, `patch`).
   - Use `npm version <newversion>` or create an annotated git tag (`vX.Y.Z`).

2. **Synchronize Android Assets**:
   - After updating the version, run `npm run android:sync` (`vite build && cap sync android`) so that `dist/`, Android assets, and plugin registrations stay synchronized.

3. **Push With Tags**:
   - Always push commits with `--follow-tags` (`git push origin <branch> --follow-tags`) so the GitHub Actions release workflow (`.github/workflows/android-release.yml`) builds and publishes the APK/AAB release.

## Android Native UI Standards (Capacitor)
- Maintain native mobile UX: safe areas (`env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`), slide-up bottom sheets with drag handles, 48x48px min touch targets, `:active` scaling, and hardware back button handling via `@capacitor/app`.
