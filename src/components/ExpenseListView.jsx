import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { Edit2, Eye, ArrowUpDown, Plus, Search } from 'lucide-react';
import ExpenseForm from './ExpenseForm';

export default function ExpenseListView({ onEditTransaction, onViewTransaction }) {
    const { state } = useExpenses();
    const [sortBy, setSortBy] = useState('date-desc');
    const [showForm, setShowForm] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const formatDateTime = (dateStr) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    const getUserName = (id) => {
        const u = state.users.find(u => u.id === id);
        return u ? u.name : 'Unknown';
    };

    const handleEdit = (expense) => {
        setEditingTransaction(expense);
        setShowForm(true);
        onEditTransaction(expense);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingTransaction(null);
    };

    // Filter only expenses
    const expenses = (state.transactions || []).filter(t => t.type === 'EXPENSE');

    // Apply search filter
    const filteredExpenses = expenses.filter(expense => {
        if (!searchQuery) return true;

        const query = searchQuery.toLowerCase();
        const matchesDescription = expense.description.toLowerCase().includes(query);
        const matchesPayer = expense.payers.some(p =>
            getUserName(p.userId).toLowerCase().includes(query)
        );
        const matchesSplit = expense.splits.some(s =>
            getUserName(s.userId).toLowerCase().includes(query)
        );
        const matchesAmount = expense.amount.toString().includes(query);

        return matchesDescription || matchesPayer || matchesSplit || matchesAmount;
    });

    // Sort expenses
    const sortedExpenses = [...filteredExpenses].sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                return new Date(b.date) - new Date(a.date);
            case 'date-asc':
                return new Date(a.date) - new Date(b.date);
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

    if (showForm) {
        return (
            <ExpenseForm
                onCancel={handleCloseForm}
                onSuccess={handleCloseForm}
                editingTransaction={editingTransaction}
            />
        );
    }

    return (
        <div>
            {/* Header with Add Button */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Expenses</h2>
                <button
                    className="btn"
                    onClick={() => setShowForm(true)}
                    style={{
                        background: 'hsl(var(--color-accent))',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Plus size={18} />
                    Add Expense
                </button>
            </div>

            {expenses.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'hsl(var(--color-text-muted))', fontSize: '1.1rem', marginBottom: '1rem' }}>
                        No expenses yet. Add your first expense!
                    </p>
                    <button
                        className="btn"
                        onClick={() => setShowForm(true)}
                        style={{
                            background: 'hsl(var(--color-accent))',
                            color: 'white',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Plus size={18} />
                        Add Your First Expense
                    </button>
                </div>
            ) : (
                <>
                    {/* Sort Controls */}
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
                                placeholder="Search expenses..."
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
                            {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'}
                            {searchQuery && filteredExpenses.length !== expenses.length && (
                                <span style={{ color: 'hsl(var(--color-accent))' }}> (filtered from {expenses.length})</span>
                            )}
                        </span>
                    </div>

                    {/* Expense List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {sortedExpenses.map(expense => (
                            <div key={expense.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid hsl(var(--color-primary))' }}>

                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{expense.description}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-muted))' }}>{formatDateTime(expense.date)}</div>

                                    <div style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
                                        <span>
                                            {expense.payers.length === 1
                                                ? `Paid by ${getUserName(expense.payers[0].userId)}`
                                                : `Paid by ${expense.payers.length} people`}
                                        </span>
                                        <span style={{ margin: '0 0.5rem', color: 'hsl(var(--color-text-muted))' }}>•</span>
                                        <span>
                                            Split among {expense.splits.length} {expense.splits.length === 1 ? 'person' : 'people'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ fontWeight: '800', fontSize: '1.25rem' }}>
                                        {formatMoney(expense.amount)}
                                    </div>
                                    <button
                                        onClick={() => onViewTransaction(expense)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'hsl(var(--color-accent))',
                                            cursor: 'pointer',
                                            padding: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            borderRadius: 'var(--radius-sm)',
                                            transition: 'background var(--transition-fast)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'hsl(var(--color-bg))'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        title="View details"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleEdit(expense)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'hsl(var(--color-primary))',
                                            cursor: 'pointer',
                                            padding: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            borderRadius: 'var(--radius-sm)',
                                            transition: 'background var(--transition-fast)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'hsl(var(--color-bg))'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        title="Edit expense"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
