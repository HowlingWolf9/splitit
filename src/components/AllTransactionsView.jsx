import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { ArrowUpDown, Search, List, Plus } from 'lucide-react';
import TransactionList from './TransactionList';
import ExpenseForm from './ExpenseForm';
import SettlementForm from './SettlementForm';

export default function AllTransactionsView({ onViewTransaction, onViewSettlement }) {
    const { state } = useExpenses();
    const [sortBy, setSortBy] = useState('date-desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingExpense, setEditingExpense] = useState(null);
    const [editingSettlement, setEditingSettlement] = useState(null);
    const [isAddingExpense, setIsAddingExpense] = useState(false);
    const [isAddingSettlement, setIsAddingSettlement] = useState(false);

    const transactions = state.transactions || [];

    const getUserName = (id) => {
        const u = state.users.find(u => u.id === id);
        return u ? u.name : 'Unknown';
    };

    const filteredTransactions = transactions.filter(t => {
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
            case 'desc-desc':
                return b.description.localeCompare(a.description);
            default:
                return 0;
        }
    });

    const handleCloseExpenseForm = () => {
        setEditingExpense(null);
        setIsAddingExpense(false);
    };

    const handleCloseSettlementForm = () => {
        setEditingSettlement(null);
        setIsAddingSettlement(false);
    };

    return (
        <div>
            {/* Header */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <List size={24} style={{ color: 'hsl(var(--color-primary))' }} />
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>All Transactions</h2>
                </div>
            </div>

            {transactions.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'hsl(var(--color-text-muted))', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                        No transactions yet.
                    </p>
                </div>
            ) : (
                <>
                    {/* Controls */}
                    <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ArrowUpDown size={18} />
                            <span style={{ fontWeight: 600 }}>Sort by:</span>
                        </div>
                        <select
                            className="input"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ maxWidth: '200px', padding: '0.5rem' }}
                        >
                            <option value="date-desc">Date (Newest First)</option>
                            <option value="date-asc">Date (Oldest First)</option>
                            <option value="amount-desc">Amount (High to Low)</option>
                            <option value="amount-asc">Amount (Low to High)</option>
                            <option value="desc-asc">Description (A-Z)</option>
                            <option value="desc-desc">Description (Z-A)</option>
                        </select>

                        {/* Search Input */}
                        <div style={{ position: 'relative', flex: '1 1 250px', minWidth: '200px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--color-text-muted))' }} />
                            <input
                                type="text"
                                placeholder="Search all transactions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input"
                                style={{
                                    paddingLeft: '2.5rem',
                                    padding: '0.5rem 0.5rem 0.5rem 2.5rem'
                                }}
                            />
                        </div>

                        <span style={{ marginLeft: 'auto', color: 'hsl(var(--color-text-muted))', fontSize: '0.9rem' }}>
                            {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
                        </span>
                    </div>

                    {/* List */}
                    {sortedTransactions.length === 0 && searchQuery ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                            <p style={{ color: 'hsl(var(--color-text-muted))', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                                No transactions found
                            </p>
                            <p style={{ color: 'hsl(var(--color-text-muted))', fontSize: '0.9rem' }}>
                                Try adjusting your search terms
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
                </>
            )}

            {/* Floating Action Buttons */}
            <div style={{
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                zIndex: 100
            }}>
                <button
                    onClick={() => setIsAddingSettlement(true)}
                    style={{
                        background: 'hsl(var(--color-success))',
                        color: 'white',
                        border: 'none',
                        borderRadius: '2rem',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        fontWeight: '600',
                        fontSize: '0.95rem',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'; }}
                >
                    <Plus size={20} />
                    Settlement
                </button>
                
                <button
                    onClick={() => setIsAddingExpense(true)}
                    style={{
                        background: 'hsl(var(--color-accent))',
                        color: 'white',
                        border: 'none',
                        borderRadius: '2rem',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        fontWeight: '600',
                        fontSize: '0.95rem',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'; }}
                >
                    <Plus size={20} />
                    Expense
                </button>
            </div>

            {/* Modals */}
            {(editingExpense || isAddingExpense) && (
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
                            handleCloseExpenseForm();
                        }
                    }}
                >
                    <div style={{ marginTop: '2rem', marginBottom: '2rem', width: '100%', maxWidth: '800px' }}>
                        <ExpenseForm
                            onCancel={handleCloseExpenseForm}
                            onSuccess={handleCloseExpenseForm}
                            editingTransaction={editingExpense}
                        />
                    </div>
                </div>
            )}

            {(editingSettlement || isAddingSettlement) && (
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
                            handleCloseSettlementForm();
                        }
                    }}
                >
                    <div style={{ marginTop: '2rem', marginBottom: '2rem', width: '100%', maxWidth: '600px' }}>
                        <SettlementForm
                            onCancel={handleCloseSettlementForm}
                            onSuccess={handleCloseSettlementForm}
                            editingSettlement={editingSettlement}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
