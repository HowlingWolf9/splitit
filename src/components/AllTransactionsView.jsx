import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { Search, History, Plus, HandCoins } from 'lucide-react';
import TransactionList from './TransactionList';
import ExpenseForm from './ExpenseForm';
import SettlementForm from './SettlementForm';

export default function AllTransactionsView({ onViewTransaction, onViewSettlement }) {
    const { state, selectedGroupId, setSelectedGroupId, selectedGroup } = useExpenses();
    const [sortBy, setSortBy] = useState('date-desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingExpense, setEditingExpense] = useState(null);
    const [editingSettlement, setEditingSettlement] = useState(null);
    const [isAddingExpense, setIsAddingExpense] = useState(false);
    const [isAddingSettlement, setIsAddingSettlement] = useState(false);

    const groupFilter = selectedGroupId === 'non-group' ? 'NON_GROUP' : (selectedGroupId || 'ALL');

    const handleGroupFilterChange = (e) => {
        const val = e.target.value;
        if (val === 'ALL') setSelectedGroupId(null);
        else if (val === 'NON_GROUP') setSelectedGroupId('non-group');
        else setSelectedGroupId(val);
    };

    const transactions = state.transactions || [];

    const getUserName = (id) => {
        const u = state.users.find(u => u.id === id);
        return u ? u.name : 'Unknown';
    };

    const filteredTransactions = transactions.filter(t => {
        if (groupFilter === 'NON_GROUP') {
            if (t.groupId) return false;
        } else if (groupFilter !== 'ALL') {
            if (t.groupId !== groupFilter) return false;
        }

        if (!searchQuery) return true;
        
        const query = searchQuery.toLowerCase();
        let match = false;
        
        if (t.description.toLowerCase().includes(query)) match = true;
        if (t.amount.toString().includes(query)) match = true;

        if (t.type === 'EXPENSE') {
            if (t.payers?.some(p => getUserName(p.userId).toLowerCase().includes(query))) match = true;
            if (t.splits?.some(s => getUserName(s.userId).toLowerCase().includes(query))) match = true;
        } else if (t.type === 'SETTLEMENT') {
            if (getUserName(t.from).toLowerCase().includes(query)) match = true;
            if (getUserName(t.to).toLowerCase().includes(query)) match = true;
        }

        return match;
    });

    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
        switch (sortBy) {
            case 'date-desc': {
                const dateDiff = new Date(b.date) - new Date(a.date);
                if (dateDiff === 0) {
                    const bUpdated = b.updatedAt ? new Date(b.updatedAt) : 0;
                    const aUpdated = a.updatedAt ? new Date(a.updatedAt) : 0;
                    return bUpdated - aUpdated;
                }
                return dateDiff;
            }
            case 'date-asc': {
                const dateDiff = new Date(a.date) - new Date(b.date);
                if (dateDiff === 0) {
                    const bUpdated = b.updatedAt ? new Date(b.updatedAt) : 0;
                    const aUpdated = a.updatedAt ? new Date(a.updatedAt) : 0;
                    return aUpdated - bUpdated;
                }
                return dateDiff;
            }
            case 'amount-desc':
                return b.amount - a.amount;
            case 'amount-asc':
                return a.amount - b.amount;
            case 'desc-asc':
                return a.description.localeCompare(b.description);
            default:
                return 0;
        }
    });

    return (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
            {/* Header & Controls Toolbar */}
            <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
                            Activity Ledger {selectedGroup ? `— ${selectedGroup.name}` : ''}
                        </h2>
                        <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                            {filteredTransactions.length} recorded events
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <select
                            className="input"
                            value={groupFilter}
                            onChange={handleGroupFilterChange}
                            style={{ maxWidth: '170px', padding: '0.42rem 0.65rem', fontSize: '0.84rem' }}
                        >
                            <option value="ALL">All Groups</option>
                            <option value="NON_GROUP">Non-group</option>
                            {(state.groups || []).map(g => (
                                <option key={g.id} value={g.id}>👥 {g.name}</option>
                            ))}
                        </select>

                        <select
                            className="input"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ maxWidth: '150px', padding: '0.42rem 0.65rem', fontSize: '0.84rem' }}
                        >
                            <option value="date-desc">Newest First</option>
                            <option value="date-asc">Oldest First</option>
                            <option value="amount-desc">Highest Amount</option>
                            <option value="amount-asc">Lowest Amount</option>
                            <option value="desc-asc">Title A-Z</option>
                        </select>
                    </div>
                </div>

                {/* Search */}
                <div style={{ position: 'relative' }}>
                    <Search size={15} style={{
                        position: 'absolute',
                        left: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'hsl(var(--color-text-muted))'
                    }} />
                    <input
                        type="text"
                        placeholder="Search all transactions, payments, or members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input"
                        style={{
                            paddingLeft: '2.2rem',
                            padding: '0.45rem 0.65rem 0.45rem 2.2rem',
                            fontSize: '0.84rem'
                        }}
                    />
                </div>
            </div>

            {/* List */}
            {sortedTransactions.length === 0 ? (
                <div className="card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'hsl(var(--color-surface-dim))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem',
                        color: 'hsl(var(--color-text-muted))'
                    }}>
                        <History size={24} />
                    </div>
                    <p style={{ color: 'hsl(var(--color-text-main))', fontWeight: 600, fontSize: '1rem', margin: 0 }}>
                        {searchQuery ? 'No matching activity found' : 'No recorded activity yet'}
                    </p>
                    <p style={{ color: 'hsl(var(--color-text-muted))', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
                        Transactions and settlements will appear in this ledger
                    </p>
                </div>
            ) : (
                <TransactionList
                    transactions={sortedTransactions}
                    onEditTransaction={setEditingExpense}
                    onViewTransaction={onViewTransaction}
                    onEditSettlement={setEditingSettlement}
                    onViewSettlement={onViewSettlement}
                />
            )}

            {/* Edit Modals */}
            {editingExpense && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setEditingExpense(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '800px' }}>
                        <ExpenseForm
                            editingTransaction={editingExpense}
                            onCancel={() => setEditingExpense(null)}
                            onSuccess={() => setEditingExpense(null)}
                        />
                    </div>
                </div>
            )}

            {editingSettlement && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setEditingSettlement(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <SettlementForm
                            editingSettlement={editingSettlement}
                            onCancel={() => setEditingSettlement(null)}
                            onSuccess={() => setEditingSettlement(null)}
                        />
                    </div>
                </div>
            )}

            {/* Quick Add Expense Modal */}
            {isAddingExpense && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsAddingExpense(false);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '800px' }}>
                        <ExpenseForm
                            onCancel={() => setIsAddingExpense(false)}
                            onSuccess={() => setIsAddingExpense(false)}
                            defaultGroupId={selectedGroupId === 'non-group' ? null : selectedGroupId}
                        />
                    </div>
                </div>
            )}

            {/* Quick Record Settlement Modal */}
            {isAddingSettlement && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsAddingSettlement(false);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <SettlementForm
                            onCancel={() => setIsAddingSettlement(false)}
                            onSuccess={() => setIsAddingSettlement(false)}
                            defaultGroupId={selectedGroupId === 'non-group' ? null : selectedGroupId}
                        />
                    </div>
                </div>
            )}

            {/* Floating Action Buttons */}
            <div className="fab-container">
                <button
                    type="button"
                    className="fab fab-secondary"
                    onClick={() => setIsAddingSettlement(true)}
                    title="Record Settlement"
                >
                    <HandCoins size={18} strokeWidth={2.2} />
                    <span>Record Settlement</span>
                </button>
                <button
                    type="button"
                    className="fab fab-primary"
                    onClick={() => setIsAddingExpense(true)}
                    title="Add Expense"
                >
                    <Plus size={18} strokeWidth={2.5} />
                    <span>Add Expense</span>
                </button>
            </div>
        </div>
    );
}
