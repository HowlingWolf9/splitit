import React from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { X, ArrowRight, Edit2 } from 'lucide-react';

export default function SettlementDetailView({ settlement, onClose, onEdit }) {
    const { state } = useExpenses();

    const fromUser = state.users.find(u => u.id === settlement.from);
    const toUser = state.users.find(u => u.id === settlement.to);
    const group = (state.groups || []).find(g => g.id === settlement.groupId);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(amount);
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    };

    return (
        <div style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Settlement Details</h2>
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
                        {formatDate(settlement.date)}
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

            {/* From -> To Flow */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem',
                background: 'hsl(var(--color-surface-dim))',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid hsl(var(--color-border))',
                gap: '1rem'
            }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'hsl(var(--color-text-muted))', textTransform: 'uppercase' }}>
                        Payer (From)
                    </span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'hsl(var(--color-danger))', marginTop: '0.2rem' }}>
                        {fromUser?.name || 'Unknown'}
                    </div>
                </div>

                <ArrowRight size={24} style={{ color: 'hsl(var(--color-text-subtle))', flexShrink: 0 }} />

                <div style={{ flex: 1, textAlign: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'hsl(var(--color-text-muted))', textTransform: 'uppercase' }}>
                        Recipient (To)
                    </span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'hsl(var(--color-success))', marginTop: '0.2rem' }}>
                        {toUser?.name || 'Unknown'}
                    </div>
                </div>
            </div>

            {/* Amount */}
            <div style={{
                background: 'hsl(var(--color-surface-dim))',
                padding: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid hsl(var(--color-border))',
                textAlign: 'center'
            }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--color-text-muted))', letterSpacing: '0.5px' }}>
                    Settled Amount
                </span>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'hsl(var(--color-success))', marginTop: '0.2rem' }}>
                    {formatCurrency(settlement.amount)}
                </div>
            </div>

            {/* Footer */}
            {onEdit && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid hsl(var(--color-border-subtle))' }}>
                    <button
                        type="button"
                        onClick={onEdit}
                        className="btn btn-secondary btn-sm"
                    >
                        <Edit2 size={15} />
                        <span>Edit Settlement</span>
                    </button>
                </div>
            )}
        </div>
    );
}
