import React, { useRef, useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import * as gdrive from '../services/googleDriveSync';
import { exportBackupJson, readJsonFile, openDesktopBackupFile, isDesktopApp } from '../utils/fileHelper';
import ImportBackupModal from './ImportBackupModal';
import {
    Settings as SettingsIcon,
    Download,
    Upload,
    Check,
    AlertCircle,
    Database,
    Coins,
    Smartphone,
    ExternalLink,
    Cloud,
    RefreshCw,
    LogOut,
    Radio,
    Trash2,
    Plus,
    WifiOff
} from 'lucide-react';

export default function Settings() {
    const {
        state,
        setCurrency,
        currencies,
        exportData,
        importBackupAdvanced,
        syncStatus,
        syncError,
        lastSyncedAt,
        isAutoSyncEnabled,
        setIsAutoSyncEnabled,
        syncNow,
        connectDrive,
        disconnectDrive,
        getConfiguredRelays,
        saveConfiguredRelays,
        defaultNostrRelays
    } = useExpenses();

    const fileInputRef = useRef(null);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }
    const [pendingBackup, setPendingBackup] = useState(null); // { data, filename }

    // Nostr Relay configuration state
    const [nostrRelays, setNostrRelays] = useState(() => getConfiguredRelays?.() || []);
    const [newRelayInput, setNewRelayInput] = useState('');

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleExport = async () => {
        try {
            const jsonData = exportData();
            const res = await exportBackupJson(jsonData);
            if (res?.canceled) return;
            showMessage('success', 'Data exported successfully!');
        } catch (err) {
            console.error('Export error:', err);
            showMessage('error', 'Failed to export data: ' + (err.message || 'Unknown error'));
        }
    };

    const validateBackupData = (parsed) => {
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('File does not contain a valid JSON object');
        }
        const inner = (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data))
            ? parsed.data
            : parsed;

        const hasUsers = Array.isArray(inner.users) || Array.isArray(inner.members);
        const hasTx = Array.isArray(inner.transactions) || Array.isArray(inner.expenses) || Array.isArray(inner.settlements);
        const hasGroups = Array.isArray(inner.groups);

        if (!hasUsers && !hasTx && !hasGroups) {
            throw new Error('Unrecognized backup structure: no users, groups, or transactions found');
        }
        return true;
    };

    const handleImportClick = async () => {
        if (isDesktopApp()) {
            try {
                const res = await openDesktopBackupFile();
                if (res?.canceled) return;
                if (res?.success && res.content) {
                    const parsed = JSON.parse(res.content);
                    validateBackupData(parsed);
                    const fname = res.filePath ? res.filePath.split(/[/\\]/).pop() : 'backup.json';
                    setPendingBackup({ data: parsed, filename: fname });
                } else if (res?.error) {
                    showMessage('error', res.error);
                }
            } catch (err) {
                console.error('Desktop import error:', err);
                showMessage('error', 'Failed to read backup file: ' + (err.message || 'Unknown error'));
            }
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await readJsonFile(file);
            const parsed = JSON.parse(text);
            validateBackupData(parsed);
            setPendingBackup({ data: parsed, filename: file.name });
        } catch (err) {
            console.error('File read error:', err);
            showMessage('error', 'Failed to read file: ' + (err.message || 'Unknown error'));
        }

        event.target.value = '';
    };

    const handleConfirmImport = async (options) => {
        const result = await importBackupAdvanced(options);
        if (result.success) {
            setPendingBackup(null);
            showMessage('success', options.mode === 'MERGE' ? 'Data merged successfully!' : 'Backup restored successfully!');
        } else if (result.canceled) {
            throw new Error(result.error || 'Safety backup was canceled');
        } else {
            showMessage('error', result.error || 'Failed to import backup');
            throw new Error(result.error || 'Failed to import backup');
        }
    };

    const handleAddRelay = (e) => {
        e.preventDefault();
        const url = newRelayInput.trim();
        if (!url) return;
        if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
            showMessage('error', 'Relay URL must start with wss:// or ws://');
            return;
        }
        if (nostrRelays.includes(url)) {
            showMessage('error', 'Relay already in list');
            return;
        }
        const updated = [...nostrRelays, url];
        setNostrRelays(updated);
        saveConfiguredRelays(updated);
        setNewRelayInput('');
        showMessage('success', 'Relay added successfully!');
    };

    const handleRemoveRelay = (urlToRemove) => {
        if (nostrRelays.length <= 1) {
            showMessage('error', 'At least one relay is required for synchronization');
            return;
        }
        const updated = nostrRelays.filter(r => r !== urlToRemove);
        setNostrRelays(updated);
        saveConfiguredRelays(updated);
        showMessage('success', 'Relay removed');
    };

    const handleResetRelays = () => {
        const defaults = defaultNostrRelays || ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://nostr.mom'];
        setNostrRelays(defaults);
        saveConfiguredRelays(defaults);
        showMessage('success', 'Reset relays to defaults');
    };

    const formatLastSynced = (iso) => {
        if (!iso) return 'Never synced';
        try {
            const date = new Date(iso);
            const now = new Date();
            const diffSeconds = Math.floor((now - date) / 1000);

            if (diffSeconds < 60) return 'Just now';
            if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;

            return date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return iso;
        }
    };

    const getStatusBadge = () => {
        switch (syncStatus) {
            case 'syncing':
                return {
                    label: 'Syncing...',
                    icon: <RefreshCw size={13} className="spin-animation" />,
                    bg: 'hsl(var(--color-accent) / 0.12)',
                    color: 'hsl(var(--color-accent))',
                    border: 'hsl(var(--color-accent) / 0.3)'
                };
            case 'connected':
                return {
                    label: 'Connected',
                    icon: <Check size={13} />,
                    bg: 'hsl(var(--color-success-soft))',
                    color: 'hsl(var(--color-success))',
                    border: 'hsl(var(--color-success) / 0.3)'
                };
            case 'reauth_required':
                return {
                    label: 'Session Expired',
                    icon: <AlertCircle size={13} />,
                    bg: 'hsl(var(--color-warning-soft))',
                    color: 'hsl(var(--color-warning))',
                    border: 'hsl(var(--color-warning) / 0.3)'
                };
            case 'offline':
                return {
                    label: 'Offline',
                    icon: <WifiOff size={13} />,
                    bg: 'hsl(var(--color-warning-soft))',
                    color: 'hsl(var(--color-warning))',
                    border: 'hsl(var(--color-warning) / 0.3)'
                };
            case 'error':
                return {
                    label: 'Sync Issue',
                    icon: <AlertCircle size={13} />,
                    bg: 'hsl(var(--color-danger-soft))',
                    color: 'hsl(var(--color-danger-text))',
                    border: 'hsl(var(--color-danger) / 0.3)'
                };
            case 'disconnected':
            default:
                return {
                    label: 'Not Connected',
                    icon: <Cloud size={13} />,
                    bg: 'hsl(var(--color-surface-dim))',
                    color: 'hsl(var(--color-text-muted))',
                    border: 'hsl(var(--color-border))'
                };
        }
    };

    const statusBadge = getStatusBadge();
    const isPersistedOrAuthed = gdrive.isAuthenticated() || gdrive.isSessionPersisted();
    const isConnected = syncStatus === 'connected' || (syncStatus === 'syncing' && gdrive.isAuthenticated());
    const isReauth = syncStatus === 'reauth_required';
    const showConnectedCard = isPersistedOrAuthed || isConnected || isReauth;
    const userProfile = gdrive.getUserProfile();
    const userDisplay = userProfile?.email || userProfile?.name || 'Connected to Google Drive';

    return (
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'grid', gap: '1.25rem' }}>
            <div className="card">
                {/* Header (desktop only, as TopBar displays Settings title on mobile) */}
                <div className="desktop-only-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    marginBottom: '1.25rem',
                    paddingBottom: '0.85rem',
                    borderBottom: '1px solid hsl(var(--color-border))'
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'hsl(var(--color-surface-dim))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'hsl(var(--color-text-main))'
                    }}>
                        <SettingsIcon size={18} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Preferences & Data</h2>
                    </div>
                </div>

                {/* Status Message */}
                {message && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        marginBottom: '1.25rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: message.type === 'success'
                            ? 'hsl(var(--color-success-soft))'
                            : 'hsl(var(--color-danger-soft))',
                        color: message.type === 'success'
                            ? 'hsl(var(--color-success))'
                            : 'hsl(var(--color-danger-text))',
                        border: `1px solid ${message.type === 'success' ? 'hsl(var(--color-success) / 0.3)' : 'hsl(var(--color-danger) / 0.3)'}`,
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                        <span>{message.text}</span>
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 1: GOOGLE DRIVE CLOUD SYNC */}
                {/* ============================================================== */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                background: 'hsl(var(--color-accent) / 0.15)',
                                color: 'hsl(var(--color-accent))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Cloud size={16} />
                            </div>
                            <label style={{ fontSize: '0.98rem', fontWeight: 800 }}>Cloud Sync (Google Drive)</label>
                        </div>

                        {/* Status Badge */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.25rem 0.65rem',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            background: statusBadge.bg,
                            color: statusBadge.color,
                            border: `1px solid ${statusBadge.border}`
                        }}>
                            {statusBadge.icon}
                            <span>{statusBadge.label}</span>
                        </div>
                    </div>

                    {/* Sync Error Display */}
                    {syncError && (
                        <div style={{
                            padding: '0.65rem 0.85rem',
                            marginBottom: '0.85rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'hsl(var(--color-danger-soft))',
                            color: 'hsl(var(--color-danger-text))',
                            border: '1px solid hsl(var(--color-danger) / 0.3)',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem'
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{syncError}</span>
                        </div>
                    )}

                    {/* When Signed Out */}
                    {!showConnectedCard ? (
                        <div style={{
                            background: 'hsl(var(--color-surface-dim))',
                            border: '1px solid hsl(var(--color-border))',
                            borderRadius: 'var(--radius-md)',
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '0.85rem'
                        }}>
                            <span style={{ fontSize: '0.88rem', color: 'hsl(var(--color-text-muted))' }}>
                                Sign in to back up data and sync shared groups.
                            </span>
                            <button
                                type="button"
                                className="btn"
                                onClick={connectDrive}
                                style={{
                                    background: '#ffffff',
                                    color: '#3c4043',
                                    border: '1px solid #dadce0',
                                    fontWeight: 600,
                                    fontSize: '0.92rem',
                                    padding: '0.6rem 1.25rem',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.65rem',
                                    boxShadow: '0 1px 3px rgba(60,64,67,0.12)',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition-fast)'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                </svg>
                                <span>Sign in with Google</span>
                            </button>
                        </div>
                    ) : (
                        /* When Signed In or Re-auth Required */
                        <div style={{
                            background: 'hsl(var(--color-surface-dim))',
                            border: '1px solid hsl(var(--color-border))',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'hsl(var(--color-text-main))' }}>
                                        {userDisplay}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: isReauth ? 'hsl(var(--color-warning))' : 'hsl(var(--color-text-muted))', marginTop: '0.2rem' }}>
                                        {isReauth ? 'Session expired — tap Reconnect to resume sync' : `Last synced: ${formatLastSynced(lastSyncedAt)}`}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {isReauth ? (
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={connectDrive}
                                            style={{ minHeight: '38px' }}
                                        >
                                            <RefreshCw size={14} />
                                            <span>Reconnect</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={syncNow}
                                            disabled={syncStatus === 'syncing' || syncStatus === 'offline'}
                                            style={{ minHeight: '38px' }}
                                        >
                                            <RefreshCw size={14} className={syncStatus === 'syncing' ? 'spin-animation' : ''} />
                                            <span>{syncStatus === 'syncing' ? 'Syncing...' : (syncStatus === 'error' ? 'Retry Sync' : 'Sync Now')}</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={disconnectDrive}
                                        style={{ minHeight: '38px', color: 'hsl(var(--color-danger-text))' }}
                                    >
                                        <LogOut size={14} />
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            </div>

                            {/* Auto-Sync Toggle Row */}
                            <div style={{
                                marginTop: '0.9rem',
                                paddingTop: '0.85rem',
                                borderTop: '1px solid hsl(var(--color-border-subtle))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.75rem'
                            }}>
                                <label
                                    htmlFor="auto-sync-toggle"
                                    style={{ fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Auto-sync changes
                                </label>

                                <label style={{
                                    position: 'relative',
                                    display: 'inline-block',
                                    width: '46px',
                                    height: '26px',
                                    flexShrink: 0,
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        id="auto-sync-toggle"
                                        type="checkbox"
                                        checked={isAutoSyncEnabled}
                                        onChange={(e) => setIsAutoSyncEnabled(e.target.checked)}
                                        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        cursor: 'pointer',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: isAutoSyncEnabled ? 'hsl(var(--color-accent))' : 'hsl(var(--color-border))',
                                        borderRadius: '26px',
                                        transition: 'all var(--transition-fast)'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '""',
                                            height: '20px',
                                            width: '20px',
                                            left: isAutoSyncEnabled ? '23px' : '3px',
                                            bottom: '3px',
                                            backgroundColor: 'white',
                                            borderRadius: '50%',
                                            transition: 'all var(--transition-fast)',
                                            boxShadow: 'var(--shadow-xs)'
                                        }} />
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* ============================================================== */}
                {/* SECTION 2: ACTIVE CURRENCY */}
                {/* ============================================================== */}
                <div style={{ paddingTop: '1.25rem', borderTop: '1px solid hsl(var(--color-border-subtle))', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                        <Coins size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                        <label style={{ fontSize: '0.92rem', fontWeight: 700 }}>Active Currency</label>
                    </div>
                    <select
                        className="input"
                        value={state.currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        style={{ maxWidth: '320px', padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                    >
                        {Object.entries(currencies).map(([code, { symbol, name }]) => (
                            <option key={code} value={code}>
                                {symbol} — {name} ({code})
                            </option>
                        ))}
                    </select>
                </div>

                {/* ============================================================== */}
                {/* SECTION 3: DATA BACKUP & RESTORE */}
                {/* ============================================================== */}
                <div style={{ paddingTop: '1.25rem', borderTop: '1px solid hsl(var(--color-border-subtle))', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Database size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                        <label style={{ fontSize: '0.92rem', fontWeight: 700 }}>Data Backup & Restore</label>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleExport}
                        >
                            <Download size={15} />
                            <span>Export Backup JSON</span>
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleImportClick}
                        >
                            <Upload size={15} />
                            <span>Import Backup JSON</span>
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json,application/json,text/plain,*/*"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 4: MULTI-USER GROUP SYNC (PUBLIC NOSTR RELAYS) */}
                {/* ============================================================== */}
                <div style={{ paddingTop: '1.25rem', borderTop: '1px solid hsl(var(--color-border-subtle))', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Radio size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                            <label style={{ fontSize: '0.92rem', fontWeight: 700 }}>Multi-User Relays</label>
                        </div>
                        <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            background: 'hsl(var(--color-success-soft))',
                            color: 'hsl(var(--color-success))',
                            border: '1px solid hsl(var(--color-success) / 0.3)'
                        }}>
                            Zero-Server • E2EE
                        </span>
                    </div>

                    {/* Relay List */}
                    <div style={{
                        display: 'grid',
                        gap: '0.45rem',
                        marginBottom: '0.75rem',
                        background: 'hsl(var(--color-surface-dim))',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid hsl(var(--color-border-subtle))'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--color-text-muted))' }}>
                                Active Relays ({nostrRelays.length})
                            </span>
                            <button
                                type="button"
                                onClick={handleResetRelays}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'hsl(var(--color-accent))',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: 0
                                }}
                            >
                                Reset to Defaults
                            </button>
                        </div>

                        {nostrRelays.map((relay) => (
                            <div
                                key={relay}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'hsl(var(--color-surface))',
                                    border: '1px solid hsl(var(--color-border-subtle))',
                                    fontSize: '0.82rem',
                                    fontFamily: 'monospace'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                    <span style={{
                                        display: 'inline-block',
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: 'hsl(var(--color-success))',
                                        flexShrink: 0
                                    }} />
                                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        {relay}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveRelay(relay)}
                                    className="btn-icon"
                                    title="Remove Relay"
                                    style={{ padding: '0.2rem', color: 'hsl(var(--color-danger-text))' }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add Relay Input Form */}
                    <form onSubmit={handleAddRelay} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="wss://relay.example.com"
                            value={newRelayInput}
                            onChange={(e) => setNewRelayInput(e.target.value)}
                            style={{ flex: 1, fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}
                        />
                        <button
                            type="submit"
                            className="btn btn-secondary btn-sm"
                            disabled={!newRelayInput.trim()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                            <Plus size={14} />
                            <span>Add Relay</span>
                        </button>
                    </form>
                </div>

                {/* ============================================================== */}
                {/* SECTION 5: ANDROID APP UPDATES & OBTAINIUM */}
                {/* ============================================================== */}
                <div style={{ paddingTop: '1.25rem', borderTop: '1px solid hsl(var(--color-border-subtle))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Smartphone size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                        <label style={{ fontSize: '0.92rem', fontWeight: 700 }}>Android Updates</label>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <a
                            href="https://apps.obtainium.imranr.dev/redirect?r=obtainium%3A%2F%2Fapp%2F%257B%2522id%2522%253A%2522com.splitit.expensemanager%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fgithub.com%252FHowlingWolf9%252Fsplitit%2522%252C%2522author%2522%253A%2522HowlingWolf9%2522%252C%2522name%2522%253A%2522SplitIt%2522%257D"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                            <Smartphone size={15} />
                            <span>Add to Obtainium</span>
                        </a>

                        <a
                            href="https://github.com/HowlingWolf9/splitit/releases/latest"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                            <ExternalLink size={15} />
                            <span>GitHub Releases</span>
                        </a>
                    </div>
                </div>
            </div>

            {pendingBackup && (
                <ImportBackupModal
                    isOpen={Boolean(pendingBackup)}
                    backupData={pendingBackup.data}
                    filename={pendingBackup.filename}
                    onClose={() => setPendingBackup(null)}
                    onConfirm={handleConfirmImport}
                />
            )}
        </div>
    );
}
