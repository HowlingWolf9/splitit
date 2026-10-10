import React from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { ArrowRight, Edit2, Receipt, HandCoins } from 'lucide-react';

export default function TransactionList({
    onEditTransaction,
    onViewTransaction,
    onEditSettlement,
    onViewSettlement,
    transactions: transactionsProp,
    showMemberShare = false
}) {
    const { state } = useExpenses();
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
        return (
            <div style={{ color: 'hsl(var(--color-text-muted))', textAlign: 'center', padding: '2rem 1rem', fontSize: '0.9rem' }}>
                No recent activity to display.
            </div>
        );
    }

    const getUserName = (id) => {
        const u = state.users.find(u => u.id === id);
        return u ? u.name : 'Unknown';
    };

    return (
        <div style={{ display: 'grid', gap: '0.65rem' }}>
            {transactions.map(t => {
                const isSettlement = t.type === 'SETTLEMENT';
                const group = (state.groups || []).find(g => g.id === t.groupId);

                const handleClick = () => {
                    if (isSettlement && onViewSettlement) {
                        onViewSettlement(t);
                    } else if (!isSettlement && onViewTransaction) {
                        onViewTransaction(t);
                    }
                };

                const handleEditClick = (e) => {
                    e.stopPropagation();
                    if (isSettlement && onEditSettlement) {
                        onEditSettlement(t);
                    } else if (!isSettlement && onEditTransaction) {
                        onEditTransaction(t);
                    }
                };

                return (
                    <div
                        key={t.id}
                        className="card card-interactive"
                        style={{
                            padding: '0.95rem 1.25rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '1rem',
                            borderLeft: `3px solid ${isSettlement ? 'hsl(var(--color-success))' : (group?.color || 'hsl(var(--color-accent))')}`
                        }}
                        onClick={handleClick}
                    >
                        {/* Left: Icon & Description */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                            <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: 'var(--radius-md)',
                                background: isSettlement ? 'hsl(var(--color-success) / 0.12)' : 'hsl(var(--color-accent) / 0.12)',
                                color: isSettlement ? 'hsl(var(--color-success))' : 'hsl(var(--color-accent))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {isSettlement ? <HandCoins size={18} /> : <Receipt size={18} />}
                            </div>

                            <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.15rem' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.96rem', color: 'hsl(var(--color-text-main))' }}>
                                        {t.description}
                                    </span>
                                    {group && (
                                        <span style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            padding: '0.1rem 0.5rem',
                                            borderRadius: 'var(--radius-full)',
                                            background: `${group.color || '#10b981'}15`,
                                            color: group.color || '#10b981',
                                            border: `1px solid ${group.color || '#10b981'}30`,
                                        }}>
                                            {group.name}
                                        </span>
                                    )}
                                </div>

                                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                    <span>{formatDateTime(t.date)}</span>
                                    <span>•</span>
                                    {isSettlement ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <strong>{getUserName(t.from)}</strong>
                                            <ArrowRight size={12} />
                                            <strong>{getUserName(t.to)}</strong>
                                        </span>
                                    ) : (
                                        <span>
                                            {t.payers.length === 1 ? `Paid by ${getUserName(t.payers[0].userId)}` : `${t.payers.length} payers`}
                                            {t.collectorId && (
                                                <span style={{ marginLeft: '0.35rem', color: 'hsl(var(--color-accent))', fontWeight: 600 }}>
                                                    • Collector: {getUserName(t.collectorId)}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Amount & Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{
                                    fontWeight: 800,
                                    fontSize: '1.2rem',
                                    color: isSettlement ? 'hsl(var(--color-success))' : 'hsl(var(--color-text-main))'
                                }}>
                                    {formatMoney(t.amount)}
                                </div>
                                {showMemberShare && !isSettlement && (
                                    <div style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                                        {t.memberPaidAmount > 0 && (
                                            <span style={{ color: 'hsl(var(--color-success))', marginRight: '0.4rem' }}>
                                                Paid: {formatMoney(t.memberPaidAmount)}
                                            </span>
                                        )}
                                        {t.memberOwedAmount > 0 && (
                                            <span style={{ color: 'hsl(var(--color-danger))' }}>
                                                Owes: {formatMoney(t.memberOwedAmount)}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {(onEditTransaction || onEditSettlement) && (
                                <button
                                    type="button"
                                    onClick={handleEditClick}
                                    className="btn-icon"
                                    title="Edit"
                                >
                                    <Edit2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
