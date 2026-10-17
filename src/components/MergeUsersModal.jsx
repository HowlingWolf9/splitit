import React, { useState, useMemo } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { useModalBackHandler } from '../utils/backButton';
import {
    X,
    GitMerge,
    ArrowLeftRight,
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    Users,
    Receipt,
    HandCoins,
    UserCheck
} from 'lucide-react';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export default function MergeUsersModal({
    initialSourceUserId = '',
    initialTargetUserId = '',
    onClose,
    onSuccess
}) {
    useModalBackHandler(true, onClose);
    const { state, balances, mergeUsers } = useExpenses();

    const users = useMemo(() => state.users || [], [state.users]);

    // Initial source user
    const [sourceUserId, setSourceUserId] = useState(() => {
        if (initialSourceUserId && users.some(u => u.id === initialSourceUserId)) {
            return initialSourceUserId;
        }
        return users[0]?.id || '';
    });

    // Initial target user
    const [targetUserId, setTargetUserId] = useState(() => {
        if (initialTargetUserId && users.some(u => u.id === initialTargetUserId && u.id !== initialSourceUserId)) {
            return initialTargetUserId;
        }
        const other = users.find(u => u.id !== initialSourceUserId);
        return other?.id || '';
    });

    const [nameChoice, setNameChoice] = useState('target'); // 'target', 'source', 'custom'
    const [customName, setCustomName] = useState('');
    const [emailChoice, setEmailChoice] = useState('target'); // 'target', 'source', 'custom', 'none'
    const [customEmail, setCustomEmail] = useState('');
    const [confirmAcknowledged, setConfirmAcknowledged] = useState(false);
    const [error, setError] = useState('');

    const sourceUser = useMemo(() => users.find(u => u.id === sourceUserId), [users, sourceUserId]);
    const targetUser = useMemo(() => users.find(u => u.id === targetUserId), [users, targetUserId]);

    // Swap direction
    const handleSwapDirection = () => {
        setSourceUserId(targetUserId);
        setTargetUserId(sourceUserId);
        setConfirmAcknowledged(false);
    };

    // Calculate real-time impact metrics
    const impact = useMemo(() => {
        if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) {
            return null;
        }

        const transactions = state.transactions || [];
        const groups = state.groups || [];

        let affectedExpenses = 0;
        let affectedSettlements = 0;
        let retiredSelfSettlements = 0;

        transactions.forEach(t => {
            if (t.type === 'EXPENSE') {
                const isPayer = Array.isArray(t.payers)
                    ? t.payers.some(p => p && p.userId === sourceUserId)
                    : (t.payers && sourceUserId in t.payers);
                const isSplit = Array.isArray(t.splits)
                    ? t.splits.some(s => s && s.userId === sourceUserId)
                    : (t.splits && sourceUserId in t.splits);
                const isCollector = t.collectorId === sourceUserId;
                if (isPayer || isSplit || isCollector) {
                    affectedExpenses++;
                }
            } else if (t.type === 'SETTLEMENT') {
                const isSelfDirect = (t.from === sourceUserId && t.to === targetUserId) ||
                    (t.from === targetUserId && t.to === sourceUserId);
                if (isSelfDirect) {
                    retiredSelfSettlements++;
                } else if (t.from === sourceUserId || t.to === sourceUserId || t.collectorId === sourceUserId) {
                    affectedSettlements++;
                }
            }
        });

        const affectedGroups = groups.filter(g => Array.isArray(g.members) && g.members.includes(sourceUserId)).length;

        const sourceBal = balances[sourceUserId] || 0;
        const targetBal = balances[targetUserId] || 0;
        const projectedBal = sourceBal + targetBal;

        return {
            affectedExpenses,
            affectedSettlements,
            retiredSelfSettlements,
            affectedGroups,
            sourceBal,
            targetBal,
            projectedBal
        };
    }, [sourceUserId, targetUserId, state.transactions, state.groups, balances]);

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const handleMerge = (e) => {
        e.preventDefault();
        setError('');

        if (!sourceUserId || !targetUserId) {
            setError('Please select both a source and target member.');
            return;
        }

        if (sourceUserId === targetUserId) {
            setError('Source and target member must be different.');
            return;
        }

        if (!confirmAcknowledged) {
            setError('Please confirm that you understand this action cannot be undone.');
            return;
        }

        // Resolve chosen name
        let chosenName = targetUser?.name || '';
        if (nameChoice === 'source') chosenName = sourceUser?.name || '';
        if (nameChoice === 'custom') {
            if (!customName.trim()) {
                setError('Please provide a custom name or pick an existing name.');
                return;
            }
            chosenName = customName.trim();
        }

        // Resolve chosen email
        let chosenEmail = targetUser?.email || null;
        if (emailChoice === 'source') chosenEmail = sourceUser?.email || null;
        if (emailChoice === 'none') chosenEmail = null;
        if (emailChoice === 'custom') {
            const trimmed = customEmail.trim();
            if (trimmed && !EMAIL_REGEX.test(trimmed)) {
                setError('Please enter a valid email address.');
                return;
            }
            chosenEmail = trimmed || null;
        }

        mergeUsers(sourceUserId, targetUserId, {
            name: chosenName,
            email: chosenEmail
        });

        if (onSuccess) {
            onSuccess(targetUserId);
        }
        onClose();
    };

    return (
        <div
            className="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="modal-content"
                style={{
                    maxWidth: '560px',
                    padding: '1.25rem 1.5rem',
                    position: 'relative',
                    overflowY: 'auto'
                }}
            >
                <div className="bottom-sheet-handle" />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: 'hsl(var(--color-primary, 215 90% 55%) / 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'hsl(var(--color-primary, 215 90% 55%))'
                        }}>
                            <GitMerge size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Merge Members</h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))' }}>
                                Consolidate two identities into one unified record
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-icon"
                        title="Close"
                        style={{ color: 'hsl(var(--color-text-muted))', borderRadius: '50%' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div style={{
                        padding: '0.65rem 0.85rem',
                        marginBottom: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'hsl(var(--color-danger) / 0.12)',
                        border: '1px solid hsl(var(--color-danger) / 0.3)',
                        color: 'hsl(var(--color-danger))',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleMerge} style={{ display: 'grid', gap: '1.15rem' }}>
                    {/* Source and Target Selectors with Swap */}
                    <div style={{
                        background: 'hsl(var(--color-surface-dim))',
                        padding: '1rem',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid hsl(var(--color-border))',
                        display: 'grid',
                        gap: '0.75rem'
                    }}>
                        {/* Source Member */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--color-danger))', fontWeight: 700 }}>
                                Source Member (Will be removed)
                            </label>
                            <select
                                className="input"
                                value={sourceUserId}
                                onChange={(e) => {
                                    setSourceUserId(e.target.value);
                                    setConfirmAcknowledged(false);
                                }}
                            >
                                {users.map(u => (
                                    <option key={u.id} value={u.id} disabled={u.id === targetUserId}>
                                        {u.name} {u.email ? `(${u.email})` : ''} {u.id === state.currentUserId ? '— [You]' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Swap Button */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button
                                type="button"
                                onClick={handleSwapDirection}
                                className="btn btn-secondary btn-sm"
                                title="Swap merge direction"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    fontSize: '0.8rem',
                                    padding: '0.35rem 0.75rem'
                                }}
                            >
                                <ArrowLeftRight size={14} />
                                <span>Swap Direction</span>
                            </button>
                        </div>

                        {/* Target Member */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--color-success))', fontWeight: 700 }}>
                                Target Member (Will be kept)
                            </label>
                            <select
                                className="input"
                                value={targetUserId}
                                onChange={(e) => {
                                    setTargetUserId(e.target.value);
                                    setConfirmAcknowledged(false);
                                }}
                            >
                                {users.map(u => (
                                    <option key={u.id} value={u.id} disabled={u.id === sourceUserId}>
                                        {u.name} {u.email ? `(${u.email})` : ''} {u.id === state.currentUserId ? '— [You]' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Impact Summary Preview Card */}
                    {impact && (
                        <div style={{
                            background: 'hsl(var(--color-surface-dim))',
                            borderRadius: 'var(--radius-lg)',
                            padding: '1rem',
                            border: '1px solid hsl(var(--color-border))',
                            display: 'grid',
                            gap: '0.75rem'
                        }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--color-text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Projected Impact Summary
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                                <div style={{
                                    background: 'hsl(var(--color-surface))',
                                    padding: '0.65rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid hsl(var(--color-border-subtle))'
                                }}>
                                    <div style={{ fontSize: '0.72rem', color: 'hsl(var(--color-text-muted))', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Receipt size={13} /> Expenses
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '0.2rem' }}>
                                        {impact.affectedExpenses}
                                    </div>
                                </div>

                                <div style={{
                                    background: 'hsl(var(--color-surface))',
                                    padding: '0.65rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid hsl(var(--color-border-subtle))'
                                }}>
                                    <div style={{ fontSize: '0.72rem', color: 'hsl(var(--color-text-muted))', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <HandCoins size={13} /> Settlements
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '0.2rem' }}>
                                        {impact.affectedSettlements}
                                    </div>
                                </div>

                                <div style={{
                                    background: 'hsl(var(--color-surface))',
                                    padding: '0.65rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid hsl(var(--color-border-subtle))'
                                }}>
                                    <div style={{ fontSize: '0.72rem', color: 'hsl(var(--color-text-muted))', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Users size={13} /> Groups
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '0.2rem' }}>
                                        {impact.affectedGroups}
                                    </div>
                                </div>

                                {impact.retiredSelfSettlements > 0 && (
                                    <div style={{
                                        background: 'hsl(var(--color-warning, 40 90% 50%) / 0.1)',
                                        padding: '0.65rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid hsl(var(--color-warning, 40 90% 50%) / 0.3)'
                                    }}>
                                        <div style={{ fontSize: '0.72rem', color: 'hsl(var(--color-warning, 40 90% 50%))' }}>
                                            Retired Trans.
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '0.2rem', color: 'hsl(var(--color-warning, 40 90% 50%))' }}>
                                            {impact.retiredSelfSettlements}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Balance Transition */}
                            <div style={{
                                marginTop: '0.25rem',
                                padding: '0.65rem 0.85rem',
                                background: 'hsl(var(--color-surface))',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid hsl(var(--color-border-subtle))',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.5rem',
                                fontSize: '0.84rem'
                            }}>
                                <div>
                                    <span style={{ color: 'hsl(var(--color-text-muted))' }}>Combined Net Balance: </span>
                                    <strong style={{
                                        color: impact.projectedBal > 0.009
                                            ? 'hsl(var(--color-success))'
                                            : impact.projectedBal < -0.009
                                                ? 'hsl(var(--color-danger))'
                                                : 'inherit'
                                    }}>
                                        {formatMoney(impact.projectedBal)}
                                    </strong>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))' }}>
                                    ({sourceUser?.name}: {formatMoney(impact.sourceBal)} + {targetUser?.name}: {formatMoney(impact.targetBal)})
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Identity Resolution (Name & Email) */}
                    <div style={{
                        background: 'hsl(var(--color-surface-dim))',
                        padding: '1rem',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid hsl(var(--color-border))',
                        display: 'grid',
                        gap: '1rem'
                    }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--color-text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Retained Identity Details
                        </div>

                        {/* Name Selection */}
                        <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <label className="label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                                Display Name to Keep
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="nameChoice"
                                    value="target"
                                    checked={nameChoice === 'target'}
                                    onChange={() => setNameChoice('target')}
                                    style={{ accentColor: 'hsl(var(--color-accent))' }}
                                />
                                <span>Keep Target: <strong>{targetUser?.name}</strong></span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="nameChoice"
                                    value="source"
                                    checked={nameChoice === 'source'}
                                    onChange={() => setNameChoice('source')}
                                    style={{ accentColor: 'hsl(var(--color-accent))' }}
                                />
                                <span>Adopt Source: <strong>{sourceUser?.name}</strong></span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="nameChoice"
                                    value="custom"
                                    checked={nameChoice === 'custom'}
                                    onChange={() => setNameChoice('custom')}
                                    style={{ accentColor: 'hsl(var(--color-accent))' }}
                                />
                                <span>Custom Name</span>
                            </label>
                            {nameChoice === 'custom' && (
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    placeholder="Enter custom name..."
                                    className="input"
                                    style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
                                    autoFocus
                                />
                            )}
                        </div>

                        {/* Email Selection */}
                        <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <label className="label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                                Email to Keep
                            </label>
                            {targetUser?.email && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="emailChoice"
                                        value="target"
                                        checked={emailChoice === 'target'}
                                        onChange={() => setEmailChoice('target')}
                                        style={{ accentColor: 'hsl(var(--color-accent))' }}
                                    />
                                    <span>Target's Email: <strong>{targetUser.email}</strong></span>
                                </label>
                            )}
                            {sourceUser?.email && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="emailChoice"
                                        value="source"
                                        checked={emailChoice === 'source'}
                                        onChange={() => setEmailChoice('source')}
                                        style={{ accentColor: 'hsl(var(--color-accent))' }}
                                    />
                                    <span>Source's Email: <strong>{sourceUser.email}</strong></span>
                                </label>
                            )}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="emailChoice"
                                    value="custom"
                                    checked={emailChoice === 'custom'}
                                    onChange={() => setEmailChoice('custom')}
                                    style={{ accentColor: 'hsl(var(--color-accent))' }}
                                />
                                <span>Custom Email</span>
                            </label>
                            {emailChoice === 'custom' && (
                                <input
                                    type="email"
                                    value={customEmail}
                                    onChange={(e) => setCustomEmail(e.target.value)}
                                    placeholder="Enter custom email..."
                                    className="input"
                                    style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
                                />
                            )}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="emailChoice"
                                    value="none"
                                    checked={emailChoice === 'none'}
                                    onChange={() => setEmailChoice('none')}
                                    style={{ accentColor: 'hsl(var(--color-accent))' }}
                                />
                                <span style={{ color: 'hsl(var(--color-text-muted))' }}>No Email (Leave blank)</span>
                            </label>
                        </div>
                    </div>

                    {/* Confirmation Checkbox & Safety Guard */}
                    <div style={{
                        padding: '0.85rem 1rem',
                        background: 'hsl(var(--color-danger) / 0.08)',
                        border: '1px solid hsl(var(--color-danger) / 0.25)',
                        borderRadius: 'var(--radius-md)',
                        display: 'grid',
                        gap: '0.65rem'
                    }}>
                        <div style={{ display: 'flex', gap: '0.5rem', color: 'hsl(var(--color-danger))', fontSize: '0.82rem', fontWeight: 600 }}>
                            <ShieldAlert size={17} style={{ flexShrink: 0 }} />
                            <span>
                                This operation will permanently remove <strong>{sourceUser?.name}</strong> and reassign all historical transactions and group memberships to <strong>{targetUser?.name}</strong>.
                            </span>
                        </div>

                        <label style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            color: 'hsl(var(--color-text-main))',
                            userSelect: 'none'
                        }}>
                            <input
                                type="checkbox"
                                checked={confirmAcknowledged}
                                onChange={(e) => setConfirmAcknowledged(e.target.checked)}
                                style={{ marginTop: '0.15rem', accentColor: 'hsl(var(--color-danger))' }}
                            />
                            <span>
                                I understand that <strong>{sourceUser?.name}</strong> will be permanently merged into <strong>{targetUser?.name}</strong>.
                            </span>
                        </label>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem', paddingTop: '0.75rem', borderTop: '1px solid hsl(var(--color-border))' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-danger"
                            disabled={!sourceUserId || !targetUserId || sourceUserId === targetUserId || !confirmAcknowledged}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}
                        >
                            <GitMerge size={16} />
                            <span>Merge Members</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
