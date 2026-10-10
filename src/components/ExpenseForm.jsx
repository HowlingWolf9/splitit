import React, { useState, useRef, useMemo } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { CheckCircle2, Trash2, Layers, Plus, Check, HandCoins } from 'lucide-react';
import PayerSelector from './PayerSelector';
import SplitSelector from './SplitSelector';

const getStorageItem = (key) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const setStorageItem = (key, val) => {
    try {
        localStorage.setItem(key, val);
        return true;
    } catch {
        return false;
    }
};

export default function ExpenseForm({ onCancel, onSuccess, editingTransaction = null, defaultGroupId = null }) {
    const { state, addExpense, updateExpense, addUser, deleteTransaction } = useExpenses();
    const isEditing = !!editingTransaction;
    const descInputRef = useRef(null);

    // Group Selection with memory
    const [selectedGroupId, setSelectedGroupId] = useState(() => {
        if (editingTransaction) return editingTransaction.groupId || '';
        if (defaultGroupId) return defaultGroupId;
        if (state.selectedGroupId && state.selectedGroupId !== 'non-group') return state.selectedGroupId;
        const saved = getStorageItem('splitit_last_expense_group');
        if (saved && (state.groups || []).some(g => g.id === saved)) return saved;
        return '';
    });
    const [showAllUsers, setShowAllUsers] = useState(false);

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

    const [dateTime, setDateTime] = useState(() => {
        if (editingTransaction?.date) return formatDateTimeLocal(editingTransaction.date);
        const saved = getStorageItem('splitit_last_expense_datetime');
        if (saved) return saved;
        return formatDateTimeLocal(new Date());
    });

    // Bulk Mode (default enabled when creating new expenses)
    const [bulkMode, setBulkMode] = useState(() => {
        if (editingTransaction) return false;
        const saved = getStorageItem('splitit_bulk_mode_expense');
        return saved !== null ? saved === 'true' : true;
    });

    const [batchCount, setBatchCount] = useState(0);
    const [recentAdded, setRecentAdded] = useState([]);
    const [showSuccess, setShowSuccess] = useState(false);

    // Determine available users based on selected group
    const activeGroup = (state.groups || []).find(g => g.id === selectedGroupId);
    const availableUsers = useMemo(() => {
        if (activeGroup && !showAllUsers) {
            return state.users.filter(u => activeGroup.members.includes(u.id));
        }
        return state.users;
    }, [activeGroup, showAllUsers, state.users]);

    const sortedUsers = useMemo(() => {
        return [...availableUsers].sort((a, b) => a.name.localeCompare(b.name));
    }, [availableUsers]);

    // Primary Collector (Optional)
    const [collectorId, setCollectorId] = useState(() => {
        if (editingTransaction?.collectorId) return editingTransaction.collectorId;
        const initialGrp = (state.groups || []).find(g => g.id === selectedGroupId);
        return initialGrp?.defaultCollectorId || '';
    });

    // SINGLE or MULTI payer
    const [payerMode, setPayerMode] = useState(() => {
        if (editingTransaction?.payers?.length > 1) return 'MULTI';
        const saved = getStorageItem('splitit_last_expense_payermode');
        if (saved) return saved;
        return 'SINGLE';
    });

    const [singlePayer, setSinglePayer] = useState(() => {
        if (editingTransaction?.payers?.[0]?.userId) return editingTransaction.payers[0].userId;
        const saved = getStorageItem('splitit_last_expense_singlepayer');
        if (saved && sortedUsers.some(u => u.id === saved)) return saved;
        return state.currentUserId || state.users[0]?.id || '';
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

    const [splitMode, setSplitMode] = useState(() => {
        const saved = getStorageItem('splitit_last_expense_splitmode');
        if (saved) return saved;
        return 'EQUAL';
    });

    const [splitSelected, setSplitSelected] = useState(() => {
        const initial = {};
        state.users.forEach(u => {
            if (editingTransaction) {
                initial[u.id] = editingTransaction.splits?.some(s => s.userId === u.id) || false;
            } else if (activeGroup) {
                initial[u.id] = activeGroup.members.includes(u.id);
            } else {
                initial[u.id] = true;
            }
        });
        return initial;
    });

    // When group changes, update split selection defaults
    const handleGroupChange = (newGroupId) => {
        setSelectedGroupId(newGroupId);
        setStorageItem('splitit_last_expense_group', newGroupId);

        const grp = (state.groups || []).find(g => g.id === newGroupId);
        if (grp) {
            const newSplit = {};
            state.users.forEach(u => {
                newSplit[u.id] = grp.members.includes(u.id);
            });
            setSplitSelected(newSplit);
            if (!grp.members.includes(singlePayer)) {
                setSinglePayer(grp.members[0] || state.users[0]?.id || '');
            }
            if (grp.defaultCollectorId && !isEditing) {
                setCollectorId(grp.defaultCollectorId);
            } else if (collectorId && !grp.members.includes(collectorId)) {
                setCollectorId('');
            }
        }
    };

    const [splitShares, setSplitShares] = useState(() => {
        const initial = {};
        state.users.forEach(u => {
            initial[u.id] = 1;
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

    const [splitAmountsManual, setSplitAmountsManual] = useState(() => {
        const initial = {};
        if (editingTransaction && editingTransaction.splits) {
            editingTransaction.splits.forEach(s => {
                initial[s.userId] = true;
            });
        }
        return initial;
    });

    const totalAmount = parseFloat(amount) || 0;

    const getPayers = () => {
        if (payerMode === 'SINGLE') {
            const payerId = singlePayer || sortedUsers[0]?.id || '';
            return [{ userId: payerId, amount: totalAmount }];
        }
        return sortedUsers
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
            const validShares = {};
            let totalShares = 0;
            selectedUsers.forEach(u => {
                const s = parseFloat(splitShares[u.id]);
                const val = (isNaN(s) || s < 0) ? 0 : s;
                validShares[u.id] = val;
                totalShares += val;
            });

            if (totalShares <= 0 || totalCents <= 0) {
                return selectedUsers.map(u => ({ userId: u.id, amount: 0 }));
            }

            const usersWithShares = selectedUsers.filter(u => validShares[u.id] > 0);
            let remainingCents = totalCents;

            return selectedUsers.map(u => {
                const share = validShares[u.id];
                if (share <= 0) {
                    return { userId: u.id, amount: 0 };
                }
                if (usersWithShares.length > 0 && u.id === usersWithShares[usersWithShares.length - 1].id) {
                    return { userId: u.id, amount: Math.max(0, remainingCents / 100) };
                }
                const userCents = Math.round((totalCents * share) / totalShares);
                remainingCents -= userCents;
                return { userId: u.id, amount: Math.max(0, userCents / 100) };
            });
        } else if (splitMode === 'EXACT_AMOUNTS') {
            const manualTotalCents = selectedUsers.reduce((sum, u) => {
                if (splitAmountsManual[u.id]) {
                    const parsed = parseFloat(splitAmounts[u.id]);
                    return sum + Math.round((Math.max(0, isNaN(parsed) ? 0 : parsed)) * 100);
                }
                return sum;
            }, 0);

            const autoUsers = selectedUsers.filter(u => !splitAmountsManual[u.id]);
            const remainingCents = totalCents - manualTotalCents;
            const perAutoUserCents = autoUsers.length > 0 && remainingCents > 0
                ? Math.floor(remainingCents / autoUsers.length)
                : 0;
            let autoRemainder = autoUsers.length > 0 && remainingCents > 0
                ? remainingCents % autoUsers.length
                : 0;

            return selectedUsers.map(u => {
                if (splitAmountsManual[u.id]) {
                    const parsed = parseFloat(splitAmounts[u.id]);
                    return { userId: u.id, amount: Math.max(0, isNaN(parsed) ? 0 : parsed) };
                }
                const extra = autoRemainder > 0 ? 1 : 0;
                autoRemainder -= extra;
                return { userId: u.id, amount: Math.max(0, (perAutoUserCents + extra) / 100) };
            });
        }
        return [];
    };

    const currentPayerTotalCents = getPayers().reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
    const totalAmountCents = Math.round(totalAmount * 100);
    const isPayerValid = currentPayerTotalCents === totalAmountCents && totalAmount > 0;

    const splitsList = getSplits();
    const currentSplitTotalCents = splitsList.reduce((sum, s) => sum + Math.round(s.amount * 100), 0);
    const allSplitsNonNegative = splitsList.length > 0 && splitsList.every(s => s.amount >= 0);
    const isSplitValid = currentSplitTotalCents === totalAmountCents && totalAmount > 0 && allSplitsNonNegative;

    const handleSave = (e, shouldClose = false) => {
        if (e && e.preventDefault) e.preventDefault();

        if (isPayerValid && isSplitValid && desc.trim()) {
            const groupId = selectedGroupId || null;

            if (isEditing) {
                updateExpense(editingTransaction.id, desc.trim(), amount, dateTime, getPayers(), getSplits(), groupId, collectorId || null);
                onSuccess();
                return;
            }

            // Add Expense
            addExpense(desc.trim(), amount, dateTime, getPayers(), getSplits(), groupId, collectorId || null);

            // Keep settings in memory for quick recall
            if (groupId) {
                setStorageItem('splitit_last_expense_group', groupId);
            }
            setStorageItem('splitit_last_expense_datetime', dateTime);
            setStorageItem('splitit_last_expense_payermode', payerMode);
            setStorageItem('splitit_last_expense_singlepayer', singlePayer);
            setStorageItem('splitit_last_expense_splitmode', splitMode);
            setStorageItem('splitit_bulk_mode_expense', String(bulkMode));

            setRecentAdded(prev => [
                { id: Date.now(), desc: desc.trim(), amount: totalAmount.toFixed(2) },
                ...prev.slice(0, 4)
            ]);
            setBatchCount(prev => prev + 1);
            setShowSuccess(true);
            setDesc('');
            setAmount('');

            if (shouldClose || !bulkMode) {
                onSuccess();
            } else {
                // Keep open: focus description input for next transaction
                setTimeout(() => {
                    descInputRef.current?.focus();
                }, 60);
            }
        }
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
            deleteTransaction(editingTransaction.id);
            onSuccess();
        }
    };

    const canSubmit = isPayerValid && isSplitValid && desc.trim().length > 0;

    return (
        <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
            {/* Header with Title and Bulk Mode Switch */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>
                        {isEditing ? 'Edit Expense' : 'Add Expense'}
                    </h2>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                        {isEditing
                            ? 'Modify expense details'
                            : bulkMode
                                ? 'Continuous entry enabled: keeps group, payer, splits & date intact'
                                : 'Record a new shared expense'}
                    </p>
                </div>

                {!isEditing && (
                    <label
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '0.35rem 0.65rem',
                            borderRadius: 'var(--radius-sm)',
                            background: bulkMode ? 'hsl(var(--color-accent) / 0.12)' : 'hsl(var(--color-surface-dim))',
                            border: `1px solid ${bulkMode ? 'hsl(var(--color-accent) / 0.35)' : 'hsl(var(--color-text-muted) / 0.2)'}`,
                            color: bulkMode ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))',
                            userSelect: 'none',
                            transition: 'all var(--transition-fast)'
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={bulkMode}
                            onChange={(e) => {
                                const val = e.target.checked;
                                setBulkMode(val);
                                setStorageItem('splitit_bulk_mode_expense', String(val));
                            }}
                            style={{ cursor: 'pointer', accentColor: 'hsl(var(--color-accent))' }}
                        />
                        <span>Keep open (Bulk Mode)</span>
                    </label>
                )}
            </div>

            {/* Success Message Banner */}
            {showSuccess && recentAdded.length > 0 && (
                <div style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'hsl(var(--color-success) / 0.12)',
                    border: '1px solid hsl(var(--color-success) / 0.4)',
                    color: 'hsl(var(--color-success))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.88rem',
                    fontWeight: '500',
                    animation: 'fadeIn 0.2s ease-in-out'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={18} />
                        <span>
                            Recorded <strong>"{recentAdded[0].desc}"</strong> ({state.currency}{recentAdded[0].amount})
                        </span>
                    </div>
                    {batchCount > 0 && (
                        <span style={{
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            background: 'hsl(var(--color-success) / 0.2)',
                            fontWeight: '700'
                        }}>
                            {batchCount} in batch
                        </span>
                    )}
                </div>
            )}

            {/* Recent items in this bulk session */}
            {!isEditing && batchCount > 1 && recentAdded.length > 0 && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.5rem 0.75rem',
                    background: 'hsl(var(--color-surface-dim))',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid hsl(var(--color-text-muted) / 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    fontSize: '0.78rem'
                }}>
                    <span style={{ color: 'hsl(var(--color-text-muted))', fontWeight: 600 }}>In this session:</span>
                    {recentAdded.slice(0, 3).map(item => (
                        <span
                            key={item.id}
                            style={{
                                background: 'hsl(var(--color-surface))',
                                border: '1px solid hsl(var(--color-text-muted) / 0.2)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-sm)',
                                color: 'hsl(var(--color-text-main))'
                            }}
                        >
                            {item.desc} ({state.currency}{item.amount})
                        </span>
                    ))}
                </div>
            )}

            <form onSubmit={(e) => handleSave(e, !bulkMode)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Group Selector */}
                <div style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'hsl(var(--color-surface-dim))',
                    border: '1px solid hsl(var(--color-text-muted) / 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Layers size={16} />
                            Choose Group
                        </label>
                        {activeGroup && (
                            <button
                                type="button"
                                onClick={() => setShowAllUsers(!showAllUsers)}
                                style={{ fontSize: '0.78rem', color: 'hsl(var(--color-accent))', fontWeight: 600 }}
                            >
                                {showAllUsers ? 'Limit to group members' : 'Include non-group members'}
                            </button>
                        )}
                    </div>
                    <select
                        className="input"
                        value={selectedGroupId}
                        onChange={(e) => handleGroupChange(e.target.value)}
                        style={{ background: 'hsl(var(--color-surface))' }}
                    >
                        <option value="">Non-group expense (Split directly)</option>
                        {(state.groups || []).map(g => (
                            <option key={g.id} value={g.id}>
                                👥 {g.name} ({g.members.length} members)
                            </option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Description</span>
                        <input
                            ref={descInputRef}
                            className="input"
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            placeholder="Dinner, Taxi..."
                            required
                            autoFocus
                        />
                    </label>
                    <label>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Amount ({state.currency})</span>
                        <input
                            className="input"
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                    </label>
                </div>

                <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Date & Time</span>
                    <input
                        className="input"
                        type="datetime-local"
                        value={dateTime}
                        onChange={e => {
                            setDateTime(e.target.value);
                            setStorageItem('splitit_last_expense_datetime', e.target.value);
                        }}
                        required
                    />
                </label>

                <PayerSelector
                    users={sortedUsers}
                    payerMode={payerMode} setPayerMode={setPayerMode}
                    singlePayer={singlePayer} setSinglePayer={setSinglePayer}
                    multiPayers={multiPayers} setMultiPayers={setMultiPayers}
                    totalAmount={totalAmount} currentPayerTotal={currentPayerTotalCents / 100} isPayerValid={isPayerValid}
                />

                {/* Primary Collector Selector */}
                <div style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'hsl(var(--color-surface-dim))',
                    border: '1px solid hsl(var(--color-text-muted) / 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.45rem' }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <HandCoins size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                                <span>Primary Collector (Optional)</span>
                            </label>
                            <div style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.15rem' }}>
                                Someone collecting payments on behalf of the payer. Members can settle with either the collector or the payer.
                            </div>
                        </div>
                        {collectorId && (
                            <button
                                type="button"
                                onClick={() => setCollectorId('')}
                                style={{ fontSize: '0.76rem', color: 'hsl(var(--color-text-muted))', background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <select
                        className="input"
                        value={collectorId}
                        onChange={(e) => setCollectorId(e.target.value)}
                        style={{ background: 'hsl(var(--color-surface))' }}
                    >
                        <option value="">None (Paid directly to Payer)</option>
                        {sortedUsers.map(u => (
                            <option key={u.id} value={u.id}>
                                {u.name} {u.id === activeGroup?.defaultCollectorId ? '⭐ (Group Default)' : ''} {u.id === state.currentUserId ? '(You)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <SplitSelector
                    users={sortedUsers}
                    getSplits={getSplits}
                    splitMode={splitMode}
                    setSplitMode={setSplitMode}
                    splitSelected={splitSelected}
                    setSplitSelected={setSplitSelected}
                    splitShares={splitShares}
                    setSplitShares={setSplitShares}
                    splitAmounts={splitAmounts}
                    setSplitAmounts={setSplitAmounts}
                    splitAmountsManual={splitAmountsManual}
                    setSplitAmountsManual={setSplitAmountsManual}
                    addUser={addUser}
                    totalAmount={totalAmount}
                    currency={state.currency}
                    isSplitValid={isSplitValid}
                />

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {isEditing ? (
                        <>
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
                            <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
                                <button type="button" className="btn" onClick={onCancel} style={{ border: '1px solid hsl(var(--color-text-muted) / 0.3)' }}>
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn"
                                    style={{
                                        background: !canSubmit ? 'hsl(var(--color-text-muted))' : 'hsl(var(--color-accent))',
                                        color: 'white',
                                        cursor: !canSubmit ? 'not-allowed' : 'pointer'
                                    }}
                                    disabled={!canSubmit}
                                >
                                    Update Expense
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="btn"
                                onClick={onCancel}
                                style={batchCount > 0 ? {
                                    background: 'hsl(var(--color-surface-dim))',
                                    border: '1px solid hsl(var(--color-accent) / 0.5)',
                                    color: 'hsl(var(--color-accent))',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                } : { border: '1px solid hsl(var(--color-text-muted) / 0.3)' }}
                            >
                                {batchCount > 0 ? (
                                    <>
                                        <Check size={16} />
                                        Done ({batchCount} added)
                                    </>
                                ) : (
                                    'Cancel'
                                )}
                            </button>

                            <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
                                {bulkMode && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleSave(e, true)}
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.88rem' }}
                                        disabled={!canSubmit}
                                        title="Save this expense and close the modal"
                                    >
                                        Save & Close
                                    </button>
                                )}

                                <button
                                    type="submit"
                                    className="btn"
                                    style={{
                                        background: !canSubmit ? 'hsl(var(--color-text-muted))' : 'hsl(var(--color-accent))',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        fontWeight: '600',
                                        cursor: !canSubmit ? 'not-allowed' : 'pointer'
                                    }}
                                    disabled={!canSubmit}
                                >
                                    {bulkMode ? (
                                        <>
                                            <Plus size={16} />
                                            Add & Next
                                        </>
                                    ) : (
                                        'Save Expense'
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </form>
        </div>
    );
}
