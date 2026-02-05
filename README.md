# SplitIt - Group Expense Manager

A modern, feature-rich web application for managing shared expenses in group trips, roommate situations, or any shared financial activities.

## ✨ Features

### 💰 Expense Management
- **Multi-payer support**: Track expenses with multiple people paying different amounts
- **Flexible splitting**: Split expenses equally, by exact amounts, or by custom percentages
- **Detailed tracking**: View complete expense history with search and sorting
- **Transaction history**: See all expenses and settlements in one place

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

### 💾 Data Management
- **Import/Export**: Backup and restore your data
- **Local storage**: All data stored locally in browser
- **Multiple currencies**: Support for 50+ currencies including USD, EUR, INR, GBP, and more

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

## 🐛 Known Limitations

- Data is browser-specific (clearing browser data will delete your expenses)
- No multi-device sync (use export/import to transfer data)
- Currency rates are not automatically converted

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
