import React, { useRef, useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { Settings as SettingsIcon, Download, Upload } from 'lucide-react';

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
            const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            link.href = url;
            link.download = `expense-manager-backup-${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showMessage('success', 'Data exported successfully!');
        } catch (error) {
            showMessage('error', 'Failed to export data');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Confirm before importing
        if (!window.confirm('⚠️ Importing will replace all current data. Are you sure you want to continue?')) {
            event.target.value = ''; // Reset file input
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
        } catch (error) {
            showMessage('error', 'Failed to read file');
        }

        event.target.value = ''; // Reset file input
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    return (
        <div className="card">
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--color-text-muted) / 0.2)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SettingsIcon size={20} />
                Settings
            </h3>

            {/* Message Display */}
            {message && (
                <div style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: message.type === 'success'
                        ? 'hsl(120, 60%, 95%)'
                        : 'hsl(0, 60%, 95%)',
                    color: message.type === 'success'
                        ? 'hsl(120, 50%, 30%)'
                        : 'hsl(0, 50%, 40%)',
                    border: `1px solid ${message.type === 'success'
                        ? 'hsl(120, 50%, 80%)'
                        : 'hsl(0, 50%, 80%)'}`,
                    fontSize: '0.9rem'
                }}>
                    {message.text}
                </div>
            )}

            {/* Currency Setting */}
            <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Currency</span>
                </label>
                <select
                    className="input"
                    value={state.currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    style={{ maxWidth: '300px' }}
                >
                    {Object.entries(currencies).map(([code, { symbol, name }]) => (
                        <option key={code} value={code}>
                            {symbol} {name} ({code})
                        </option>
                    ))}
                </select>
            </div>

            {/* Import/Export Section */}
            <div>
                <h4 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: 'hsl(var(--color-text))'
                }}>
                    Data Management
                </h4>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        className="btn"
                        onClick={handleExport}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Download size={18} />
                        Export Data
                    </button>

                    <button
                        className="btn btn-secondary"
                        onClick={handleImportClick}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Upload size={18} />
                        Import Data
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                </div>

                <p style={{
                    margin: '0.75rem 0 0 0',
                    fontSize: '0.8rem',
                    color: 'hsl(var(--color-text-muted))'
                }}>
                    Export your data for backup or import previously exported data. ⚠️ Importing will replace all current data.
                </p>
            </div>
        </div>
    );
}
