import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { X, User, Split, Edit2, HandCoins, CheckCircle2 } from 'lucide-react';

export default function ExpenseDetailView({ expense, onClose, onEdit }) {
    const { state, addSettlement } = useExpenses();
    const [settleSuccessMsg, setSettleSuccessMsg] = useState('');

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

    const group = (state.groups || []).find(g => g.id === expense.groupId);

    return (
        <div style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>{expense.description}</h2>
                        {group && (
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.55rem',
                                borderRadius: 'var(--radius-full)',
                                background: `${group.color || '#10b981'}20`,
                                color: group.color || '#10b981',
                                border: `1px solid ${group.color || '#10b981'}40`,
                            }}>
                                {group.name}
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                        {formatDateTime(expense.date)}
                    </span>
                </div>

                <button
                    onClick={onClose}
                    className="btn-icon"
                    title="Close"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Total Amount Box */}
            <div style={{
                background: 'hsl(var(--color-surface-dim))',
                padding: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid hsl(var(--color-border))',
                textAlign: 'center'
            }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--color-text-muted))', letterSpacing: '0.5px' }}>
                    Total Amount
                </span>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'hsl(var(--color-text-main))', marginTop: '0.2rem' }}>
                    {formatMoney(expense.amount)}
                </div>
            </div>

            {/* Who Paid */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem' }}>
                    <User size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                    <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Who Paid</span>
                </div>
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                    {expense.payers.map((payer, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                justifySelf: 'stretch',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.65rem 0.85rem',
                                background: 'hsl(var(--color-surface-dim))',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.88rem'
                            }}
                        >
                            <span style={{ fontWeight: 600 }}>{getUserName(payer.userId)}</span>
                            <span style={{ fontWeight: 700, color: 'hsl(var(--color-success))' }}>
                                {formatMoney(payer.amount)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Primary Collector (if assigned) */}
            {expense.collectorId && (
                <div style={{
                    padding: '0.85rem 1rem',
                    background: 'hsl(var(--color-surface-dim))',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid hsl(var(--color-accent) / 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'hsl(var(--color-accent) / 0.15)',
                            color: 'hsl(var(--color-accent))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <HandCoins size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'hsl(var(--color-text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Primary Collector
                            </div>
                            <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'hsl(var(--color-text-main))' }}>
                                {getUserName(expense.collectorId)}
                                {expense.collectorId === state.currentUserId && (
                                    <span style={{ fontSize: '0.78rem', color: 'hsl(var(--color-accent))', marginLeft: '0.35rem' }}>(You)</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <span style={{
                        fontSize: '0.74rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-full)',
                        background: 'hsl(var(--color-accent) / 0.12)',
                        color: 'hsl(var(--color-accent))',
                        fontWeight: 600
                    }}>
                        Collecting on behalf of payer
                    </span>
                </div>
            )}

            {/* Split Among */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem' }}>
                    <Split size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                    <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Split Among</span>
                </div>
                <div style={{ display: 'grid', gap: '0.4rem', maxHeight: '220px', overflowY: 'auto' }}>
                    {expense.splits.map((split, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.65rem 0.85rem',
                                background: 'hsl(var(--color-surface-dim))',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.88rem'
                            }}
                        >
                            <span style={{ fontWeight: 600 }}>
                                {getUserName(split.userId)}
                                {split.userId === state.currentUserId && (
                                    <span style={{ fontSize: '0.78rem', color: 'hsl(var(--color-accent))', marginLeft: '0.35rem' }}>(You)</span>
                                )}
                            </span>
                            <span style={{ fontWeight: 700, color: 'hsl(var(--color-danger))' }}>
                                {formatMoney(split.amount)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Smart Settle Prompt (When current user owes a split) */}
            {(() => {
                const mySplit = expense.splits?.find(s => s.userId === state.currentUserId);
                const amPayer = expense.payers?.some(p => p.userId === state.currentUserId);
                const singlePayerId = expense.payers?.length === 1 ? expense.payers[0].userId : null;
                const hasCollector = expense.collectorId && expense.collectorId !== state.currentUserId;
                const canSettle = mySplit && !amPayer && mySplit.amount > 0;

                if (!canSettle) return null;

                const handleQuickSettle = (targetUserId) => {
                    addSettlement(
                        state.currentUserId,
                        targetUserId,
                        mySplit.amount,
                        new Date().toISOString(),
                        expense.groupId || null
                    );
                    setSettleSuccessMsg(`Recorded ${formatMoney(mySplit.amount)} settlement with ${getUserName(targetUserId)}!`);
                };

                return (
                    <div style={{
                        padding: '1rem',
                        background: 'hsl(var(--color-surface-dim))',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid hsl(var(--color-accent) / 0.3)',
                        display: 'grid',
                        gap: '0.65rem'
                    }}>
                        {settleSuccessMsg ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: 'hsl(var(--color-success))',
                                fontWeight: 600,
                                fontSize: '0.88rem'
                            }}>
                                <CheckCircle2 size={18} />
                                <span>{settleSuccessMsg}</span>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--color-text-main))' }}>
                                        Your share: <span style={{ color: 'hsl(var(--color-danger))' }}>{formatMoney(mySplit.amount)}</span>
                                    </span>
                                    <span style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))' }}>
                                        Quick 1-Click Settle
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))', margin: 0 }}>
                                    {hasCollector
                                        ? `You can pay either the designated collector or the original payer directly.`
                                        : `Record your payment for this expense.`}
                                </p>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {hasCollector && (
                                        <button
                                            type="button"
                                            className="btn btn-sm"
                                            style={{
                                                background: 'hsl(var(--color-accent))',
                                                color: 'white',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.35rem'
                                            }}
                                            onClick={() => handleQuickSettle(expense.collectorId)}
                                        >
                                            <HandCoins size={14} />
                                            <span>Pay Collector ({getUserName(expense.collectorId)})</span>
                                        </button>
                                    )}
                                    {singlePayerId && singlePayerId !== expense.collectorId && (
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.35rem'
                                            }}
                                            onClick={() => handleQuickSettle(singlePayerId)}
                                        >
                                            <User size={14} />
                                            <span>Pay Payer ({getUserName(singlePayerId)})</span>
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                );
            })()}

            {/* Footer Action (Edit Expense) */}
            {onEdit && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid hsl(var(--color-border-subtle))' }}>
                    <button
                        type="button"
                        onClick={onEdit}
                        className="btn btn-secondary btn-sm"
                    >
                        <Edit2 size={15} />
                        <span>Edit Expense</span>
                    </button>
                </div>
            )}
        </div>
    );
}
