import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { ExpenseProvider } from './store/ExpenseContext';
import DashboardSummary from './components/DashboardSummary';
import TransactionList from './components/TransactionList';
import Settings from './components/Settings';
import ExpenseListView from './components/ExpenseListView';
import ExpenseDetailView from './components/ExpenseDetailView';
import SettlementsListView from './components/SettlementsListView';
import SettlementDetailView from './components/SettlementDetailView';
import MembersView from './components/MembersView';
import MemberDetail from './components/MemberDetail';
import BalancesView from './components/BalancesView';
import AllTransactionsView from './components/AllTransactionsView';
import ExpenseForm from './components/ExpenseForm';
import SettlementForm from './components/SettlementForm';
import ErrorBoundary from './components/ErrorBoundary';

function DashboardView({ onEditTransaction, onViewTransaction, onEditSettlement, onViewSettlement }) {
    return (
        <>
            <DashboardSummary />
            <div className="card">
                <h2 style={{ marginBottom: '1rem' }}>Recent History</h2>
                <TransactionList
                    onEditTransaction={onEditTransaction}
                    onViewTransaction={onViewTransaction}
                    onEditSettlement={onEditSettlement}
                    onViewSettlement={onViewSettlement}
                />
            </div>
        </>
    );
}

function ExpenseApp() {
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [viewingSettlement, setViewingSettlement] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingSettlement, setEditingSettlement] = useState(null);

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
  };

  const handleEditSettlement = (settlement) => {
    setEditingSettlement(settlement);
  };

  const handleViewTransaction = (transaction) => {
    setViewingTransaction(transaction);
  };

  const handleViewSettlement = (settlement) => {
    setViewingSettlement(settlement);
  };

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <header style={{ padding: '2rem 0', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'hsl(var(--color-primary))', fontWeight: '800' }}>SplitIt</h1>
        <p style={{ color: 'hsl(var(--color-text-muted))' }}>Group Expense Manager</p>
      </header>

      {/* Navigation / Actions */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <NavLink to="/" end className={({ isActive }) => `btn btn-nav ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
          Dashboard
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => `btn btn-nav ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
          📊 Expenses
        </NavLink>
        <NavLink to="/settlements" className={({ isActive }) => `btn btn-nav ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
          💰 Settlements
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `btn btn-nav ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
          📜 History
        </NavLink>
        <NavLink to="/members" className={({ isActive }) => `btn btn-nav ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
          👥 Members
        </NavLink>
        <NavLink to="/balances" className={({ isActive }) => `btn btn-nav ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
          ⚖️ Balances
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `btn btn-nav ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
          ⚙ Settings
        </NavLink>
      </div>

      {/* Content Area */}
      <div style={{ display: 'grid', gap: '2rem' }}>
        <Routes>
          <Route path="/" element={<DashboardView onEditTransaction={handleEditTransaction} onViewTransaction={handleViewTransaction} onEditSettlement={handleEditSettlement} onViewSettlement={handleViewSettlement} />} />
          <Route path="/expenses" element={<ExpenseListView onViewTransaction={handleViewTransaction} />} />
          <Route path="/settlements" element={<SettlementsListView onViewSettlement={handleViewSettlement} />} />
          <Route path="/history" element={<AllTransactionsView onViewTransaction={handleViewTransaction} onViewSettlement={handleViewSettlement} />} />
          <Route path="/members" element={<MembersView />} />
          <Route path="/members/:id" element={<MemberDetail onEditTransaction={handleEditTransaction} onViewTransaction={handleViewTransaction} onEditSettlement={handleEditSettlement} onViewSettlement={handleViewSettlement} />} />
          <Route path="/balances" element={<BalancesView />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>

        {/* View Transaction Modal */}
        {viewingTransaction && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
              overflowY: 'auto'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setViewingTransaction(null);
              }
            }}
          >
            <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
              <ExpenseDetailView
                expense={viewingTransaction}
                onClose={() => setViewingTransaction(null)}
              />
            </div>
          </div>
        )}

        {/* View Settlement Modal */}
        {viewingSettlement && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
              overflowY: 'auto'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setViewingSettlement(null);
              }
            }}
          >
            <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
              <SettlementDetailView
                settlement={viewingSettlement}
                onClose={() => setViewingSettlement(null)}
              />
            </div>
          </div>
        )}

        {/* Edit Expense Modal */}
        {editingTransaction && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
              overflowY: 'auto'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setEditingTransaction(null);
              }
            }}
          >
            <div style={{ marginTop: '2rem', marginBottom: '2rem', width: '100%', maxWidth: '800px' }}>
              <ExpenseForm
                editingTransaction={editingTransaction}
                onCancel={() => setEditingTransaction(null)}
                onSuccess={() => setEditingTransaction(null)}
              />
            </div>
          </div>
        )}

        {/* Edit Settlement Modal */}
        {editingSettlement && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
              overflowY: 'auto'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setEditingSettlement(null);
              }
            }}
          >
            <div style={{ marginTop: '2rem', marginBottom: '2rem', width: '100%', maxWidth: '600px' }}>
              <SettlementForm
                editingSettlement={editingSettlement}
                onCancel={() => setEditingSettlement(null)}
                onSuccess={() => setEditingSettlement(null)}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function App() {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <ExpenseProvider>
          <BrowserRouter>
            <ExpenseApp />
          </BrowserRouter>
        </ExpenseProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
