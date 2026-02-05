import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { Users, ChevronRight, Search } from 'lucide-react';

export default function MembersView({ onSelectMember }) {
    const { state, getBalances, currencies } = useExpenses();
    const balances = getBalances();
    const users = state.users || [];
    const [searchQuery, setSearchQuery] = useState('');

    // Apply search filter
    const filteredUsers = users.filter(user => {
        if (!searchQuery) return true;
        return user.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const sortedUsers = [...filteredUsers].sort((a, b) => a.name.localeCompare(b.name));

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const getMemberStats = (userId) => {
        const transactions = state.transactions || [];
        const expenseCount = transactions.filter(t => {
            if (t.type === 'EXPENSE') {
                const isPayer = t.payers.some(p => p.userId === userId);
                const isSplit = t.splits.some(s => s.userId === userId);
                return isPayer || isSplit;
            }
            return false;
        }).length;

        return { expenseCount };
    };

    return (
        <div className="card">
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--color-text-muted) / 0.2)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={20} />
                    Members
                </div>

                {/* Search Input */}
                <div style={{ position: 'relative', flex: '1 1 250px', minWidth: '200px', maxWidth: '300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--color-text-muted))' }} />
                    <input
                        type="text"
                        placeholder="Search members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input"
                        style={{
                            paddingLeft: '2.5rem',
                            padding: '0.5rem 0.5rem 0.5rem 2.5rem'
                        }}
                    />
                </div>
            </h3>

            {sortedUsers.length === 0 && searchQuery ? (
                <div style={{ color: 'hsl(var(--color-text-muted))', fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>
                    No members found for "{searchQuery}"
                </div>
            ) : sortedUsers.length === 0 ? (
                <div style={{ color: 'hsl(var(--color-text-muted))', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>
                    No members yet. Add members to get started.
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {sortedUsers.map(user => {
                        const balance = balances[user.id] || 0;
                        const stats = getMemberStats(user.id);
                        const isPositive = balance > 0;
                        const isNegative = balance < 0;

                        return (
                            <div
                                key={user.id}
                                onClick={() => onSelectMember(user)}
                                style={{
                                    padding: '1.25rem',
                                    background: 'hsl(var(--color-bg))',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition-fast)',
                                    border: '2px solid transparent',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'hsl(var(--color-primary))';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'transparent';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                                        {user.name}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-muted))' }}>
                                        {stats.expenseCount} {stats.expenseCount === 1 ? 'expense' : 'expenses'}
                                    </div>
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.95rem', fontWeight: '600' }}>
                                        Balance: <span style={{
                                            color: isPositive ? 'hsl(var(--color-success))' : isNegative ? 'hsl(var(--color-danger))' : 'hsl(var(--color-text))'
                                        }}>
                                            {formatMoney(Math.abs(balance))}
                                        </span>
                                        {isPositive && <span style={{ fontSize: '0.85rem', marginLeft: '0.25rem', color: 'hsl(var(--color-success))' }}>is owed</span>}
                                        {isNegative && <span style={{ fontSize: '0.85rem', marginLeft: '0.25rem', color: 'hsl(var(--color-danger))' }}>owes</span>}
                                        {!isPositive && !isNegative && <span style={{ fontSize: '0.85rem', marginLeft: '0.25rem', color: 'hsl(var(--color-text-muted))' }}>settled</span>}
                                    </div>
                                </div>
                                <ChevronRight size={24} style={{ color: 'hsl(var(--color-text-muted))' }} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
