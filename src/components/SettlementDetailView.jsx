import React from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { X, ArrowRight } from 'lucide-react';

export default function SettlementDetailView({ settlement, onClose }) {
    const { state } = useExpenses();

    const fromUser = state.users.find(u => u.id === settlement.from);
    const toUser = state.users.find(u => u.id === settlement.to);

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
        <div className="card" style={{ maxWidth: '500px', position: 'relative' }}>
            {/* Close Button */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    color: 'hsl(var(--color-text-muted))',
                    transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'hsl(var(--color-surface-dim))'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
                <X size={20} />
            </button>

            <h2 style={{ marginBottom: '1.5rem', color: 'hsl(var(--color-success))' }}>Settlement Details</h2>

            {/* From -> To Flow */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '2rem',
                padding: '1.5rem',
                background: 'hsl(var(--color-surface-dim))',
                borderRadius: 'var(--radius-md)'
            }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'hsl(var(--color-text-muted))', marginBottom: '0.25rem' }}>FROM</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'hsl(var(--color-danger))' }}>
                        {fromUser?.name || 'Unknown'}
                    </div>
                </div>

                <ArrowRight size={32} style={{ color: 'hsl(var(--color-text-muted))' }} />

                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'hsl(var(--color-text-muted))', marginBottom: '0.25rem' }}>TO</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'hsl(var(--color-success))' }}>
                        {toUser?.name || 'Unknown'}
                    </div>
                </div>
            </div>

            {/* Amount */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'hsl(var(--color-text-muted))', marginBottom: '0.5rem' }}>AMOUNT</div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: 'hsl(var(--color-success))' }}>
                    {formatCurrency(settlement.amount)}
                </div>
            </div>

            {/* Date & Time */}
            <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'hsl(var(--color-text-muted))', marginBottom: '0.5rem' }}>DATE & TIME</div>
                <div style={{ fontSize: '1rem', color: 'hsl(var(--color-text-main))' }}>
                    {formatDate(settlement.date)}
                </div>
            </div>
        </div>
    );
}
