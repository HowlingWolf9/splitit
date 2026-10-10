import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { ArrowRight, Plus, Edit2, Search, HandCoins } from 'lucide-react';
import SettlementForm from './SettlementForm';

export default function SettlementsListView({ onViewSettlement }) {
    const { state, selectedGroupId, setSelectedGroupId, selectedGroup } = useExpenses();
    const [sortBy, setSortBy] = useState('date-desc');
    const [showForm, setShowForm] = useState(false);
    const [editingSettlement, setEditingSettlement] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const groupFilter = selectedGroupId === 'non-group' ? 'NON_GROUP' : (selectedGroupId || 'ALL');

    const handleGroupFilterChange = (e) => {
        const val = e.target.value;
        if (val === 'ALL') setSelectedGroupId(null);
        else if (val === 'NON_GROUP') setSelectedGroupId('non-group');
        else setSelectedGroupId(val);
    };

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

    const handleEdit = (e, settlement) => {
        e.stopPropagation();
        setEditingSettlement(settlement);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingSettlement(null);
    };

    // Filter only settlements, scoped to group
    const settlements = (state.transactions || []).filter(t => {
        if (t.type !== 'SETTLEMENT') return false;
        if (groupFilter === 'NON_GROUP') return !t.groupId || t.groupId === 'non-group';
        if (groupFilter !== 'ALL') return t.groupId === groupFilter;
        return true;
    });

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
            default:
                return 0;
        }
    });

    return (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
            {/* Header & Controls */}
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
                            Settlements {selectedGroup ? `— ${selectedGroup.name}` : ''}
                        </h2>
                        <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                            {filteredSettlements.length} {filteredSettlements.length === 1 ? 'settlement' : 'settlements'} recorded
                        </span>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
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
                            placeholder="Search by payer, receiver, or amount..."
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
                        </select>
                    </div>
                </div>
            </div>

            {/* List */}
            {sortedSettlements.length === 0 ? (
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
                        <HandCoins size={24} />
                    </div>
                    <p style={{ color: 'hsl(var(--color-text-main))', fontWeight: 600, fontSize: '1rem', margin: 0 }}>
                        {searchQuery ? 'No matching settlements found' : 'No settlements recorded yet'}
                    </p>
                    <p style={{ color: 'hsl(var(--color-text-muted))', fontSize: '0.85rem', margin: '0.35rem 0 1.25rem' }}>
                        {searchQuery ? 'Try adjusting your search query' : 'Record payments between group members to settle debts'}
                    </p>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowForm(true)}
                    >
                        <Plus size={16} />
                        Record Settlement
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {sortedSettlements.map(settlement => {
                        const group = (state.groups || []).find(g => g.id === settlement.groupId);
                        return (
                            <div
                                key={settlement.id}
                                className="card card-interactive"
                                style={{
                                    padding: '0.95rem 1.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderLeft: '3px solid hsl(var(--color-success))'
                                }}
                                onClick={() => onViewSettlement && onViewSettlement(settlement)}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.98rem' }}>
                                            {getUserName(settlement.from)}
                                        </span>
                                        <ArrowRight size={14} style={{ color: 'hsl(var(--color-text-muted))' }} />
                                        <span style={{ fontWeight: 700, fontSize: '0.98rem' }}>
                                            {getUserName(settlement.to)}
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
                                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))' }}>
                                        {formatDateTime(settlement.date)}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'hsl(var(--color-success))' }}>
                                        {formatMoney(settlement.amount)}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => handleEdit(e, settlement)}
                                        className="btn-icon"
                                        title="Edit settlement"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showForm && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) handleFormClose();
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <SettlementForm
                            editingSettlement={editingSettlement}
                            onCancel={handleFormClose}
                            onSuccess={handleFormClose}
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
                        setEditingSettlement(null);
                        setShowForm(true);
                    }}
                    title="Record Settlement"
                >
                    <Plus size={20} strokeWidth={2.5} />
                    <span>Record Settlement</span>
                </button>
            </div>
        </div>
    );
}
