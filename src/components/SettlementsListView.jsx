import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { ArrowRight, ArrowUpDown, Plus, Eye, Edit2, Search } from 'lucide-react';
import SettlementForm from './SettlementForm';

export default function SettlementsListView({ onViewSettlement }) {
    const { state } = useExpenses();
    const [sortBy, setSortBy] = useState('date-desc');
    const [showForm, setShowForm] = useState(false);
    const [editingSettlement, setEditingSettlement] = useState(null);
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

    const handleEdit = (settlement) => {
        setEditingSettlement(settlement);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingSettlement(null);
    };

    // Filter only settlements
    const settlements = state.transactions.filter(t => t.type === 'SETTLEMENT');

    // Apply search filter
    const filteredSettlements = settlements.filter(settlement => {
        if (!searchQuery) return true;

        const query = searchQuery.toLowerCase();
        const fromUser = getUserName(settlement.from).toLowerCase();
        const toUser = getUserName(settlement.to).toLowerCase();
        const amount = settlement.amount.toString();

        return fromUser.includes(query) || toUser.includes(query) || amount.includes(query);
    });

    // Sort settlements
    const sortedSettlements = [...filteredSettlements].sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                return new Date(b.date) - new Date(a.date);
            case 'date-asc':
                return new Date(a.date) - new Date(b.date);
            case 'amount-desc':
                return b.amount - a.amount;
            case 'amount-asc':
                return a.amount - b.amount;
            default:
                return 0;
        }
    });

    if (showForm) {
        return (
            <SettlementForm
                onCancel={handleFormClose}
                onSuccess={handleFormClose}
                editingSettlement={editingSettlement}
            />
        );
    }

    return (
        <div>
            {/* Header with Add Button */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Settlements</h2>
                <button
                    className="btn"
                    onClick={() => setShowForm(true)}
                    style={{
                        background: 'hsl(var(--color-success))',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Plus size={18} />
                    Record Settlement
                </button>
            </div>

            {settlements.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'hsl(var(--color-text-muted))', fontSize: '1.1rem', marginBottom: '1rem' }}>
                        No settlements recorded yet.
                    </p>
                    <button
                        className="btn"
                        onClick={() => setShowForm(true)}
                        style={{
                            background: 'hsl(var(--color-success))',
                            color: 'white',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Plus size={18} />
                        Record Your First Settlement
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
                        </select>

                        {/* Search Input */}
                        <div style={{ position: 'relative', flex: '1 1 250px', minWidth: '200px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--color-text-muted))' }} />
                            <input
                                type="text"
                                placeholder="Search settlements..."
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
                            {filteredSettlements.length} settlement{filteredSettlements.length !== 1 ? 's' : ''}
                            {searchQuery && filteredSettlements.length !== settlements.length && (
                                <span style={{ color: 'hsl(var(--color-accent))' }}> (filtered from {settlements.length})</span>
                            )}
                        </span>
                    </div>

                    {/* Settlements List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {sortedSettlements.map(settlement => (
                            <div key={settlement.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderLeft: '4px solid hsl(var(--color-success))' }}>

                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Payment</div>
                                    <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-muted))' }}>{formatDateTime(settlement.date)}</div>

                                    <div style={{ marginTop: '0.5rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ color: 'hsl(var(--color-danger))', fontWeight: '600' }}>
                                            {getUserName(settlement.from)}
                                        </span>
                                        <ArrowRight size={16} style={{ color: 'hsl(var(--color-text-muted))' }} />
                                        <span style={{ color: 'hsl(var(--color-success))', fontWeight: '600' }}>
                                            {getUserName(settlement.to)}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ fontWeight: '800', fontSize: '1.25rem' }}>
                                    {formatMoney(settlement.amount)}
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => onViewSettlement?.(settlement)}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid hsl(var(--color-text-muted) / 0.3)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '0.5rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'hsl(var(--color-text-main))',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'hsl(var(--color-primary) / 0.1)';
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-primary))';
                                            e.currentTarget.style.color = 'hsl(var(--color-primary))';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-text-muted) / 0.3)';
                                            e.currentTarget.style.color = 'hsl(var(--color-text-main))';
                                        }}
                                        title="View Details"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleEdit(settlement)}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid hsl(var(--color-text-muted) / 0.3)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '0.5rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'hsl(var(--color-text-main))',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'hsl(var(--color-accent) / 0.1)';
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-accent))';
                                            e.currentTarget.style.color = 'hsl(var(--color-accent))';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-text-muted) / 0.3)';
                                            e.currentTarget.style.color = 'hsl(var(--color-text-main))';
                                        }}
                                        title="Edit Settlement"
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
