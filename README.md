# SplitIt - Group Expense Manager

[![Add to Obtainium](https://img.shields.io/badge/Obtainium-Add_App-3DDC84?style=for-the-badge&logo=android&logoColor=white)](obtainium://app/add/https://github.com/HowlingWolf9/splitit)
[![Latest Release](https://img.shields.io/github/v/release/HowlingWolf9/splitit?style=for-the-badge&logo=github&color=3b82f6)](https://github.com/HowlingWolf9/splitit/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

A modern, feature-rich web and mobile application for managing shared expenses in group trips, roommate situations, or any shared financial activities.

## ✨ Features

### 👥 Multiple Groups (Splitwise-style)
- **Unlimited groups**: Create and manage distinct groups for trips, roommates, projects, events, and couples
- **App-Wide Group Scoping**: Selecting any group automatically scopes all main tabs (Dashboard, Expenses, Balances, Settlements, Members, History) specifically to that group
- **Group Scope Banner**: Persistent sticky banner across views with active group indicators, member count, user net balance, 1-click group switcher, "Settle Up" shortcut, and "View All" reset
- **Splitwise-inspired UI**: Group cards with faceted geometric vector badges, individual status badges, and member debt breakdowns
- **Per-group balances**: Real-time balance calculations, simplified debt graphs, and direct settlements inside each group
- **Group settle-up**: One-click quick debt settlement or custom payments within a specific group
- **Group member management**: Add/remove members per group, with inline quick-member creation
- **Non-group expenses**: Separate tracking for one-off personal expenses between friends
- **User perspective switcher**: Easily switch between users to see what "You owe" or "You are owed" from any member's perspective

### 💰 Expense Management
- **Multi-payer support**: Track expenses with multiple people paying different amounts
- **Flexible splitting**: Split expenses equally, by exact amounts, or by custom percentages
- **Group integration**: Assign expenses directly to groups or non-group with automatic member filtering
- **Detailed tracking**: View complete expense history with search, group filter, and sorting
- **Transaction history**: See all expenses and settlements in one place with group badges

### 👥 Member Management
- **Easy member addition**: Quickly add group members
- **Balance tracking**: Real-time balance calculations for each member
- **Member details**: View individual transaction history per member

### ⚖️ Smart Settlements
- **Simplified settlements**: Minimize the number of transactions needed to settle balances
- **Direct settlements**: See all peer-to-peer settlement options
- **Settlement tracking**: Record and view settlement history
- **PDF export**: Print settlement summaries for record-keeping

### 📊 Dashboard & Analytics
- **Summary statistics**: Quick overview of total expenses, transaction count, and pending balances
- **Recent activity**: View latest transactions at a glance
- **Visual indicators**: Color-coded balances (who owes, who gets paid)

### 🎨 User Experience
- **Dark mode**: Beautiful dark theme optimized for readability
- **Responsive design**: Works seamlessly on desktop and mobile
- **Search functionality**: Find expenses, settlements, or members quickly
- **Empty states**: Helpful messages when no data exists
- **Error handling**: Graceful error management with user-friendly messages

### ☁️ Zero-Server Cloud & Multi-User Sync
- **Google Drive Cross-Device Sync**: 100% client-side sync using Google OAuth and private `appDataFolder` (`splitit_appdata_v1.json`) with zero backend servers and zero hosting costs.
- **Encrypted Peer-to-Peer Multi-User Group Sync**: Shared groups synchronize peer-to-peer using end-to-end encrypted events over free public Nostr relays ($0 server cost). Relays only ever see opaque AES-GCM ciphertext.
- **Cross-Platform Backup Import/Export**: One-click JSON backup export and import with native integration on Android (MediaStore Downloads + Share Sheet), Windows PC (Electron native Save/Open file dialogs), and modern Web browsers.

### 📱 Native Android & Desktop PC Experience
- **Native Android UI**: Capacitor integration with safe-area insets, fixed native bottom navigation with tactile active pills, and hardware back button stack handling.
- **Windows PC Desktop App**: Standalone Electron app packaged into NSIS setup installer and zero-install portable `.exe`.
- **Native Printing & PDF Export**: Native print spooler integration on Android (Android PrintManager) and Windows (Electron WebContents print bridge) with full color preservation and pagination break protection.

### 💾 Data Management
- **Cross-Platform Import/Export**: Full JSON backup and restore with native file dialogs and broad MIME type handling.
- **Local Persistence**: All data stored locally in browser `localStorage` / `%APPDATA%\SplitIt` with offline-first availability.
- **Multiple Currencies**: Support for 50+ currencies including USD, EUR, INR, GBP, and more.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/expense-manager.git
cd expense-manager
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

## 🎯 Usage

### Working with Groups
1. Navigate to the **Groups** tab to view your groups or create a new one.
2. Click **Select Group** on any group card (e.g. "Trip to Goa" or "Apartment 402").
3. Notice that **all tabs** (Dashboard, Expenses, Balances, Settlements, Members) now display **only** the data for that selected group.
4. Use the top **Group Scope Banner** to switch groups at any time or click **View All** to return to the overall multi-group view.

### Adding Members
1. Navigate to the **Members** tab
2. Enter member names and click the add button
3. Members can be removed if they have no associated transactions

### Recording Expenses
1. Go to the **Expenses** tab
2. Click "Add Expense"
3. Fill in:
   - Description (e.g., "Dinner at restaurant")
   - Amount
   - Who paid (can select multiple people with different amounts)
   - How to split (equally, by exact amounts, or percentages)
4. Save the expense

### Viewing Balances
1. Navigate to the **Balances** tab
2. Toggle between "Simplified" and "Direct" settlement views
3. Simplified mode shows the minimum transactions needed
4. Direct mode shows all possible peer-to-peer settlements

### Recording Settlements
1. Go to the **Settlements** tab
2. Click "Add Settlement"
3. Select who paid whom and the amount
4. The balance automatically updates

### Exporting Data
1. Navigate to **Settings**
2. Click "Export Data" to download a JSON backup
3. Use "Import Data" to restore from a backup

## 🛠️ Technology Stack

- **Frontend Framework**: React 18
- **Build Tool**: Vite
- **State Management**: React Context API
- **Styling**: CSS Variables with custom design system
- **Icons**: Lucide React
- **Storage**: Browser LocalStorage

## 📁 Project Structure

```
expense-manager/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.jsx
│   │   ├── DashboardSummary.jsx
│   │   ├── ExpenseForm.jsx
│   │   ├── ExpenseListView.jsx
│   │   ├── ExpenseDetailView.jsx
│   │   ├── SettlementForm.jsx
│   │   ├── SettlementsListView.jsx
│   │   ├── SettlementDetailView.jsx
│   │   ├── MembersView.jsx
│   │   ├── MemberDetail.jsx
│   │   ├── BalancesView.jsx
│   │   ├── GroupsView.jsx
│   │   ├── GroupDetailView.jsx
│   │   ├── GroupScopeBanner.jsx
│   │   ├── GroupCardBanner.jsx
│   │   ├── GroupFormModal.jsx
│   │   ├── GroupSettleUpModal.jsx
│   │   ├── TransactionList.jsx
│   │   ├── Settings.jsx
│   │   ├── UserList.jsx
│   │   └── ErrorBoundary.jsx
│   ├── store/               # State management
│   │   └── ExpenseContext.jsx
│   ├── styles/              # Global styles
│   │   ├── global.css
│   │   └── variables.css
│   ├── App.jsx              # Main application component
│   ├── App.css
│   ├── index.css
│   └── main.jsx             # Application entry point
├── public/                  # Static assets
├── package.json
├── vite.config.js
└── README.md
```

## 🎨 Design System

The application uses a comprehensive design system with:
- **CSS Variables**: Centralized color, spacing, and typography tokens
- **Dark Mode**: Optimized for low-light environments
- **Consistent Components**: Reusable card, button, and form styles
- **Responsive Layout**: Mobile-first approach

## 🔒 Privacy & Data

- **No server required**: All data is stored locally in your browser
- **No tracking**: No analytics or telemetry
- **No account needed**: Use immediately without sign-up
- **Export anytime**: Full data portability with JSON export

## 💡 Storage & Sync Architecture

- **Local-First & Offline-Ready**: All data is stored locally on device (`localStorage` on Web/Android, `%APPDATA%\SplitIt` on PC). The app functions 100% offline.
- **Cross-Device Sync**: Connect Google Drive in Settings for zero-cost, serverless automatic backup and cross-device sync.
- **Group Collaboration**: Shared groups synchronize peer-to-peer over public Nostr relays with end-to-end AES-GCM encryption.
- **Currency Conversion**: SplitIt tracks expenses in your chosen base currency (50+ available). Multi-currency real-time exchange conversion can be supplemented via custom rate adjustment.

## 📱 Android App & Release Builds

SplitIt includes first-class Android support powered by Capacitor. You can generate both installable **APK** files and Google Play **AAB** (Android App Bundle) release packages.

### 📲 Install & Auto-Update via Obtainium

[Obtainium](https://github.com/ImranR98/Obtainium) allows you to install and receive automatic, seamless background updates directly from GitHub Releases.

<p align="left">
  <a href="https://apps.obtainium.imranr.dev/redirect?r=obtainium%3A%2F%2Fapp%2F%257B%2522id%2522%253A%2522com.splitit.expensemanager%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fgithub.com%252FHowlingWolf9%252Fsplitit%2522%252C%2522author%2522%253A%2522HowlingWolf9%2522%252C%2522name%2522%253A%2522SplitIt%2522%257D">
    <img src="https://img.shields.io/badge/Obtainium-Add_App-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Add to Obtainium" />
  </a>
</p>

- **1-Click Install (with Web Fallback)**:  
  👉 **[Add to Obtainium](https://apps.obtainium.imranr.dev/redirect?r=obtainium%3A%2F%2Fapp%2F%257B%2522id%2522%253A%2522com.splitit.expensemanager%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fgithub.com%252FHowlingWolf9%252Fsplitit%2522%252C%2522author%2522%253A%2522HowlingWolf9%2522%252C%2522name%2522%253A%2522SplitIt%2522%257D)**  
  *(Opens Obtainium directly if installed; otherwise prompts to download Obtainium)*
- **Direct URI Schemes**:
  - Add Single App: [`obtainium://add/https://github.com/HowlingWolf9/splitit`](obtainium://add/https://github.com/HowlingWolf9/splitit)
  - Full App Config: `obtainium://app/%7B%22id%22%3A%22com.splitit.expensemanager%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2FHowlingWolf9%2Fsplitit%22%2C%22author%22%3A%22HowlingWolf9%22%2C%22name%22%3A%22SplitIt%22%7D`
- **Scan QR Code**: Scan with your mobile camera to open in Obtainium:  
  <br/>
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fapps.obtainium.imranr.dev%2Fredirect%3Fr%3Dobtainium%253A%252F%252Fapp%252F%25257B%252522id%252522%25253A%252522com.splitit.expensemanager%252522%25252C%252522url%252522%25253A%252522https%25253A%25252F%25252Fgithub.com%25252FHowlingWolf9%25252Fsplitit%252522%25252C%252522author%252522%25253A%252522HowlingWolf9%252522%25252C%252522name%252522%25253A%252522SplitIt%252522%25257D" alt="Scan to add in Obtainium" width="150" />
- **Manual Setup in Obtainium**:
  1. Open Obtainium and tap **Add App**.
  2. Enter App Source URL: `https://github.com/HowlingWolf9/splitit`
  3. (Optional) Filter APK: `SplitIt-release\.apk`
  4. Tap **Add** &rarr; Obtainium will download `SplitIt-release.apk` and notify you of new releases automatically!
- **Pre-configured Import File**: You can also import [`obtainium.json`](obtainium.json) via Obtainium's **Import/Export** menu.

### 🛠️ Local Android Commands

- **Build APK & Bundle (All)**:
  ```bash
  npm run android:build
  ```
- **Build Release APK only**:
  ```bash
  npm run android:build:apk
  ```
- **Build Release Bundle (AAB) only**:
  ```bash
  npm run android:build:bundle
  ```
- **Open in Android Studio**:
  ```bash
  npm run cap:open
  ```
- **Sync web build to native Android project**:
  ```bash
  npm run android:sync
  ```

Artifact outputs:
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`
- Release AAB: `android/app/build/outputs/bundle/release/app-release.aab`

### 🔑 Signing Configuration

- **Development / Sideloading**: Release builds work out-of-the-box with automatic signing fallbacks, allowing immediate testing and installation on real devices and emulators.
- **Production Key Generation**:
  Generate an official release keystore and get the exact Base64 string for GitHub Secrets:
  ```bash
  npm run keystore:generate
  ```
- **Local `keystore.properties`**: You can place `android/keystore.properties` (git-ignored) with:
  ```properties
  storeFile=release.keystore
  storePassword=YOUR_PASSWORD
  keyAlias=YOUR_ALIAS
  keyPassword=YOUR_PASSWORD
  ```

### 🤖 GitHub Actions CI/CD Pipeline

A production-ready GitHub Actions workflow is located at `.github/workflows/android-release.yml`.

#### How to Trigger Builds in CI:
1. **Push a Release Tag**:
   Pushing any tag matching `v*` (e.g., `git tag v1.0.0 && git push origin v1.0.0`) automatically:
   - Builds both the Release APK and AAB Bundle.
   - Uploads them as GitHub workflow run artifacts (30 days retention).
   - Creates a **GitHub Release** with `SplitIt-release.apk` and `SplitIt-release.aab` attached and release notes auto-generated.
2. **Push to `main`**:
   Builds and uploads APK & AAB artifacts on every push to `main`.
3. **Manual Trigger (`workflow_dispatch`)**:
   Run manually under the **Actions** tab on GitHub with optional flags:
   - `publish_release`: Create a GitHub Release directly
   - `release_tag`: Custom tag name (e.g. `v1.0.1`)

#### Production Signing Secrets (GitHub Repository):
Under repository **Settings** &rarr; **Secrets and variables** &rarr; **Actions**, configure:
- `ANDROID_KEYSTORE_BASE64`: Base64 encoded keystore string (generated via `npm run keystore:generate`).
- `KEYSTORE_PASSWORD`: Keystore password.
- `KEY_ALIAS`: Key alias.
- `KEY_PASSWORD`: Key alias password.

*(If secrets are not yet added, the CI workflow continues smoothly using fallback signing, so runs never fail).*

## 💻 Windows PC Desktop Application

SplitIt provides a standalone native Windows desktop application powered by Electron, featuring offline data persistence, desktop shortcuts, and direct integration with native Windows printing.

### 📦 Available Executable Packages
- **Setup Installer (`SplitIt-Setup-<version>.exe`)**: Traditional Windows installer with custom installation directory choice, Desktop shortcut, and Start Menu integration.
- **Portable App (`SplitIt-Portable-<version>.exe`)**: Zero-install standalone executable. Runs instantly from any folder or USB flash drive without administrator privileges.

### 🛠️ Local PC Commands
- **Start Desktop in Development (Live HMR)**:
  ```bash
  npm run electron:dev
  ```
- **Build Windows Executables (Production)**:
  ```bash
  npm run build:pc
  ```
  Artifacts will be packaged into the `release/` directory:
  - `release/SplitIt-Setup-<version>.exe`
  - `release/SplitIt-Portable-<version>.exe`

### 🖨️ Native Printing & PDF Export
When clicking "Print / Save PDF" inside the application (e.g. from the custom Statement generator), Electron opens the native Windows print spooler with full color fidelity and background graphics enabled (`printBackground: true`), allowing 1-click printing or "Microsoft Print to PDF" export.

### 🤖 Windows CI/CD Pipeline
The Windows automated release workflow (`.github/workflows/pc-release.yml`) builds and publishes both `.exe` packages to GitHub Releases alongside the Android APK on version tags (`v*`) and manual dispatch.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Icons by [Lucide](https://lucide.dev/)
- Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/)

## 📧 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/yourusername/expense-manager/issues).

---

Made with ❤️ for simplifying group expenses
