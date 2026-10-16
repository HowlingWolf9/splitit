import React, { useState, useMemo } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { useModalBackHandler } from '../utils/backButton';
import * as gdrive from '../services/googleDriveSync';
import {
    Database,
    X,
    CheckCircle2,
    AlertCircle,
    Layers,
    Users,
    User,
    RefreshCw,
    Cloud,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    Clock,
    FileJson,
    Coins,
    SlidersHorizontal
} from 'lucide-react';

/**
 * Formats an ISO date into a localized human-readable date & time
 */
function formatDateTime(isoString) {
    if (!isoString) return 'Unknown date';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Unknown date';
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Unknown date';
    }
}

/**
 * Formats relative time elapsed (e.g. "2 hours ago", "yesterday", "3 days ago")
 */
function getRelativeTime(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const diffMs = Date.now() - date.getTime();
        if (diffMs < 0) return 'just now';
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return 'just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 30) return `${diffDays} days ago`;
        const diffMonths = Math.floor(diffDays / 30);
        if (diffMonths < 12) return `${diffMonths} mo ago`;
        return `${Math.floor(diffMonths / 12)} yr ago`;
    } catch {
        return '';
    }
}

export default function ImportBackupModal({
    isOpen = true,
    backupData,
    filename = 'backup.json',
    onClose,
    onConfirm
}) {
    useModalBackHandler(isOpen, onClose);
    const { state } = useExpenses();

    // Extract inner payload
    const innerData = useMemo(() => {
        if (!backupData) return null;
        return (backupData.data && typeof backupData.data === 'object' && (
            backupData.data.users ||
            backupData.data.members ||
            backupData.data.transactions ||
            backupData.data.expenses ||
            backupData.data.groups
        )) ? backupData.data : backupData;
    }, [backupData]);

    // Extract backup normalized collections
    const backupUsers = useMemo(() => {
        if (!innerData) return [];
        return Array.isArray(innerData.users) ? innerData.users : (Array.isArray(innerData.members) ? innerData.members : []);
    }, [innerData]);

    const backupGroups = useMemo(() => {
        if (!innerData) return [];
        return Array.isArray(innerData.groups) ? innerData.groups : [];
    }, [innerData]);

    const backupTransactions = useMemo(() => {
        if (!innerData) return [];
        if (Array.isArray(innerData.transactions) && innerData.transactions.length > 0) {
            return innerData.transactions;
        }
        const exp = Array.isArray(innerData.expenses) ? innerData.expenses.map(e => ({ ...e, type: 'EXPENSE' })) : [];
        const stl = Array.isArray(innerData.settlements) ? innerData.settlements.map(s => ({ ...s, type: 'SETTLEMENT' })) : [];
        return [...exp, ...stl];
    }, [innerData]);

    const backupCurrency = innerData?.currency || backupData?.currency || state.currency || 'INR';
    const backupDate = backupData?.exportDate || backupData?.lastSyncedAt || backupData?.date || null;
    const relativeTime = getRelativeTime(backupDate);
    const schemaVersion = backupData?.version || (backupData?.appName ? `${backupData.appName} v2` : 'v2.1');

    // Active local state counts
    const currentUsersCount = state.users?.length || 0;
    const currentGroupsCount = state.groups?.length || 0;
    const currentTransactionsCount = state.transactions?.length || 0;
    const currentCurrency = state.currency || 'INR';

    // Cloud connection status
    const isDriveConnected = gdrive.isAuthenticated();

    // Form configuration state
    const [mode, setMode] = useState('REPLACE'); // 'REPLACE' | 'MERGE'
    const [cloudAction, setCloudAction] = useState('OVERWRITE'); // 'OVERWRITE' | 'MERGE' | 'PAUSE'
    const [createSafetyBackup, setCreateSafetyBackup] = useState(true);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Pre-select target user identity in backup representing "You"
    const [targetUserId, setTargetUserId] = useState(() => {
        const currentUserName = state.users.find(u => u.id === state.currentUserId)?.name?.toLowerCase();
        const matched = backupUsers.find(u => u.name && currentUserName && u.name.toLowerCase() === currentUserName);
        if (matched) return matched.id;
        if (innerData?.currentUserId && backupUsers.some(u => u.id === innerData.currentUserId)) {
            return innerData.currentUserId;
        }
        return backupUsers[0]?.id || state.currentUserId;
    });

    if (!isOpen || !backupData) return null;

    const handleConfirm = async () => {
        setError('');
        setIsSubmitting(true);
        try {
            await onConfirm({
                data: backupData,
                mode,
                cloudAction: isDriveConnected ? cloudAction : 'PAUSE',
                targetUserId,
                createSafetyBackup
            });
        } catch (err) {
            console.error('Import confirmation error:', err);
            setError(err.message || 'Failed to complete import');
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSubmitting) onClose();
            }}
        >
            <div
                className="modal-content bottom-sheet"
                style={{
                    maxWidth: '580px',
                    maxHeight: '85dvh',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                <div className="bottom-sheet-handle" />

                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: 'var(--radius-md)',
                                background: 'hsl(var(--color-accent) / 0.12)',
                                color: 'hsl(var(--color-accent))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <FileJson size={22} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                                    Import Backup JSON
                                </h3>
                                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.15rem' }}>
                                    {filename}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn-icon"
                            onClick={onClose}
                            disabled={isSubmitting}
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'hsl(var(--color-danger) / 0.1)',
                            color: 'hsl(var(--color-danger))',
                            fontSize: '0.88rem'
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Metadata Card */}
                    <div style={{
                        padding: '1rem 1.15rem',
                        background: 'hsl(var(--color-surface-dim))',
                        border: '1px solid hsl(var(--color-border))',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem', color: 'hsl(var(--color-text-muted))' }}>
                                <Clock size={15} style={{ color: 'hsl(var(--color-accent))' }} />
                                <span>Exported: <strong style={{ color: 'hsl(var(--color-text-main))' }}>{formatDateTime(backupDate)}</strong></span>
                                {relativeTime && (
                                    <span style={{
                                        fontSize: '0.75rem',
                                        background: 'hsl(var(--color-accent) / 0.12)',
                                        color: 'hsl(var(--color-accent))',
                                        padding: '0.1rem 0.45rem',
                                        borderRadius: 'var(--radius-full)',
                                        fontWeight: 600
                                    }}>
                                        {relativeTime}
                                    </span>
                                )}
                            </div>
                            <span style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))', fontWeight: 600 }}>
                                {schemaVersion}
                            </span>
                        </div>

                        {/* Badges Row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.3rem 0.65rem',
                                background: 'hsl(var(--color-surface))',
                                border: '1px solid hsl(var(--color-border-subtle))',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                <Layers size={13} style={{ color: 'hsl(var(--color-primary))' }} />
                                <span>{backupTransactions.length} Transactions</span>
                            </div>

                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.3rem 0.65rem',
                                background: 'hsl(var(--color-surface))',
                                border: '1px solid hsl(var(--color-border-subtle))',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                <Users size={13} style={{ color: '#10b981' }} />
                                <span>{backupGroups.length} Groups</span>
                            </div>

                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.3rem 0.65rem',
                                background: 'hsl(var(--color-surface))',
                                border: '1px solid hsl(var(--color-border-subtle))',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                <User size={13} style={{ color: '#f59e0b' }} />
                                <span>{backupUsers.length} People</span>
                            </div>

                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.3rem 0.65rem',
                                background: 'hsl(var(--color-surface))',
                                border: '1px solid hsl(var(--color-border-subtle))',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                <Coins size={13} style={{ color: '#8b5cf6' }} />
                                <span>{backupCurrency}</span>
                            </div>
                        </div>
                    </div>

                    {/* Data Comparison Card */}
                    <div style={{
                        border: '1px solid hsl(var(--color-border))',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '0.65rem 1rem',
                            background: 'hsl(var(--color-surface-dim))',
                            borderBottom: '1px solid hsl(var(--color-border-subtle))',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'hsl(var(--color-text-muted))',
                            display: 'grid',
                            gridTemplateColumns: '1.4fr 1fr 1fr',
                            alignItems: 'center'
                        }}>
                            <span>Record</span>
                            <span style={{ textAlign: 'center' }}>Current Local</span>
                            <span style={{ textAlign: 'center' }}>In Backup</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', background: 'hsl(var(--color-surface))' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.4fr 1fr 1fr',
                                padding: '0.65rem 1rem',
                                borderBottom: '1px solid hsl(var(--color-border-subtle))',
                                alignItems: 'center',
                                fontSize: '0.88rem'
                            }}>
                                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Layers size={14} style={{ color: 'hsl(var(--color-text-muted))' }} />
                                    Transactions
                                </span>
                                <span style={{ textAlign: 'center', color: 'hsl(var(--color-text-muted))' }}>
                                    {currentTransactionsCount}
                                </span>
                                <span style={{ textAlign: 'center', fontWeight: 700, color: 'hsl(var(--color-accent))' }}>
                                    {backupTransactions.length}
                                </span>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.4fr 1fr 1fr',
                                padding: '0.65rem 1rem',
                                borderBottom: '1px solid hsl(var(--color-border-subtle))',
                                alignItems: 'center',
                                fontSize: '0.88rem'
                            }}>
                                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Users size={14} style={{ color: 'hsl(var(--color-text-muted))' }} />
                                    Groups
                                </span>
                                <span style={{ textAlign: 'center', color: 'hsl(var(--color-text-muted))' }}>
                                    {currentGroupsCount}
                                </span>
                                <span style={{ textAlign: 'center', fontWeight: 700, color: 'hsl(var(--color-accent))' }}>
                                    {backupGroups.length}
                                </span>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.4fr 1fr 1fr',
                                padding: '0.65rem 1rem',
                                borderBottom: '1px solid hsl(var(--color-border-subtle))',
                                alignItems: 'center',
                                fontSize: '0.88rem'
                            }}>
                                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <User size={14} style={{ color: 'hsl(var(--color-text-muted))' }} />
                                    People / Members
                                </span>
                                <span style={{ textAlign: 'center', color: 'hsl(var(--color-text-muted))' }}>
                                    {currentUsersCount}
                                </span>
                                <span style={{ textAlign: 'center', fontWeight: 700, color: 'hsl(var(--color-accent))' }}>
                                    {backupUsers.length}
                                </span>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.4fr 1fr 1fr',
                                padding: '0.65rem 1rem',
                                alignItems: 'center',
                                fontSize: '0.88rem'
                            }}>
                                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Coins size={14} style={{ color: 'hsl(var(--color-text-muted))' }} />
                                    Currency
                                </span>
                                <span style={{ textAlign: 'center', color: 'hsl(var(--color-text-muted))' }}>
                                    {currentCurrency}
                                </span>
                                <span style={{ textAlign: 'center', fontWeight: 700, color: 'hsl(var(--color-accent))' }}>
                                    {backupCurrency}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Mode Selector */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, marginBottom: '0.65rem' }}>
                            Choose Import Strategy:
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {/* Option 1: Clean Restore (Replace All) */}
                            <div
                                onClick={() => setMode('REPLACE')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.85rem',
                                    padding: '0.95rem 1rem',
                                    borderRadius: 'var(--radius-lg)',
                                    cursor: 'pointer',
                                    border: mode === 'REPLACE'
                                        ? '2px solid hsl(var(--color-accent))'
                                        : '1px solid hsl(var(--color-border))',
                                    background: mode === 'REPLACE'
                                        ? 'hsl(var(--color-accent) / 0.08)'
                                        : 'hsl(var(--color-surface))',
                                    transition: 'all var(--transition-fast)'
                                }}
                            >
                                <input
                                    type="radio"
                                    name="importMode"
                                    checked={mode === 'REPLACE'}
                                    onChange={() => setMode('REPLACE')}
                                    style={{ marginTop: '0.2rem', accentColor: 'hsl(var(--color-accent))', cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'hsl(var(--color-text-main))' }}>
                                            Clean Restore (Replace All)
                                        </span>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            padding: '0.1rem 0.45rem',
                                            borderRadius: 'var(--radius-full)',
                                            background: 'hsl(var(--color-accent) / 0.15)',
                                            color: 'hsl(var(--color-accent))'
                                        }}>
                                            Recommended
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.25rem', lineHeight: 1.4 }}>
                                        Replaces current local state completely with backup contents. Best for reverting to an exact point-in-time snapshot.
                                    </div>
                                </div>
                            </div>

                            {/* Option 2: Smart Merge (Combine Data) */}
                            <div
                                onClick={() => setMode('MERGE')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.85rem',
                                    padding: '0.95rem 1rem',
                                    borderRadius: 'var(--radius-lg)',
                                    cursor: 'pointer',
                                    border: mode === 'MERGE'
                                        ? '2px solid hsl(var(--color-accent))'
                                        : '1px solid hsl(var(--color-border))',
                                    background: mode === 'MERGE'
                                        ? 'hsl(var(--color-accent) / 0.08)'
                                        : 'hsl(var(--color-surface))',
                                    transition: 'all var(--transition-fast)'
                                }}
                            >
                                <input
                                    type="radio"
                                    name="importMode"
                                    checked={mode === 'MERGE'}
                                    onChange={() => setMode('MERGE')}
                                    style={{ marginTop: '0.2rem', accentColor: 'hsl(var(--color-accent))', cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'hsl(var(--color-text-main))' }}>
                                        Smart Merge (Combine Data)
                                    </span>
                                    <div style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.25rem', lineHeight: 1.4 }}>
                                        Unions backup records with your current data without deleting existing transactions. Conflicting items are resolved by newest update timestamp.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Advanced Options Accordion */}
                    <div style={{
                        border: '1px solid hsl(var(--color-border))',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden'
                    }}>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            style={{
                                width: '100%',
                                padding: '0.85rem 1rem',
                                background: 'hsl(var(--color-surface-dim))',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                color: 'hsl(var(--color-text-main))'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <SlidersHorizontal size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Advanced Options</span>
                                {isDriveConnected && (
                                    <span style={{
                                        fontSize: '0.72rem',
                                        padding: '0.1rem 0.45rem',
                                        borderRadius: 'var(--radius-full)',
                                        background: 'hsl(var(--color-success) / 0.15)',
                                        color: 'hsl(var(--color-success))',
                                        fontWeight: 600
                                    }}>
                                        Cloud Connected
                                    </span>
                                )}
                            </div>
                            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {showAdvanced && (
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'hsl(var(--color-surface))' }}>
                                {/* Safety Backup Option */}
                                <div
                                    onClick={() => setCreateSafetyBackup(!createSafetyBackup)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '0.75rem',
                                        padding: '0.75rem 0.85rem',
                                        background: 'hsl(var(--color-surface-dim))',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid hsl(var(--color-border-subtle))',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={createSafetyBackup}
                                        onChange={(e) => setCreateSafetyBackup(e.target.checked)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ marginTop: '0.2rem', accentColor: 'hsl(var(--color-accent))', cursor: 'pointer' }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.88rem' }}>
                                            <ShieldCheck size={16} style={{ color: '#10b981' }} />
                                            <span>Create safety backup before importing</span>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.15rem' }}>
                                            Automatically saves a snapshot of your current local data before importing, so you can revert anytime.
                                        </div>
                                    </div>
                                </div>

                                {/* Active Profile / "You" Mapping */}
                                {backupUsers.length > 0 && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Your Profile ("You") in Backup:
                                        </label>
                                        <select
                                            className="input"
                                            value={targetUserId}
                                            onChange={(e) => setTargetUserId(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.88rem' }}
                                        >
                                            {backupUsers.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name} {u.id === innerData?.currentUserId ? '(Author)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <div style={{ fontSize: '0.76rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.25rem' }}>
                                            Selects which member identity corresponds to you on this device after import.
                                        </div>
                                    </div>
                                )}

                                {/* Google Drive Cloud Sync Action */}
                                {isDriveConnected ? (
                                    <div style={{ borderTop: '1px solid hsl(var(--color-border-subtle))', paddingTop: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem' }}>
                                            <Cloud size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                                            <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                                Google Drive Cloud Action:
                                            </label>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                            {/* Overwrite Cloud */}
                                            <div
                                                onClick={() => setCloudAction('OVERWRITE')}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '0.65rem',
                                                    padding: '0.65rem 0.8rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    border: cloudAction === 'OVERWRITE'
                                                        ? '1.5px solid hsl(var(--color-accent))'
                                                        : '1px solid hsl(var(--color-border-subtle))',
                                                    background: cloudAction === 'OVERWRITE'
                                                        ? 'hsl(var(--color-accent) / 0.08)'
                                                        : 'hsl(var(--color-surface-dim))'
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="cloudAction"
                                                    checked={cloudAction === 'OVERWRITE'}
                                                    onChange={() => setCloudAction('OVERWRITE')}
                                                    style={{ marginTop: '0.15rem', accentColor: 'hsl(var(--color-accent))' }}
                                                />
                                                <div style={{ fontSize: '0.82rem' }}>
                                                    <span style={{ fontWeight: 700 }}>Overwrite Cloud (Reset Drive)</span>
                                                    <div style={{ color: 'hsl(var(--color-text-muted))', fontSize: '0.76rem', marginTop: '0.1rem' }}>
                                                        Uploads this restored backup as the definitive cloud state. Prevents older cloud items from resurrecting.
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Merge with Cloud */}
                                            <div
                                                onClick={() => setCloudAction('MERGE')}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '0.65rem',
                                                    padding: '0.65rem 0.8rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    border: cloudAction === 'MERGE'
                                                        ? '1.5px solid hsl(var(--color-accent))'
                                                        : '1px solid hsl(var(--color-border-subtle))',
                                                    background: cloudAction === 'MERGE'
                                                        ? 'hsl(var(--color-accent) / 0.08)'
                                                        : 'hsl(var(--color-surface-dim))'
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="cloudAction"
                                                    checked={cloudAction === 'MERGE'}
                                                    onChange={() => setCloudAction('MERGE')}
                                                    style={{ marginTop: '0.15rem', accentColor: 'hsl(var(--color-accent))' }}
                                                />
                                                <div style={{ fontSize: '0.82rem' }}>
                                                    <span style={{ fontWeight: 700 }}>Merge with Cloud</span>
                                                    <div style={{ color: 'hsl(var(--color-text-muted))', fontSize: '0.76rem', marginTop: '0.1rem' }}>
                                                        Bidirectional sync combining imported data with whatever already exists in Google Drive.
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Pause Auto-Sync */}
                                            <div
                                                onClick={() => setCloudAction('PAUSE')}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '0.65rem',
                                                    padding: '0.65rem 0.8rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    border: cloudAction === 'PAUSE'
                                                        ? '1.5px solid hsl(var(--color-accent))'
                                                        : '1px solid hsl(var(--color-border-subtle))',
                                                    background: cloudAction === 'PAUSE'
                                                        ? 'hsl(var(--color-accent) / 0.08)'
                                                        : 'hsl(var(--color-surface-dim))'
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="cloudAction"
                                                    checked={cloudAction === 'PAUSE'}
                                                    onChange={() => setCloudAction('PAUSE')}
                                                    style={{ marginTop: '0.15rem', accentColor: 'hsl(var(--color-accent))' }}
                                                />
                                                <div style={{ fontSize: '0.82rem' }}>
                                                    <span style={{ fontWeight: 700 }}>Pause Auto-Sync</span>
                                                    <div style={{ color: 'hsl(var(--color-text-muted))', fontSize: '0.76rem', marginTop: '0.1rem' }}>
                                                        Imports data locally and disables Google Drive sync so you can inspect everything first.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{
                                        fontSize: '0.78rem',
                                        color: 'hsl(var(--color-text-muted))',
                                        padding: '0.5rem 0.75rem',
                                        background: 'hsl(var(--color-surface-dim))',
                                        borderRadius: 'var(--radius-md)'
                                    }}>
                                        Google Drive is not connected. This import will affect only your local device data.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleConfirm}
                            disabled={isSubmitting}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minWidth: '130px', justifyContent: 'center' }}
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw size={15} className="spin-animation" />
                                    <span>Importing...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    <span>{mode === 'MERGE' ? 'Merge Data' : 'Restore Data'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
