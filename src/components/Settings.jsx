import React, { useRef, useState, useEffect } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { useModalBackHandler } from '../utils/backButton';
import * as gdrive from '../services/googleDriveSync';
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
    ChevronDown,
    ChevronUp,
    Key,
    HelpCircle,
    X,
    WifiOff,
    ShieldCheck,
    Radio,
    Trash2,
    Plus
} from 'lucide-react';

export default function Settings() {
    const {
        state,
        setCurrency,
        currencies,
        exportData,
        importData,
        syncStatus,
        syncError,
        lastSyncedAt,
        isAutoSyncEnabled,
        setIsAutoSyncEnabled,
        customClientId,
        setCustomClientId,
        syncNow,
        connectDrive,
        disconnectDrive,
        saveManualToken,
        getConfiguredRelays,
        saveConfiguredRelays,
        defaultNostrRelays
    } = useExpenses();

    const fileInputRef = useRef(null);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }

    // Nostr Relay configuration state
    const [nostrRelays, setNostrRelays] = useState(() => getConfiguredRelays?.() || []);
    const [newRelayInput, setNewRelayInput] = useState('');

    // Advanced section accordion
    const [advancedOpen, setAdvancedOpen] = useState(false);

    // Guide Modal
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    useModalBackHandler(isGuideOpen, () => setIsGuideOpen(false));

    // Custom Client ID input state
    const [clientIdInput, setClientIdInput] = useState(customClientId || '');
    const [clientIdSaved, setClientIdSaved] = useState(false);


    // Manual token input state
    const [manualTokenInput, setManualTokenInput] = useState('');
    const [manualTokenHours, setManualTokenHours] = useState('1');
    const [manualTokenTesting, setManualTokenTesting] = useState(false);
    const [tokenInfo, setTokenInfo] = useState(() => gdrive.getTokenInfo());

    // Update token info periodically on timer
    useEffect(() => {
        const timer = setInterval(() => {
            setTokenInfo(gdrive.getTokenInfo());
        }, 15000);
        return () => clearInterval(timer);
    }, [syncStatus]);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleExport = () => {
        try {
            const jsonData = exportData();
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            link.href = url;
            link.download = `splitit-backup-${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showMessage('success', 'Data exported successfully!');
        } catch {
            showMessage('error', 'Failed to export data');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm('⚠️ Importing will replace all existing data. Are you sure you want to proceed?')) {
            event.target.value = '';
            return;
        }

        try {
            const text = await file.text();
            const result = importData(text);

            if (result.success) {
                showMessage('success', 'Data imported successfully!');
            } else {
                showMessage('error', result.error || 'Failed to import data');
            }
        } catch {
            showMessage('error', 'Failed to read file');
        }

        event.target.value = '';
    };

    const handleSaveClientId = (e) => {
        e.preventDefault();
        setCustomClientId(clientIdInput.trim());
        setClientIdSaved(true);
        setTimeout(() => setClientIdSaved(false), 3000);
        showMessage('success', 'OAuth Client ID saved successfully!');
    };

    const handleResetClientId = () => {
        setClientIdInput('');
        setCustomClientId('');
        showMessage('success', 'Reset to SplitIt default Client ID');
    };

    const handleSaveManualToken = async (e) => {
        e.preventDefault();
        if (!manualTokenInput.trim()) {
            showMessage('error', 'Please enter a valid access token');
            return;
        }
        setManualTokenTesting(true);
        const hours = parseFloat(manualTokenHours) || 1;
        const res = await saveManualToken(manualTokenInput.trim(), hours);
        setManualTokenTesting(false);

        if (res.success) {
            setManualTokenInput('');
            showMessage('success', 'Access token saved and verified with Google Drive!');
        } else {
            showMessage('error', `Token test failed: ${res.error}`);
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

    // Status badge configuration
    const getStatusBadge = () => {
        switch (syncStatus) {
            case 'syncing':
                return {
                    label: 'Syncing with Drive...',
                    icon: <RefreshCw size={13} className="spin-animation" />,
                    bg: 'hsl(var(--color-accent) / 0.12)',
                    color: 'hsl(var(--color-accent))',
                    border: 'hsl(var(--color-accent) / 0.3)'
                };
            case 'connected':
                return {
                    label: 'Connected to Google Drive',
                    icon: <Check size={13} />,
                    bg: 'hsl(var(--color-success-soft))',
                    color: 'hsl(var(--color-success))',
                    border: 'hsl(var(--color-success) / 0.3)'
                };
            case 'offline':
                return {
                    label: 'Offline — Sync Paused',
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

    return (
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'grid', gap: '1.25rem' }}>
            <div className="card">
                {/* Header */}
                <div style={{
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
                        <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                            Configure global currency, cloud sync, and database backups
                        </span>
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
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.45rem' }}>
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

                    <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))', lineHeight: 1.45 }}>
                        100% client-side, zero-server cross-device sync. Data is encrypted and stored in your private, hidden Google Drive application folder (<code>splitit_appdata_v1.json</code>).
                    </p>

                    {/* Sync Error Display */}
                    {syncError && (
                        <div style={{
                            padding: '0.65rem 0.85rem',
                            marginBottom: '1rem',
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
                            <div>
                                <strong style={{ display: 'block', marginBottom: '2px' }}>Sync Notice</strong>
                                <span>{syncError}</span>
                            </div>
                        </div>
                    )}

                    {/* Sync Status Info Card */}
                    <div style={{
                        background: 'hsl(var(--color-surface-dim))',
                        border: '1px solid hsl(var(--color-border))',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div>
                                <div style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                                    Sync Metadata
                                </div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '0.2rem', color: 'hsl(var(--color-text-main))' }}>
                                    Last synced: {formatLastSynced(lastSyncedAt)}
                                </div>
                                {tokenInfo.hasToken && !tokenInfo.isExpired && (
                                    <div style={{ fontSize: '0.76rem', color: 'hsl(var(--color-success))', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <ShieldCheck size={13} />
                                        <span>OAuth token active ({tokenInfo.minutesRemaining}m remaining)</span>
                                    </div>
                                )}
                            </div>

                            {/* Main Sync Actions */}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {syncStatus === 'disconnected' ? (
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={connectDrive}
                                        style={{ minHeight: '38px' }}
                                    >
                                        <Cloud size={15} />
                                        <span>Connect Google Drive</span>
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={syncNow}
                                            disabled={syncStatus === 'syncing' || syncStatus === 'offline'}
                                            style={{ minHeight: '38px' }}
                                            title="Perform full pull, merge, and upload"
                                        >
                                            <RefreshCw size={14} className={syncStatus === 'syncing' ? 'spin-animation' : ''} />
                                            <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={disconnectDrive}
                                            style={{ minHeight: '38px', color: 'hsl(var(--color-danger-text))' }}
                                            title="Disconnect Google Drive"
                                        >
                                            <LogOut size={14} />
                                            <span>Disconnect</span>
                                        </button>
                                    </>
                                )}
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
                            <div>
                                <label
                                    htmlFor="auto-sync-toggle"
                                    style={{ fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', display: 'block' }}
                                >
                                    Auto-sync on changes
                                </label>
                                <span style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))', display: 'block', marginTop: '1px' }}>
                                    Debounced 3s after mutations, plus automatic pull on app launch / focus
                                </span>
                            </div>

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

                    {/* Expandable "Self-Hosted OAuth & Advanced" Section */}
                    <div style={{
                        border: '1px solid hsl(var(--color-border))',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden'
                    }}>
                        <button
                            type="button"
                            onClick={() => setAdvancedOpen(!advancedOpen)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                background: 'hsl(var(--color-surface))',
                                cursor: 'pointer',
                                border: 'none',
                                textAlign: 'left'
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 700 }}>
                                <Key size={15} style={{ color: 'hsl(var(--color-accent))' }} />
                                <span>Self-Hosted OAuth & Advanced Credentials</span>
                            </span>
                            {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {advancedOpen && (
                            <div style={{
                                padding: '1rem',
                                background: 'hsl(var(--color-surface-dim))',
                                borderTop: '1px solid hsl(var(--color-border-subtle))',
                                display: 'grid',
                                gap: '1.25rem'
                            }}>
                                {/* Custom Client ID */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                                            Custom Google Cloud Client ID
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsGuideOpen(true)}
                                            style={{
                                                fontSize: '0.76rem',
                                                color: 'hsl(var(--color-accent))',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                textDecoration: 'underline',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <HelpCircle size={13} />
                                            <span>Setup Guide</span>
                                        </button>
                                    </div>
                                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.76rem', color: 'hsl(var(--color-text-muted))' }}>
                                        Use your own Google Cloud OAuth 2.0 Web Client ID for complete self-hosted independence, or leave empty for default.
                                    </p>

                                    <form onSubmit={handleSaveClientId} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <input
                                            type="text"
                                            className="input"
                                            value={clientIdInput}
                                            onChange={(e) => setClientIdInput(e.target.value)}
                                            placeholder="e.g. 12345-xxx.apps.googleusercontent.com"
                                            style={{ flex: 1, minWidth: '220px', fontSize: '0.84rem' }}
                                        />
                                        <button type="submit" className="btn btn-secondary btn-sm">
                                            {clientIdSaved ? <Check size={14} /> : null}
                                            <span>Save ID</span>
                                        </button>
                                        {customClientId && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                onClick={handleResetClientId}
                                                style={{ fontSize: '0.78rem' }}
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </form>
                                </div>

                                {/* Manual Access Token Input */}
                                <div style={{ paddingTop: '1rem', borderTop: '1px solid hsl(var(--color-border-subtle))' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                                        Manual Access Token (Direct Entry)
                                    </label>
                                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.76rem', color: 'hsl(var(--color-text-muted))' }}>
                                        Paste a valid OAuth Bearer access token directly (useful for restricted PC networks, Android debug, or OAuth Playground tokens).
                                    </p>

                                    <form onSubmit={handleSaveManualToken} style={{ display: 'grid', gap: '0.5rem' }}>
                                        <textarea
                                            className="input"
                                            rows={2}
                                            value={manualTokenInput}
                                            onChange={(e) => setManualTokenInput(e.target.value)}
                                            placeholder="ya29.a0AfH6S..."
                                            style={{ width: '100%', fontSize: '0.8rem', fontFamily: 'var(--font-family-mono)' }}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <span style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))' }}>Duration:</span>
                                                <select
                                                    className="input"
                                                    value={manualTokenHours}
                                                    onChange={(e) => setManualTokenHours(e.target.value)}
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', minHeight: '32px' }}
                                                >
                                                    <option value="1">1 Hour</option>
                                                    <option value="4">4 Hours</option>
                                                    <option value="8">8 Hours</option>
                                                    <option value="24">24 Hours</option>
                                                </select>
                                            </div>

                                            <button
                                                type="submit"
                                                className="btn btn-primary btn-sm"
                                                disabled={manualTokenTesting}
                                                style={{ minHeight: '34px' }}
                                            >
                                                {manualTokenTesting ? <RefreshCw size={13} className="spin-animation" /> : <Check size={13} />}
                                                <span>{manualTokenTesting ? 'Verifying...' : 'Save & Verify Token'}</span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 2: ACTIVE CURRENCY */}
                {/* ============================================================== */}
                <div style={{ paddingTop: '1.5rem', borderTop: '1px solid hsl(var(--color-border-subtle))', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Coins size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                        <label style={{ fontSize: '0.92rem', fontWeight: 700 }}>Active Currency</label>
                    </div>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                        Choose the primary currency symbol used across all calculations and expense summaries.
                    </p>
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
                <div style={{ paddingTop: '1.5rem', borderTop: '1px solid hsl(var(--color-border-subtle))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Database size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                        <label style={{ fontSize: '0.92rem', fontWeight: 700 }}>Data Backup & Restore</label>
                    </div>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                        Download a full snapshot of your groups, users, and transactions, or restore from a previous JSON backup file.
                    </p>

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
                            accept=".json"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 4: MULTI-USER GROUP SYNC (PUBLIC NOSTR RELAYS) */}
                {/* ============================================================== */}
                <div style={{ paddingTop: '1.5rem', borderTop: '1px solid hsl(var(--color-border-subtle))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Radio size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                            <label style={{ fontSize: '0.92rem', fontWeight: 700 }}>Multi-User Group Sync (Public Nostr Relays)</label>
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
                    <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))', lineHeight: 1.5 }}>
                        Shared groups synchronize peer-to-peer using end-to-end encrypted events over free public Nostr relays with $0 server cost. Relays only ever see opaque AES-GCM ciphertext. You can customize which relays your device connects to below.
                    </p>

                    {/* Relay List */}
                    <div style={{
                        display: 'grid',
                        gap: '0.45rem',
                        marginBottom: '1rem',
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
                <div style={{ paddingTop: '1.5rem', borderTop: '1px solid hsl(var(--color-border-subtle))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Smartphone size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                        <label style={{ fontSize: '0.92rem', fontWeight: 700 }}>Android Updates & Obtainium</label>
                    </div>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                        Install and receive automatic background updates for SplitIt directly from GitHub Releases using Obtainium.
                    </p>

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

            {/* ============================================================== */}
            {/* OAUTH SETUP GUIDE MODAL (REGISTERED WITH HARDWARE BACK BUTTON) */}
            {/* ============================================================== */}
            {isGuideOpen && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsGuideOpen(false);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '540px', padding: '1.5rem' }}>
                        <div className="bottom-sheet-handle" />
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1rem',
                            paddingBottom: '0.65rem',
                            borderBottom: '1px solid hsl(var(--color-border-subtle))'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Key size={18} style={{ color: 'hsl(var(--color-accent))' }} />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Create Your Google OAuth Client</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsGuideOpen(false)}
                                className="btn-icon"
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ fontSize: '0.86rem', lineHeight: 1.6, color: 'hsl(var(--color-text-main))', display: 'grid', gap: '0.85rem' }}>
                            <p style={{ margin: 0 }}>
                                You can generate your own 100% free Google Cloud OAuth 2.0 Client ID in 3 easy steps:
                            </p>

                            <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'grid', gap: '0.6rem' }}>
                                <li>
                                    <strong>Open Google Cloud Console:</strong> Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--color-accent))', textDecoration: 'underline' }}>console.cloud.google.com/apis/credentials</a> and select or create a project.
                                </li>
                                <li>
                                    <strong>Enable Google Drive API:</strong> In the API Library, search for <em>Google Drive API</em> and click <strong>Enable</strong>.
                                </li>
                                <li>
                                    <strong>Create Credentials:</strong>
                                    <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem', fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                                        <li>Click <strong>Create Credentials &gt; OAuth client ID</strong></li>
                                        <li>Application type: <strong>Web application</strong></li>
                                        <li>Authorized JavaScript origins: add <code>http://localhost</code> and <code>https://localhost</code> (plus your web URL if hosted)</li>
                                        <li>Authorized redirect URIs: add <code>http://localhost</code> and <code>https://localhost</code></li>
                                    </ul>
                                </li>
                                <li>
                                    <strong>Copy Client ID:</strong> Paste the generated Client ID (ending in <code>.apps.googleusercontent.com</code>) into the field above and click <strong>Save ID</strong>!
                                </li>
                            </ol>

                            <div style={{
                                padding: '0.75rem',
                                background: 'hsl(var(--color-accent) / 0.1)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid hsl(var(--color-accent) / 0.25)',
                                fontSize: '0.78rem',
                                color: 'hsl(var(--color-text-main))'
                            }}>
                                💡 <strong>Tip:</strong> SplitIt only accesses the private hidden <code>appDataFolder</code>. It cannot view, modify, or read any of your personal Google Drive files.
                            </div>
                        </div>

                        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setIsGuideOpen(false)}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
