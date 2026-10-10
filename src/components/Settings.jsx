import React, { useRef, useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { Settings as SettingsIcon, Download, Upload, Check, AlertCircle, Database, Coins } from 'lucide-react';

export default function Settings() {
    const { state, setCurrency, currencies, exportData, importData } = useExpenses();
    const fileInputRef = useRef(null);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }

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

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    return (
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'grid', gap: '1.25rem' }}>
            <div className="card">
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
                            Configure global currency and manage database backups
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

                {/* Currency Section */}
                <div style={{ marginBottom: '2rem' }}>
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

                {/* Data Backup & Restore */}
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
            </div>
        </div>
    );
}
