import React, { useState, useRef, useMemo } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { CheckCircle2, Trash2, Layers, ArrowLeftRight, Plus, Check } from 'lucide-react';

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

export default function SettlementForm({ onCancel, onSuccess, editingSettlement = null, defaultGroupId = null, defaultFrom = null, defaultTo = null, defaultAmount = null }) {
    const { state, addSettlement, updateSettlement, deleteTransaction } = useExpenses();
    const isEditing = !!editingSettlement;
    const amountInputRef = useRef(null);

    // Initial group selection with memory
    const [selectedGroupId, setSelectedGroupId] = useState(() => {
        if (editingSettlement) return editingSettlement.groupId || '';
        if (defaultGroupId) return defaultGroupId;
        if (state.selectedGroupId && state.selectedGroupId !== 'non-group') return state.selectedGroupId;
        const saved = getStorageItem('splitit_last_settlement_group');
        if (saved && (state.groups || []).some(g => g.id === saved)) return saved;
        return '';
    });

    const activeGroup = (state.groups || []).find(g => g.id === selectedGroupId);
    const availableUsers = useMemo(() => {
        if (activeGroup) {
            return state.users.filter(u => activeGroup.members.includes(u.id));
        }
        return state.users;
    }, [activeGroup, state.users]);

    const sortedUsers = useMemo(() => {
        return [...availableUsers].sort((a, b) => a.name.localeCompare(b.name));
    }, [availableUsers]);

    // Initial payer selection with memory
    const [rawPayer, setRawPayer] = useState(() => {
        if (editingSettlement) return editingSettlement.from || '';
        if (defaultFrom) return defaultFrom;
        const saved = getStorageItem('splitit_last_settlement_payer');
        return saved || '';
    });

    // Initial receiver selection with memory
    const [rawReceiver, setRawReceiver] = useState(() => {
        if (editingSettlement) return editingSettlement.to || '';
        if (defaultTo) return defaultTo;
        const saved = getStorageItem('splitit_last_settlement_receiver');
        return saved || '';
    });

    // Ensure payer and receiver are always valid members of current sortedUsers
    const payer = sortedUsers.some(u => u.id === rawPayer)
        ? rawPayer
        : (sortedUsers[0]?.id || '');

    const receiver = sortedUsers.some(u => u.id === rawReceiver && u.id !== payer)
        ? rawReceiver
        : (sortedUsers.find(u => u.id !== payer)?.id || sortedUsers[1]?.id || sortedUsers[0]?.id || '');

    const [amount, setAmount] = useState(() => {
        if (editingSettlement?.amount) return editingSettlement.amount.toString();
        if (defaultAmount) return defaultAmount.toString();
        return '';
    });

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
        if (editingSettlement?.date) return formatDateTimeLocal(editingSettlement.date);
        const saved = getStorageItem('splitit_last_settlement_datetime');
        if (saved) return saved;
        return formatDateTimeLocal(new Date());
    });

    // Bulk / Continuous Entry mode (enabled by default when creating new)
    const [bulkMode, setBulkMode] = useState(() => {
        if (editingSettlement) return false;
        const saved = getStorageItem('splitit_bulk_mode_settlement');
        return saved !== null ? saved === 'true' : true;
    });

    const [batchCount, setBatchCount] = useState(0);
    const [recentAdded, setRecentAdded] = useState([]);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSwapPayerReceiver = () => {
        const tempPayer = payer;
        const tempReceiver = receiver;
        setRawPayer(tempReceiver);
        setRawReceiver(tempPayer);
    };

    const handleSave = (e, shouldClose = false) => {
        if (e && e.preventDefault) e.preventDefault();

        const amtNum = parseFloat(amount);
        if (!payer || !receiver || payer === receiver || isNaN(amtNum) || amtNum <= 0) {
            return;
        }

        const groupId = selectedGroupId || null;

        if (isEditing) {
            updateSettlement(editingSettlement.id, payer, receiver, amount, dateTime, groupId);
            onSuccess();
            return;
        }

        // Add settlement into state & localStorage
        addSettlement(payer, receiver, amount, dateTime, groupId);

        // Keep memory in localStorage for quick recall
        if (groupId) {
            setStorageItem('splitit_last_settlement_group', groupId);
        }
        setStorageItem('splitit_last_settlement_payer', payer);
        setStorageItem('splitit_last_settlement_receiver', receiver);
        setStorageItem('splitit_last_settlement_datetime', dateTime);
        setStorageItem('splitit_bulk_mode_settlement', String(bulkMode));

        const pName = sortedUsers.find(u => u.id === payer)?.name || 'Payer';
        const rName = sortedUsers.find(u => u.id === receiver)?.name || 'Receiver';

        setRecentAdded(prev => [
            { id: Date.now(), amount: amtNum.toFixed(2), from: pName, to: rName },
            ...prev.slice(0, 4)
        ]);
        setBatchCount(prev => prev + 1);
        setShowSuccess(true);
        setAmount('');

        if (shouldClose || !bulkMode) {
            onSuccess();
        } else {
            // Keep modal open, auto focus amount input for the next transaction
            setTimeout(() => {
                amountInputRef.current?.focus();
            }, 60);
        }
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this settlement? This action cannot be undone.')) {
            deleteTransaction(editingSettlement.id);
            onSuccess();
        }
    };

    return (
        <div className="card" style={{ border: '1px solid hsl(var(--color-success) / 0.5)', boxShadow: 'var(--shadow-lg)' }}>
            {/* Header with Title and Bulk Mode Switch */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h2 style={{ color: 'hsl(var(--color-success))', margin: 0, fontSize: '1.4rem' }}>
                        {isEditing ? 'Edit Payment' : 'Record Payment'}
                    </h2>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                        {isEditing
                            ? 'Modify settlement details'
                            : bulkMode
                                ? 'Continuous entry enabled: stays open to record multiple transactions'
                                : 'Record a peer-to-peer settlement payment'}
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
                            background: bulkMode ? 'hsl(var(--color-success) / 0.12)' : 'hsl(var(--color-surface-dim))',
                            border: `1px solid ${bulkMode ? 'hsl(var(--color-success) / 0.35)' : 'hsl(var(--color-text-muted) / 0.2)'}`,
                            color: bulkMode ? 'hsl(var(--color-success))' : 'hsl(var(--color-text-muted))',
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
                                setStorageItem('splitit_bulk_mode_settlement', String(val));
                            }}
                            style={{ cursor: 'pointer', accentColor: 'hsl(var(--color-success))' }}
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
                            Recorded payment of <strong>{state.currency}{recentAdded[0].amount}</strong> ({recentAdded[0].from} → {recentAdded[0].to})
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
                            {item.from} → {item.to} ({state.currency}{item.amount})
                        </span>
                    ))}
                </div>
            )}

            <form onSubmit={(e) => handleSave(e, !bulkMode)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Group Selector with Memory */}
                <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'hsl(var(--color-surface-dim))',
                    border: '1px solid hsl(var(--color-text-muted) / 0.15)'
                }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <Layers size={16} />
                        Group (Optional)
                    </label>
                    <select
                        className="input"
                        value={selectedGroupId}
                        onChange={(e) => {
                            const newGId = e.target.value;
                            setSelectedGroupId(newGId);
                            setStorageItem('splitit_last_settlement_group', newGId);
                        }}
                        style={{ background: 'hsl(var(--color-surface))' }}
                    >
                        <option value="">Non-group settlement</option>
                        {(state.groups || []).map(g => (
                            <option key={g.id} value={g.id}>
                                👥 {g.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* From / Swap / To */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.35rem' }}>
                            From (Payer)
                        </label>
                        <select
                            className="input"
                            value={payer}
                            onChange={e => {
                                setRawPayer(e.target.value);
                                setStorageItem('splitit_last_settlement_payer', e.target.value);
                            }}
                        >
                            {sortedUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={handleSwapPayerReceiver}
                        title="Swap Payer and Receiver"
                        style={{
                            marginTop: '1.45rem',
                            padding: '0.55rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'hsl(var(--color-surface-dim))',
                            border: '1px solid hsl(var(--color-text-muted) / 0.25)',
                            color: 'hsl(var(--color-text-muted))',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'hsl(var(--color-success))';
                            e.currentTarget.style.borderColor = 'hsl(var(--color-success))';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'hsl(var(--color-text-muted))';
                            e.currentTarget.style.borderColor = 'hsl(var(--color-text-muted) / 0.25)';
                        }}
                    >
                        <ArrowLeftRight size={16} />
                    </button>

                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.35rem' }}>
                            To (Receiver)
                        </label>
                        <select
                            className="input"
                            value={receiver}
                            onChange={e => {
                                setRawReceiver(e.target.value);
                                setStorageItem('splitit_last_settlement_receiver', e.target.value);
                            }}
                        >
                            {sortedUsers.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.name} {u.id === activeGroup?.defaultCollectorId ? '⭐ (Group Collector)' : ''}
                                </option>
                            ))}
                        </select>
                        {activeGroup?.defaultCollectorId && receiver !== activeGroup.defaultCollectorId && (
                            <div style={{ marginTop: '0.35rem', textAlign: 'right' }}>
                                <button
                                    type="button"
                                    onClick={() => setRawReceiver(activeGroup.defaultCollectorId)}
                                    style={{
                                        fontSize: '0.74rem',
                                        color: 'hsl(var(--color-accent))',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        padding: 0
                                    }}
                                >
                                    Pay Collector ({sortedUsers.find(u => u.id === activeGroup.defaultCollectorId)?.name})
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Amount input */}
                <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Amount ({state.currency})</span>
                    <input
                        ref={amountInputRef}
                        className="input"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        autoFocus
                    />
                </label>

                {/* Date & Time */}
                <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Date & Time</span>
                    <input
                        className="input"
                        type="datetime-local"
                        value={dateTime}
                        onChange={e => {
                            setDateTime(e.target.value);
                            setStorageItem('splitit_last_settlement_datetime', e.target.value);
                        }}
                        required
                    />
                </label>

                {/* Buttons row */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
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
                                Delete Settlement
                            </button>
                            <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
                                <button type="button" className="btn" onClick={onCancel}>Cancel</button>
                                <button type="submit" className="btn" style={{ background: 'hsl(var(--color-success))', color: 'white' }}>
                                    Update
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
                                    border: '1px solid hsl(var(--color-success) / 0.5)',
                                    color: 'hsl(var(--color-success))',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                } : {}}
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
                                        title="Record this payment and close the modal"
                                    >
                                        Record & Close
                                    </button>
                                )}

                                <button
                                    type="submit"
                                    className="btn"
                                    style={{
                                        background: 'hsl(var(--color-success))',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        fontWeight: '600'
                                    }}
                                >
                                    {bulkMode ? (
                                        <>
                                            <Plus size={16} />
                                            Record & Next
                                        </>
                                    ) : (
                                        'Record'
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
