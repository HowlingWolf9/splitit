import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { Edit2, Eye, ArrowUpDown, Plus, Search, Receipt } from 'lucide-react';
import ExpenseForm from './ExpenseForm';

export default function ExpenseListView({ onEditTransaction, onViewTransaction }) {
    const { state, selectedGroupId, setSelectedGroupId, selectedGroup } = useExpenses();
    const [sortBy, setSortBy] = useState('date-desc');
    const [showForm, setShowForm] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const groupFilter = selectedGroupId === 'non-group' ? 'NON_GROUP' : (selectedGroupId || 'ALL');

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

    const handleEdit = (e, expense) => {
        e.stopPropagation();
        if (onEditTransaction) {
            onEditTransaction(expense);
        } else {
            setEditingTransaction(expense);
            setShowForm(true);
        }
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingTransaction(null);
    };

    const handleGroupFilterChange = (e) => {
        const val = e.target.value;
        if (val === 'ALL') setSelectedGroupId(null);
        else if (val === 'NON_GROUP') setSelectedGroupId('non-group');
        else setSelectedGroupId(val);
    };

    // Filter only expenses
    const expenses = (state.transactions || []).filter(t => t.type === 'EXPENSE');

    // Apply group & search filter
    const filteredExpenses = expenses.filter(expense => {
        if (groupFilter === 'NON_GROUP') {
            if (expense.groupId) return false;
        } else if (groupFilter !== 'ALL') {
            if (expense.groupId !== groupFilter) return false;
        }

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
        const matchesCollector = expense.collectorId && getUserName(expense.collectorId).toLowerCase().includes(query);

        return matchesDescription || matchesPayer || matchesSplit || matchesAmount || matchesCollector;
    });

    // Sort expenses
    const sortedExpenses = [...filteredExpenses].sort((a, b) => {
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
                            Expenses {selectedGroup ? `— ${selectedGroup.name}` : ''}
                        </h2>
                        <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                            {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'} tracked
                        </span>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
                        <Search size={15} style={{
                            position: 'absolute',
                            left: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'hsl(var(--color-text-muted))'
                        }} />
                        <input
                            type="text"
                            placeholder="Search by description or person..."
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

                    {/* Group Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <select
                            className="input"
                            value={groupFilter}
                            onChange={handleGroupFilterChange}
                            style={{ maxWidth: '170px', padding: '0.45rem 0.65rem', fontSize: '0.84rem' }}
                        >
                            <option value="ALL">All Groups</option>
                            <option value="NON_GROUP">Non-group</option>
                            {(state.groups || []).map(g => (
                                <option key={g.id} value={g.id}>👥 {g.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Sort Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <select
                            className="input"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ maxWidth: '150px', padding: '0.45rem 0.65rem', fontSize: '0.84rem' }}
                        >
                            <option value="date-desc">Newest First</option>
                            <option value="date-asc">Oldest First</option>
                            <option value="amount-desc">Highest Amount</option>
                            <option value="amount-asc">Lowest Amount</option>
                            <option value="desc-asc">Title A-Z</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Expenses List */}
            {sortedExpenses.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
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
                        <Receipt size={24} />
                    </div>
                    <p style={{ color: 'hsl(var(--color-text-main))', fontWeight: 600, fontSize: '1rem', margin: 0 }}>
                        {searchQuery ? 'No matching expenses found' : 'No expenses recorded yet'}
                    </p>
                    <p style={{ color: 'hsl(var(--color-text-muted))', fontSize: '0.85rem', margin: '0.35rem 0 1.25rem' }}>
                        {searchQuery ? 'Try adjusting your search terms or group filter' : 'Track group dining, bills, trips, and shared purchases'}
                    </p>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowForm(true)}
                    >
                        <Plus size={16} />
                        Add First Expense
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {sortedExpenses.map(expense => {
                        const group = (state.groups || []).find(g => g.id === expense.groupId);
                        return (
                            <div
                                key={expense.id}
                                className="card card-interactive"
                                style={{
                                    padding: '0.95rem 1.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderLeft: `3px solid ${group ? (group.color || 'hsl(var(--color-accent))') : 'hsl(var(--color-accent))'}`
                                }}
                                onClick={() => onViewTransaction && onViewTransaction(expense)}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.15rem' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'hsl(var(--color-text-main))' }}>
                                            {expense.description}
                                        </span>
                                        {group && (
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                padding: '0.1rem 0.5rem',
                                                borderRadius: 'var(--radius-full)',
                                                background: `${group.color || '#10b981'}18`,
                                                color: group.color || '#10b981',
                                                border: `1px solid ${group.color || '#10b981'}30`,
                                            }}>
                                                {group.name}
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span>{formatDateTime(expense.date)}</span>
                                        <span>•</span>
                                        <span>
                                            {expense.payers.length === 1
                                                ? `Paid by ${getUserName(expense.payers[0].userId)}`
                                                : `Paid by ${expense.payers.length} people`}
                                        </span>
                                        <span>•</span>
                                        <span>Split among {expense.splits.length}</span>
                                        {expense.collectorId && (
                                            <>
                                                <span>•</span>
                                                <span style={{ color: 'hsl(var(--color-accent))', fontWeight: 600 }}>
                                                    Collector: {getUserName(expense.collectorId)}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'hsl(var(--color-text-main))' }}>
                                        {formatMoney(expense.amount)}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => handleEdit(e, expense)}
                                        className="btn-icon"
                                        title="Edit expense"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Quick Add Form Modal */}
            {showForm && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) handleCloseForm();
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '800px' }}>
                        <ExpenseForm
                            onCancel={handleCloseForm}
                            onSuccess={handleCloseForm}
                            editingTransaction={editingTransaction}
                            defaultGroupId={selectedGroupId === 'non-group' ? null : selectedGroupId}
                        />
                    </div>
                </div>
            )}

            {/* Floating Action Button */}
            <div className="fab-container">
                <button
                    type="button"
                    className="fab fab-primary"
                    onClick={() => {
                        setEditingTransaction(null);
                        setShowForm(true);
                    }}
                    title="Add Expense"
                >
                    <Plus size={20} strokeWidth={2.5} />
                    <span>Add Expense</span>
                </button>
            </div>
        </div>
    );
}
