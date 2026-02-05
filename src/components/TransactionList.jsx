import React from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { ArrowRight, Edit2, Eye } from 'lucide-react';

export default function TransactionList({ onEditTransaction, onViewTransaction, transactions: transactionsProp, showMemberShare = false, memberName = '' }) {
    const { state, currencies } = useExpenses();
    const transactions = transactionsProp || state.transactions || [];

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
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    if (transactions.length === 0) {
        return <div style={{ color: '#888', fontStyle: 'italic', padding: '1rem' }}>No expenses recorded yet.</div>;
    }

    const getUserName = (id) => {
        const u = state.users.find(u => u.id === id);
        return u ? u.name : 'Unknown';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {transactions.map(t => (
                <div key={t.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${t.type === 'SETTLEMENT' ? 'hsl(var(--color-success))' : 'hsl(var(--color-primary))'}` }}>

                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.description}</div>
                        <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-muted))' }}>{formatDateTime(t.date)}</div>

                        <div style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
                            {t.type === 'SETTLEMENT' ? (
                                <span>
                                    {getUserName(t.from)} <ArrowRight size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {getUserName(t.to)}
                                </span>
                            ) : (
                                <span>
                                    {t.payers.length === 1 ? getUserName(t.payers[0].userId) : `${t.payers.length} people`} paid
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: '800', fontSize: '1.25rem' }}>
                                {formatMoney(t.amount)}
                            </div>
                            {showMemberShare && t.type === 'EXPENSE' && (
                                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.25rem' }}>
                                    {t.memberPaidAmount > 0 && (
                                        <div style={{ color: 'hsl(var(--color-success))' }}>
                                            Paid: {formatMoney(t.memberPaidAmount)}
                                        </div>
                                    )}
                                    {t.memberOwedAmount > 0 && (
                                        <div style={{ color: 'hsl(var(--color-danger))' }}>
                                            Owed: {formatMoney(t.memberOwedAmount)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {t.type === 'EXPENSE' && (
                            <>
                                <button
                                    onClick={() => onViewTransaction(t)}
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
                                    onClick={() => onEditTransaction(t)}
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
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
