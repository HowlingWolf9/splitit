import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { X, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function GroupSettleUpModal({ group, onClose, onSuccess }) {
    const { state, addSettlement, getGroupPairwiseDebts } = useExpenses();
    const currentUserId = state.currentUserId;

    // Retrieve debts for this group from perspective of current user
    const { debts, netBalance } = getGroupPairwiseDebts(group.id, currentUserId);

    // Manual custom settlement option
    const [mode, setMode] = useState('quick'); // 'quick' or 'custom'
    const [payerId, setPayerId] = useState(() => {
        // Default to current user if they owe someone
        const oweDebt = debts.find(d => d.type === 'you_owe');
        return oweDebt ? currentUserId : (group.members[0] || state.users[0]?.id);
    });
    const [receiverId, setReceiverId] = useState(() => {
        const oweDebt = debts.find(d => d.type === 'you_owe');
        if (oweDebt) return oweDebt.otherUserId;
        const owedDebt = debts.find(d => d.type === 'owes_you');
        if (owedDebt) return currentUserId;
        return group.members[1] || state.users[1]?.id;
    });
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));

    const getUserName = (id) => {
        const u = state.users.find(u => u.id === id);
        return u ? u.name : 'Unknown';
    };

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const [batchCount, setBatchCount] = useState(0);
    const [recentSettledMsg, setRecentSettledMsg] = useState('');
    const [bulkMode, setBulkMode] = useState(true);

    const handleQuickSettle = (debt) => {
        const from = debt.type === 'you_owe' ? currentUserId : debt.otherUserId;
        const to = debt.type === 'you_owe' ? debt.otherUserId : currentUserId;
        addSettlement(from, to, debt.amount, new Date().toISOString(), group.id);
        if (onSuccess) onSuccess();
        setBatchCount(prev => prev + 1);
        setRecentSettledMsg(`Settled ${formatMoney(debt.amount)} with ${getUserName(debt.otherUserId)}`);
        // If this was the only debt, close after brief delay, otherwise keep open
        if (debts.length <= 1) {
            setTimeout(() => onClose(), 600);
        }
    };

    const handleCustomSubmit = (e, shouldClose = false) => {
        if (e && e.preventDefault) e.preventDefault();
        const amt = parseFloat(amount);
        if (payerId && receiverId && amt > 0 && payerId !== receiverId) {
            addSettlement(payerId, receiverId, amt, new Date(date).toISOString(), group.id);
            if (onSuccess) onSuccess();
            setBatchCount(prev => prev + 1);
            setRecentSettledMsg(`Recorded ${formatMoney(amt)} from ${getUserName(payerId)} to ${getUserName(receiverId)}`);
            setAmount('');
            if (shouldClose || !bulkMode) {
                onClose();
            }
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1100,
                padding: '1rem',
                overflowY: 'auto'
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="card"
                style={{
                    width: '100%',
                    maxWidth: '520px',
                    margin: 'auto',
                    padding: '2rem',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>
                            Settle Up in {group.name}
                        </h2>
                        <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.2rem' }}>
                            Record a payment to balance group debts
                        </div>
                    </div>
                    <button onClick={onClose} style={{ color: 'hsl(var(--color-text-muted))', padding: '0.25rem' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Net Balance Pill */}
                <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: netBalance > 0
                        ? 'hsl(var(--color-success) / 0.12)'
                        : netBalance < 0
                            ? 'hsl(var(--color-warning) / 0.12)'
                            : 'hsl(var(--color-surface-dim))',
                    border: `1px solid ${netBalance > 0
                        ? 'hsl(var(--color-success) / 0.3)'
                        : netBalance < 0
                            ? 'hsl(var(--color-warning) / 0.3)'
                            : 'hsl(var(--color-text-muted) / 0.2)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.5rem'
                }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Your balance in this group:</span>
                    <span style={{
                        fontWeight: '800',
                        fontSize: '1rem',
                        color: netBalance > 0
                            ? 'hsl(var(--color-success))'
                            : netBalance < 0
                                ? 'hsl(var(--color-warning))'
                                : 'hsl(var(--color-text-muted))'
                    }}>
                        {netBalance > 0
                            ? `You are owed ${formatMoney(netBalance)}`
                            : netBalance < 0
                                ? `You owe ${formatMoney(Math.abs(netBalance))}`
                                : 'All settled up'}
                    </span>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    background: 'hsl(var(--color-surface-dim))',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px',
                    marginBottom: '1.25rem',
                    border: '1px solid hsl(var(--color-text-muted) / 0.15)'
                }}>
                    <button
                        type="button"
                        onClick={() => setMode('quick')}
                        style={{
                            flex: 1,
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            background: mode === 'quick' ? 'hsl(var(--color-surface))' : 'transparent',
                            color: mode === 'quick' ? 'hsl(var(--color-text-main))' : 'hsl(var(--color-text-muted))',
                            boxShadow: mode === 'quick' ? 'var(--shadow-sm)' : 'none',
                        }}
                    >
                        Pending Debts ({debts.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('custom')}
                        style={{
                            flex: 1,
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            background: mode === 'custom' ? 'hsl(var(--color-surface))' : 'transparent',
                            color: mode === 'custom' ? 'hsl(var(--color-text-main))' : 'hsl(var(--color-text-muted))',
                            boxShadow: mode === 'custom' ? 'var(--shadow-sm)' : 'none',
                        }}
                    >
                        Custom Payment
                    </button>
                </div>

                {mode === 'quick' ? (
                    <div>
                        {debts.length === 0 ? (
                            <div style={{
                                padding: '2rem 1rem',
                                textAlign: 'center',
                                background: 'hsl(var(--color-surface-dim))',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <CheckCircle2 size={40} color="hsl(var(--color-success))" style={{ margin: '0 auto 0.75rem' }} />
                                <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>No pending debts!</div>
                                <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-muted))' }}>
                                    You have settled all your balances in this group.
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {debts.map((d, idx) => {
                                    const isOwing = d.type === 'you_owe';
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                padding: '1rem',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid hsl(var(--color-text-muted) / 0.2)',
                                                background: 'hsl(var(--color-surface-dim))',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '0.75rem'
                                            }}
                                        >
                                            <div>
                                                <div style={{
                                                    fontSize: '0.95rem',
                                                    fontWeight: '700',
                                                    color: isOwing ? 'hsl(var(--color-warning))' : 'hsl(var(--color-success))'
                                                }}>
                                                    {isOwing
                                                        ? `You owe ${getUserName(d.otherUserId)}`
                                                        : `${getUserName(d.otherUserId)} owes you`}
                                                </div>
                                                <div style={{ fontSize: '1.15rem', fontWeight: '800', marginTop: '0.2rem' }}>
                                                    {formatMoney(d.amount)}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn"
                                                onClick={() => handleQuickSettle(d)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    fontSize: '0.85rem',
                                                    backgroundColor: isOwing ? 'hsl(var(--color-warning))' : 'hsl(var(--color-success))',
                                                    color: 'white',
                                                    fontWeight: '700'
                                                }}
                                            >
                                                {isOwing ? 'Pay Now' : 'Mark Received'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={(e) => handleCustomSubmit(e, !bulkMode)} style={{ display: 'grid', gap: '1rem' }}>
                        {recentSettledMsg && (
                            <div style={{
                                padding: '0.65rem 0.85rem',
                                borderRadius: 'var(--radius-md)',
                                background: 'hsl(var(--color-success) / 0.15)',
                                border: '1px solid hsl(var(--color-success) / 0.35)',
                                color: 'hsl(var(--color-success))',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <span>✓ {recentSettledMsg}</span>
                                {batchCount > 0 && <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>Batch: {batchCount}</span>}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <label style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontSize: '0.8rem',
                                color: bulkMode ? 'hsl(var(--color-success))' : 'hsl(var(--color-text-muted))',
                                cursor: 'pointer',
                                fontWeight: '600'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={bulkMode}
                                    onChange={(e) => setBulkMode(e.target.checked)}
                                    style={{ accentColor: 'hsl(var(--color-success))' }}
                                />
                                <span>Keep open (Bulk Mode)</span>
                            </label>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                                Payer (Who paid)
                            </label>
                            <select
                                className="input"
                                value={payerId}
                                onChange={(e) => setPayerId(e.target.value)}
                            >
                                {group.members.map(mId => (
                                    <option key={mId} value={mId}>
                                        {getUserName(mId)} {mId === currentUserId ? '(You)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                                Receiver (Who received)
                            </label>
                            <select
                                className="input"
                                value={receiverId}
                                onChange={(e) => setReceiverId(e.target.value)}
                            >
                                {group.members.map(mId => (
                                    <option key={mId} value={mId}>
                                        {getUserName(mId)} {mId === currentUserId ? '(You)' : ''} {mId === group.defaultCollectorId ? '⭐ (Group Collector)' : ''}
                                    </option>
                                ))}
                            </select>
                            {group.defaultCollectorId && receiverId !== group.defaultCollectorId && (
                                <div style={{ marginTop: '0.25rem', textAlign: 'right' }}>
                                    <button
                                        type="button"
                                        onClick={() => setReceiverId(group.defaultCollectorId)}
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
                                        Pay Group Collector ({getUserName(group.defaultCollectorId)})
                                    </button>
                                </div>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                                Amount ({state.currency})
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                                Date
                            </label>
                            <input
                                type="datetime-local"
                                className="input"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
                                {batchCount > 0 ? `Done (${batchCount} recorded)` : 'Cancel'}
                            </button>
                            {bulkMode && (
                                <button
                                    type="button"
                                    onClick={(e) => handleCustomSubmit(e, true)}
                                    className="btn btn-secondary"
                                    style={{ flex: 1 }}
                                >
                                    Record & Close
                                </button>
                            )}
                            <button type="submit" className="btn" style={{ flex: 1, background: 'hsl(var(--color-success))', color: 'white' }}>
                                {bulkMode ? 'Record & Next' : 'Record Payment'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
