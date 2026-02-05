import React, { useState, useEffect } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { CheckCircle2, Trash2 } from 'lucide-react';

export default function ExpenseForm({ onCancel, onSuccess, editingTransaction = null }) {
    const { state, addExpense, updateExpense, addUser, deleteTransaction } = useExpenses();
    const isEditing = !!editingTransaction;

    const [desc, setDesc] = useState(editingTransaction?.description || '');
    const [amount, setAmount] = useState(editingTransaction?.amount?.toString() || '');

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
        editingTransaction?.date
            ? formatDateTimeLocal(editingTransaction.date)
            : formatDateTimeLocal(new Date())
    );
    const [showSuccess, setShowSuccess] = useState(false);

    // SINGLE or MULTI payer
    const [payerMode, setPayerMode] = useState(
        editingTransaction?.payers?.length > 1 ? 'MULTI' : 'SINGLE'
    );
    const [singlePayer, setSinglePayer] = useState('');
    const [multiPayers, setMultiPayers] = useState({});

    const [splitMode, setSplitMode] = useState('EQUAL');
    const [splitSelected, setSplitSelected] = useState({}); // { userId: boolean }
    const [splitShares, setSplitShares] = useState({}); // { userId: number }
    const [splitAmounts, setSplitAmounts] = useState({}); // { userId: amount } for EXACT mode
    const [splitAmountsManual, setSplitAmountsManual] = useState({}); // { userId: boolean } tracks manual edits

    // Initialize selection
    useEffect(() => {
        if (state.users.length > 0) {
            const initialSelected = {};
            const initialShares = {};
            const initialMulti = {};
            const initialAmounts = {};

            state.users.forEach(u => {
                initialSelected[u.id] = true;
                initialShares[u.id] = 1;
                initialMulti[u.id] = '';
                initialAmounts[u.id] = '';
            });

            // If editing, populate from transaction
            if (editingTransaction) {
                editingTransaction.payers?.forEach(p => {
                    initialMulti[p.userId] = p.amount.toString();
                });

                editingTransaction.splits?.forEach(s => {
                    const share = editingTransaction.splits.find(sp => sp.userId === s.userId);
                    if (share) {
                        initialShares[s.userId] = share.amount;
                        initialAmounts[s.userId] = share.amount.toString();
                    }
                });

                // Mark only split users as selected
                state.users.forEach(u => {
                    initialSelected[u.id] = editingTransaction.splits?.some(s => s.userId === u.id) || false;
                });
            }

            setSinglePayer(editingTransaction?.payers?.[0]?.userId || state.users[0].id);
            setSplitSelected(initialSelected);
            setSplitShares(initialShares);
            setMultiPayers(initialMulti);
            setSplitAmounts(initialAmounts);
        }
    }, [state.users, editingTransaction]);

    const totalAmount = parseFloat(amount) || 0;

    // Sort users alphabetically
    const sortedUsers = [...state.users].sort((a, b) => a.name.localeCompare(b.name));

    // Validation Helpers
    const getPayers = () => {
        if (payerMode === 'SINGLE') {
            return [{ userId: singlePayer, amount: totalAmount }];
        }
        return state.users
            .map(u => ({ userId: u.id, amount: parseFloat(multiPayers[u.id]) || 0 }))
            .filter(p => p.amount > 0);
    };

    const getSplits = () => {
        const selectedUsers = sortedUsers.filter(u => splitSelected[u.id]);
        if (selectedUsers.length === 0) return [];

        if (splitMode === 'EQUAL') {
            const perUser = totalAmount / selectedUsers.length;
            return selectedUsers.map(u => ({ userId: u.id, amount: perUser }));
        } else if (splitMode === 'SHARES') {
            const totalShares = selectedUsers.reduce((sum, u) => sum + (parseFloat(splitShares[u.id]) || 0), 0);
            if (totalShares === 0) return [];
            return selectedUsers.map(u => ({
                userId: u.id,
                amount: (totalAmount * (parseFloat(splitShares[u.id]) || 0)) / totalShares
            }));
        } else if (splitMode === 'EXACT_AMOUNTS') {
            // Calculate total of manually entered amounts
            const manualTotal = selectedUsers.reduce((sum, u) => {
                if (splitAmountsManual[u.id]) {
                    return sum + (parseFloat(splitAmounts[u.id]) || 0);
                }
                return sum;
            }, 0);

            // Count non-manual entries
            const autoUsers = selectedUsers.filter(u => !splitAmountsManual[u.id]);
            const remaining = totalAmount - manualTotal;
            const perAutoUser = autoUsers.length > 0 ? remaining / autoUsers.length : 0;

            return selectedUsers.map(u => ({
                userId: u.id,
                amount: splitAmountsManual[u.id]
                    ? (parseFloat(splitAmounts[u.id]) || 0)
                    : perAutoUser
            }));
        }
        return [];
    };

    const currentPayerTotal = getPayers().reduce((sum, p) => sum + p.amount, 0);
    const isPayerValid = Math.abs(currentPayerTotal - totalAmount) < 0.05 && totalAmount > 0;

    const currentSplitTotal = getSplits().reduce((sum, s) => sum + s.amount, 0);
    const isSplitValid = Math.abs(currentSplitTotal - totalAmount) < 0.05 && totalAmount > 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isPayerValid && isSplitValid && desc) {
            if (isEditing) {
                updateExpense(editingTransaction.id, desc, amount, dateTime, getPayers(), getSplits());
                onSuccess(); // Redirect on edit
            } else {
                addExpense(desc, amount, dateTime, getPayers(), getSplits());

                // Show success message
                setShowSuccess(true);

                // Reset form
                setDesc('');
                setAmount('');
                setDateTime(new Date().toISOString().slice(0, 16));

                // Hide success message after 3 seconds
                setTimeout(() => setShowSuccess(false), 3000);
            }
        }
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
            deleteTransaction(editingTransaction.id);
            onSuccess();
        }
    };

    const toggleContainerStyle = { display: 'flex', background: 'hsl(var(--color-bg))', borderRadius: 'var(--radius-sm)', padding: '2px', gap: '2px' };
    const toggleBtnStyle = (isActive) => ({
        flex: 1,
        padding: '0.25rem 0.75rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.85rem',
        fontWeight: isActive ? 600 : 400,
        background: isActive ? 'hsl(var(--color-primary))' : 'transparent',
        color: isActive ? 'hsl(var(--color-text-inverted))' : 'hsl(var(--color-text-muted))',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all var(--transition-fast)'
    });

    return (
        <div className="card">
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Edit' : 'Add'} Expense</h2>

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
                    Expense added successfully!
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Description</span>
                        <input className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Dinner, Taxi..." required />
                    </label>
                    <label>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Amount ({state.currency})</span>
                        <input className="input" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
                    </label>
                </div>

                <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Date & Time</span>
                    <input className="input" type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} required />
                </label>

                <div style={{ padding: '1rem', border: '1px solid hsl(var(--color-text-muted) / 0.2)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: 600 }}>Who Paid?</span>
                        <div style={toggleContainerStyle}>
                            <div onClick={() => setPayerMode('SINGLE')} style={toggleBtnStyle(payerMode === 'SINGLE')}>Single</div>
                            <div onClick={() => setPayerMode('MULTI')} style={toggleBtnStyle(payerMode === 'MULTI')}>Multi</div>
                        </div>
                    </div>

                    {payerMode === 'SINGLE' && (
                        <select className="input" value={singlePayer} onChange={e => setSinglePayer(e.target.value)}>
                            {sortedUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    )}

                    {payerMode === 'MULTI' && (
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {sortedUsers.map(u => (
                                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ width: '100px', fontSize: '0.9rem' }}>{u.name}</span>
                                    <input
                                        className="input"
                                        type="number"
                                        step="0.01"
                                        value={multiPayers[u.id]}
                                        onChange={e => setMultiPayers({ ...multiPayers, [u.id]: e.target.value })}
                                        placeholder="0.00"
                                        style={{ padding: '0.4rem' }}
                                    />
                                </div>
                            ))}
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.5rem', color: isPayerValid ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))' }}>
                                Entered: {currentPayerTotal.toFixed(2)} / {totalAmount.toFixed(2)}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ padding: '1rem', border: '1px solid hsl(var(--color-text-muted) / 0.2)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: 600 }}>Split How?</span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    const allSelected = {};
                                    state.users.forEach(u => allSelected[u.id] = true);
                                    setSplitSelected(allSelected);
                                }}
                                style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    background: 'hsl(var(--color-success) / 0.1)',
                                    color: 'hsl(var(--color-success))',
                                    border: '1px solid hsl(var(--color-success) / 0.3)',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer'
                                }}
                            >
                                Select All
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const noneSelected = {};
                                    state.users.forEach(u => noneSelected[u.id] = false);
                                    setSplitSelected(noneSelected);
                                }}
                                style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    background: 'hsl(var(--color-danger) / 0.1)',
                                    color: 'hsl(var(--color-danger))',
                                    border: '1px solid hsl(var(--color-danger) / 0.3)',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer'
                                }}
                            >
                                Deselect All
                            </button>
                            <div style={toggleContainerStyle}>
                                <div onClick={() => setSplitMode('EQUAL')} style={toggleBtnStyle(splitMode === 'EQUAL')}>Equally</div>
                                <div onClick={() => setSplitMode('SHARES')} style={toggleBtnStyle(splitMode === 'SHARES')}>Shares</div>
                                <div onClick={() => setSplitMode('EXACT_AMOUNTS')} style={toggleBtnStyle(splitMode === 'EXACT_AMOUNTS')}>Amounts</div>
                            </div>
                        </div>
                    </div>

                    {sortedUsers.map(u => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', padding: '0.25rem 0' }}>
                            <input
                                type="checkbox"
                                checked={splitSelected[u.id] || false}
                                onChange={e => setSplitSelected({ ...splitSelected, [u.id]: e.target.checked })}
                                style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.75rem', cursor: 'pointer' }}
                            />
                            <span style={{ flex: 1, fontWeight: 500 }}>{u.name}</span>

                            {splitSelected[u.id] && splitMode === 'SHARES' && (
                                <input
                                    type="number"
                                    value={splitShares[u.id]}
                                    onChange={e => setSplitShares({ ...splitShares, [u.id]: e.target.value })}
                                    style={{ width: '60px', padding: '0.25rem', marginRight: '0.5rem' }}
                                    placeholder="Shares"
                                />
                            )}

                            {splitSelected[u.id] && splitMode === 'EXACT_AMOUNTS' && (
                                <input
                                    type="number"
                                    step="0.01"
                                    value={splitAmounts[u.id]}
                                    onChange={e => {
                                        setSplitAmounts({ ...splitAmounts, [u.id]: e.target.value });
                                        setSplitAmountsManual({ ...splitAmountsManual, [u.id]: true });
                                    }}
                                    style={{ width: '80px', padding: '0.25rem', marginRight: '0.5rem' }}
                                    placeholder="Auto"
                                />
                            )}

                            {splitSelected[u.id] && splitMode !== 'EXACT_AMOUNTS' && (
                                <span style={{ fontSize: '0.9rem', color: 'hsl(var(--color-text-muted))' }}>
                                    {(getSplits().find(s => s.userId === u.id)?.amount || 0).toFixed(2)}
                                </span>
                            )}

                            {splitSelected[u.id] && splitMode === 'EXACT_AMOUNTS' && !splitAmountsManual[u.id] && (
                                <span style={{ fontSize: '0.9rem', color: 'hsl(var(--color-success))', fontStyle: 'italic' }}>
                                    {(getSplits().find(s => s.userId === u.id)?.amount || 0).toFixed(2)}
                                </span>
                            )}
                        </div>
                    ))}

                    {/* Quick Add Member */}
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid hsl(var(--color-text-muted) / 0.1)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="Add new member..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const name = e.target.value.trim();
                                        if (name) {
                                            addUser(name);
                                            e.target.value = '';
                                        }
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    fontSize: '0.85rem',
                                    border: '1px solid hsl(var(--color-text-muted) / 0.2)',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'hsl(var(--color-surface-dim))',
                                    color: 'hsl(var(--color-text-main))'
                                }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))' }}>Press Enter</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            Delete Expense
                        </button>
                    )}
                    <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                        <button type="button" className="btn" onClick={onCancel} style={{ border: '1px solid hsl(var(--color-text-muted) / 0.3)' }}>Cancel</button>
                        <button
                            type="submit"
                            className="btn"
                            style={{ background: (!isPayerValid || !isSplitValid || !desc) ? 'hsl(var(--color-text-muted))' : 'hsl(var(--color-accent))', color: 'white', cursor: (!isPayerValid || !isSplitValid || !desc) ? 'not-allowed' : 'pointer' }}
                            disabled={!isPayerValid || !isSplitValid || !desc}
                        >
                            {isEditing ? 'Update' : 'Save'} Expense
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
