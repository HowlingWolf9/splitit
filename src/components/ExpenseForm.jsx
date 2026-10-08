import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { CheckCircle2, Trash2 } from 'lucide-react';
import PayerSelector from './PayerSelector';
import SplitSelector from './SplitSelector';

export default function ExpenseForm({ onCancel, onSuccess, editingTransaction = null }) {
    const { state, addExpense, updateExpense, addUser, deleteTransaction } = useExpenses();
    const isEditing = !!editingTransaction;

    const [desc, setDesc] = useState(editingTransaction?.description || '');
    const [amount, setAmount] = useState(editingTransaction?.amount?.toString() || '');

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
    const [singlePayer, setSinglePayer] = useState(() => {
        return editingTransaction?.payers?.[0]?.userId || state.users[0]?.id || '';
    });
    const [multiPayers, setMultiPayers] = useState(() => {
        const initial = {};
        state.users.forEach(u => {
            if (editingTransaction) {
                const payer = editingTransaction.payers?.find(p => p.userId === u.id);
                initial[u.id] = payer ? payer.amount.toString() : '';
            } else {
                initial[u.id] = '';
            }
        });
        return initial;
    });

    const [splitMode, setSplitMode] = useState('EQUAL');
    const [splitSelected, setSplitSelected] = useState(() => {
        const initial = {};
        state.users.forEach(u => {
            initial[u.id] = editingTransaction
                ? (editingTransaction.splits?.some(s => s.userId === u.id) || false)
                : true;
        });
        return initial;
    });
    const [splitShares, setSplitShares] = useState(() => {
        const initial = {};
        state.users.forEach(u => {
            if (editingTransaction) {
                const share = editingTransaction.splits?.find(sp => sp.userId === u.id);
                initial[u.id] = share ? share.amount : 1;
            } else {
                initial[u.id] = 1;
            }
        });
        return initial;
    });
    const [splitAmounts, setSplitAmounts] = useState(() => {
        const initial = {};
        state.users.forEach(u => {
            if (editingTransaction) {
                const share = editingTransaction.splits?.find(sp => sp.userId === u.id);
                initial[u.id] = share ? share.amount.toString() : '';
            } else {
                initial[u.id] = '';
            }
        });
        return initial;
    });
    const [splitAmountsManual, setSplitAmountsManual] = useState({});

    const totalAmount = parseFloat(amount) || 0;
    const sortedUsers = [...state.users].sort((a, b) => a.name.localeCompare(b.name));

    const getPayers = () => {
        if (payerMode === 'SINGLE') {
            const payerId = singlePayer || state.users[0]?.id || '';
            return [{ userId: payerId, amount: totalAmount }];
        }
        return state.users
            .map(u => ({ userId: u.id, amount: parseFloat(multiPayers[u.id]) || 0 }))
            .filter(p => p.amount > 0);
    };

    const getSplits = () => {
        const selectedUsers = sortedUsers.filter(u => splitSelected[u.id] !== undefined ? splitSelected[u.id] : true);
        if (selectedUsers.length === 0) return [];
        
        const totalCents = Math.round(totalAmount * 100);

        if (splitMode === 'EQUAL') {
            const perUserCents = Math.floor(totalCents / selectedUsers.length);
            let remainder = totalCents % selectedUsers.length;
            
            return selectedUsers.map(u => {
                const extra = remainder > 0 ? 1 : 0;
                remainder -= extra;
                return { userId: u.id, amount: (perUserCents + extra) / 100 };
            });
        } else if (splitMode === 'SHARES') {
            const totalShares = selectedUsers.reduce((sum, u) => sum + (parseFloat(splitShares[u.id]) || 0), 0);
            if (totalShares === 0) return [];
            
            let remainingCents = totalCents;
            return selectedUsers.map((u, i) => {
                if (i === selectedUsers.length - 1) {
                    return { userId: u.id, amount: remainingCents / 100 };
                }
                const share = parseFloat(splitShares[u.id]) || 0;
                const userCents = Math.round((totalCents * share) / totalShares);
                remainingCents -= userCents;
                return { userId: u.id, amount: userCents / 100 };
            });
        } else if (splitMode === 'EXACT_AMOUNTS') {
            const manualTotalCents = selectedUsers.reduce((sum, u) => {
                if (splitAmountsManual[u.id]) {
                    return sum + Math.round((parseFloat(splitAmounts[u.id]) || 0) * 100);
                }
                return sum;
            }, 0);

            const autoUsers = selectedUsers.filter(u => !splitAmountsManual[u.id]);
            const remainingCents = totalCents - manualTotalCents;
            const perAutoUserCents = autoUsers.length > 0 ? Math.floor(remainingCents / autoUsers.length) : 0;
            let autoRemainder = autoUsers.length > 0 ? remainingCents % autoUsers.length : 0;

            return selectedUsers.map(u => {
                if (splitAmountsManual[u.id]) {
                    return { userId: u.id, amount: parseFloat(splitAmounts[u.id]) || 0 };
                }
                const extra = autoRemainder > 0 ? 1 : 0;
                autoRemainder -= extra;
                return { userId: u.id, amount: (perAutoUserCents + extra) / 100 };
            });
        }
        return [];
    };

    const currentPayerTotalCents = getPayers().reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
    const totalAmountCents = Math.round(totalAmount * 100);
    const isPayerValid = currentPayerTotalCents === totalAmountCents && totalAmount > 0;

    const currentSplitTotalCents = getSplits().reduce((sum, s) => sum + Math.round(s.amount * 100), 0);
    const isSplitValid = currentSplitTotalCents === totalAmountCents && totalAmount > 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isPayerValid && isSplitValid && desc) {
            if (isEditing) {
                updateExpense(editingTransaction.id, desc, amount, dateTime, getPayers(), getSplits());
                onSuccess();
            } else {
                addExpense(desc, amount, dateTime, getPayers(), getSplits());
                setShowSuccess(true);
                setDesc('');
                setAmount('');
                setDateTime(new Date().toISOString().slice(0, 16));
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

    return (
        <div className="card">
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Edit' : 'Add'} Expense</h2>

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

                <PayerSelector 
                    users={sortedUsers}
                    payerMode={payerMode} setPayerMode={setPayerMode}
                    singlePayer={singlePayer} setSinglePayer={setSinglePayer}
                    multiPayers={multiPayers} setMultiPayers={setMultiPayers}
                    totalAmount={totalAmount} currentPayerTotal={currentPayerTotalCents / 100} isPayerValid={isPayerValid}
                />

                <SplitSelector 
                    users={sortedUsers} getSplits={getSplits}
                    splitMode={splitMode} setSplitMode={setSplitMode}
                    splitSelected={splitSelected} setSplitSelected={setSplitSelected}
                    splitShares={splitShares} setSplitShares={setSplitShares}
                    splitAmounts={splitAmounts} setSplitAmounts={setSplitAmounts}
                    splitAmountsManual={splitAmountsManual} setSplitAmountsManual={setSplitAmountsManual}
                    addUser={addUser}
                />

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
