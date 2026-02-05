import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { ArrowRight, CheckCircle2, Trash2 } from 'lucide-react';

export default function SettlementForm({ onCancel, onSuccess, editingSettlement = null }) {
    const { state, addSettlement, updateSettlement, deleteTransaction } = useExpenses();
    const isEditing = !!editingSettlement;

    const [payer, setPayer] = useState(editingSettlement?.from || state.users[0]?.id || '');
    const [receiver, setReceiver] = useState(editingSettlement?.to || state.users[1]?.id || '');
    const [amount, setAmount] = useState(editingSettlement?.amount?.toString() || '');

    // Helper function to format date for datetime-local input (preserves local timezone)
    const formatDateTimeLocal = (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const [dateTime, setDateTime] = useState(
        editingSettlement?.date
            ? formatDateTimeLocal(editingSettlement.date)
            : formatDateTimeLocal(new Date())
    );
    const [showSuccess, setShowSuccess] = useState(false);

    const sortedUsers = [...state.users].sort((a, b) => a.name.localeCompare(b.name));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (payer && receiver && amount && payer !== receiver) {
            if (isEditing) {
                // Update existing settlement
                updateSettlement(editingSettlement.id, payer, receiver, amount, dateTime);
                onSuccess();
            } else {
                // Add new settlement
                addSettlement(payer, receiver, amount, dateTime);
                // Show success and reset only amount
                setShowSuccess(true);
                setAmount('');
                // Keep date, payer, and receiver the same for convenience

                // Hide success message after 3 seconds
                setTimeout(() => setShowSuccess(false), 3000);
            }
        }
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this settlement? This action cannot be undone.')) {
            deleteTransaction(editingSettlement.id);
            onSuccess();
        }
    };

    return (
        <div className="card" style={{ border: '1px solid hsl(var(--color-success) / 0.5)' }}>
            <h2 style={{ color: 'hsl(var(--color-success))', marginBottom: '1rem' }}>
                {isEditing ? 'Edit Payment' : 'Record Payment'}
            </h2>

            {/* Success Message */}
            {showSuccess && (
                <div style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'hsl(var(--color-success) / 0.1)',
                    border: '1px solid hsl(var(--color-success) / 0.3)',
                    color: 'hsl(var(--color-success))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                }}>
                    <CheckCircle2 size={18} />
                    Settlement recorded successfully!
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>From</label>
                        <select className="input" value={payer} onChange={e => setPayer(e.target.value)}>
                            {sortedUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>

                    <ArrowRight style={{ marginTop: '1.2rem', color: '#ccc' }} />

                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>To</label>
                        <select className="input" value={receiver} onChange={e => setReceiver(e.target.value)}>
                            {sortedUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                </div>

                <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Amount ({state.currency})</span>
                    <input className="input" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
                </label>

                <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Date & Time</span>
                    <input className="input" type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} required />
                </label>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    {isEditing && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            style={{
                                background: 'hsl(var(--color-danger))',
                                color: 'white',
                                padding: '0.75rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'opacity var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                            <Trash2 size={18} />
                            Delete Settlement
                        </button>
                    )}
                    <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
                        <button type="submit" className="btn" style={{ background: 'hsl(var(--color-success))', color: 'white' }}>
                            {isEditing ? 'Update' : 'Record'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
