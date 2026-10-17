import React, { useMemo } from 'react';
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
    const transactions = useMemo(() => {
        if (transactionsProp) return transactionsProp;
        return [...(state.transactions || [])].sort((a, b) => {
            const timeA = new Date(a.date || a.createdAt || 0).getTime();
            const timeB = new Date(b.date || b.createdAt || 0).getTime();
            if (timeB !== timeA) return timeB - timeA;
            const updA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const updB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return updB - updA;
        });
    }, [transactionsProp, state.transactions]);

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
                            padding: '0.9rem 1.1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.75rem',
                            width: '100%',
                            minWidth: 0,
                            borderLeft: `3px solid ${isSettlement ? 'hsl(var(--color-success))' : (group?.color || 'hsl(var(--color-accent))')}`
                        }}
                        onClick={handleClick}
                    >
                        {/* Left: Icon & Description */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--radius-md)',
                                background: isSettlement ? 'hsl(var(--color-success) / 0.12)' : 'hsl(var(--color-accent) / 0.12)',
                                color: isSettlement ? 'hsl(var(--color-success))' : 'hsl(var(--color-accent))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {isSettlement ? <HandCoins size={17} /> : <Receipt size={17} />}
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.15rem', minWidth: 0 }}>
                                    <span style={{
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        color: 'hsl(var(--color-text-main))',
                                        wordBreak: 'break-word',
                                        overflowWrap: 'anywhere'
                                    }}>
                                        {t.description}
                                    </span>
                                    {group && (
                                        <span style={{
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            padding: '0.1rem 0.45rem',
                                            borderRadius: 'var(--radius-full)',
                                            background: `${group.color || '#10b981'}15`,
                                            color: group.color || '#10b981',
                                            border: `1px solid ${group.color || '#10b981'}30`,
                                            flexShrink: 0
                                        }}>
                                            {group.name}
                                        </span>
                                    )}
                                </div>

                                <div style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', minWidth: 0 }}>
                                    <span>{formatDateTime(t.date)}</span>
                                    <span>•</span>
                                    {isSettlement ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                                            <strong>{getUserName(t.from)}</strong>
                                            <ArrowRight size={12} />
                                            <strong>{getUserName(t.to)}</strong>
                                        </span>
                                    ) : (
                                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{
                                    fontWeight: 800,
                                    fontSize: '1.15rem',
                                    color: isSettlement ? 'hsl(var(--color-success))' : 'hsl(var(--color-text-main))',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {formatMoney(t.amount)}
                                </div>
                                {showMemberShare && !isSettlement && (
                                    <div style={{ fontSize: '0.72rem', marginTop: '0.15rem', whiteSpace: 'nowrap' }}>
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
