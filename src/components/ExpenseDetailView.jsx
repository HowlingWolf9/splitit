import React from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { X, User, Users, Split } from 'lucide-react';

export default function ExpenseDetailView({ expense, onClose }) {
    const { state } = useExpenses();

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
                month: 'long',
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

    return (
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ marginBottom: '0.25rem' }}>{expense.description}</h2>
                    <p style={{ fontSize: '0.9rem', color: 'hsl(var(--color-text-muted))' }}>{formatDateTime(expense.date)}</p>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        color: 'hsl(var(--color-text-muted))'
                    }}
                >
                    <X size={24} />
                </button>
            </div>

            {/* Total Amount */}
            <div style={{
                background: 'hsl(var(--color-primary) / 0.1)',
                padding: '1.5rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '0.9rem', color: 'hsl(var(--color-text-muted))', marginBottom: '0.25rem' }}>Total Amount</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'hsl(var(--color-primary))' }}>
                    {formatMoney(expense.amount)}
                </div>
            </div>

            {/* Payers Section */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <User size={18} />
                    Who Paid
                </h3>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    {expense.payers.map((payer, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '0.75rem',
                                background: 'hsl(var(--color-bg))',
                                borderRadius: 'var(--radius-sm)'
                            }}
                        >
                            <span style={{ fontWeight: 500 }}>{getUserName(payer.userId)}</span>
                            <span style={{ fontWeight: 600 }}>{formatMoney(payer.amount)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Splits Section */}
            <div>
                <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <Split size={18} />
                    Split Among
                </h3>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    {expense.splits.map((split, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '0.75rem',
                                background: 'hsl(var(--color-bg))',
                                borderRadius: 'var(--radius-sm)'
                            }}
                        >
                            <span style={{ fontWeight: 500 }}>{getUserName(split.userId)}</span>
                            <span style={{ fontWeight: 600, color: 'hsl(var(--color-danger))' }}>
                                {formatMoney(split.amount)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Close Button */}
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button
                    className="btn"
                    onClick={onClose}
                >
                    Close
                </button>
            </div>
        </div>
    );
}
