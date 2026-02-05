import React, { useState } from 'react';
import { ExpenseProvider } from './store/ExpenseContext';
import Dashboard from './components/Dashboard';
import UserList from './components/UserList';
import TransactionList from './components/TransactionList';
import Settings from './components/Settings';
import ExpenseListView from './components/ExpenseListView';
import ExpenseDetailView from './components/ExpenseDetailView';
import SettlementsListView from './components/SettlementsListView';
import SettlementDetailView from './components/SettlementDetailView';
import MembersView from './components/MembersView';
import MemberDetail from './components/MemberDetail';
import BalancesView from './components/BalancesView';
import ErrorBoundary from './components/ErrorBoundary';

function ExpenseApp() {
  const [activeTab, setActiveTab] = useState('DASHBOARD'); // DASHBOARD, EXPENSES, SETTLEMENTS, MEMBERS, BALANCES, SETTINGS
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [viewingSettlement, setViewingSettlement] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  const handleEditTransaction = (transaction) => {
    // This will be handled within ExpenseListView now
  };

  const handleViewTransaction = (transaction) => {
    setViewingTransaction(transaction);
  };

  const handleViewSettlement = (settlement) => {
    setViewingSettlement(settlement);
  };

  const handleSelectMember = (member) => {
    setSelectedMember(member);
  };

  const handleBackToMembers = () => {
    setSelectedMember(null);
  };

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <header style={{ padding: '2rem 0', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'hsl(var(--color-primary))', fontWeight: '800' }}>SplitIt</h1>
        <p style={{ color: 'hsl(var(--color-text-muted))' }}>Group Expense Manager</p>
      </header>

      {/* Navigation / Actions */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          className={`btn btn-nav ${activeTab === 'DASHBOARD' ? 'active' : ''}`}
          onClick={() => setActiveTab('DASHBOARD')}
        >
          Dashboard
        </button>
        <button
          className={`btn btn-nav ${activeTab === 'EXPENSES' ? 'active' : ''}`}
          onClick={() => setActiveTab('EXPENSES')}
        >
          📊 Expenses
        </button>
        <button
          className={`btn btn-nav ${activeTab === 'SETTLEMENTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('SETTLEMENTS')}
        >
          💰 Settlements
        </button>
        <button
          className={`btn btn-nav ${activeTab === 'MEMBERS' ? 'active' : ''}`}
          onClick={() => { setActiveTab('MEMBERS'); setSelectedMember(null); }}
        >
          👥 Members
        </button>
        <button
          className={`btn btn-nav ${activeTab === 'BALANCES' ? 'active' : ''}`}
          onClick={() => setActiveTab('BALANCES')}
        >
          ⚖️ Balances
        </button>
        <button
          className={`btn btn-nav ${activeTab === 'SETTINGS' ? 'active' : ''}`}
          onClick={() => setActiveTab('SETTINGS')}
        >
          ⚙ Settings
        </button>
      </div>

      {/* Content Area */}
      <div style={{ display: 'grid', gap: '2rem' }}>

        {activeTab === 'DASHBOARD' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              <Dashboard />
              <UserList />
            </div>
            <div className="card">
              <h2 style={{ marginBottom: '1rem' }}>Recent History</h2>
              <TransactionList
                onEditTransaction={handleEditTransaction}
                onViewTransaction={handleViewTransaction}
              />
            </div>
          </>
        )}

        {activeTab === 'EXPENSES' && (
          <ExpenseListView
            onEditTransaction={handleEditTransaction}
            onViewTransaction={handleViewTransaction}
          />
        )}

        {activeTab === 'SETTLEMENTS' && (
          <SettlementsListView onViewSettlement={handleViewSettlement} />
        )}

        {activeTab === 'MEMBERS' && (
          selectedMember ? (
            <MemberDetail
              member={selectedMember}
              onBack={handleBackToMembers}
              onEditTransaction={handleEditTransaction}
              onViewTransaction={handleViewTransaction}
            />
          ) : (
            <MembersView onSelectMember={handleSelectMember} />
          )
        )}

        {activeTab === 'BALANCES' && (
          <BalancesView />
        )}

        {activeTab === 'SETTINGS' && (
          <Settings />
        )}

        {/* View Transaction Modal */}
        {viewingTransaction && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <ExpenseDetailView
              expense={viewingTransaction}
              onClose={() => setViewingTransaction(null)}
            />
          </div>
        )}

        {/* View Settlement Modal */}
        {viewingSettlement && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <SettlementDetailView
              settlement={viewingSettlement}
              onClose={() => setViewingSettlement(null)}
            />
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
          <ExpenseApp />
        </ExpenseProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
