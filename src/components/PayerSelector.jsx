import React from 'react';

export default function PayerSelector({ 
    users, 
    payerMode, setPayerMode, 
    singlePayer, setSinglePayer, 
    multiPayers, setMultiPayers,
    totalAmount, currentPayerTotal, isPayerValid
}) {
    const toggleContainerStyle = {
        display: 'flex',
        background: 'hsl(var(--color-bg))',
        borderRadius: 'var(--radius-md)',
        padding: '3px',
        gap: '3px',
        border: '1px solid hsl(var(--color-border))'
    };

    const toggleBtnStyle = (isActive) => ({
        flex: 1,
        minHeight: '44px',
        padding: '0.45rem 1rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.85rem',
        fontWeight: isActive ? 700 : 500,
        background: isActive ? 'hsl(var(--color-primary))' : 'transparent',
        color: isActive ? 'hsl(var(--color-text-inverted))' : 'hsl(var(--color-text-muted))',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all var(--transition-fast)',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none'
    });

    return (
        <div style={{ padding: '1rem', border: '1px solid hsl(var(--color-border))', borderRadius: 'var(--radius-md)', background: 'hsl(var(--color-surface))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Who Paid?</span>
                <div style={toggleContainerStyle}>
                    <button type="button" onClick={() => setPayerMode('SINGLE')} style={toggleBtnStyle(payerMode === 'SINGLE')}>Single</button>
                    <button type="button" onClick={() => setPayerMode('MULTI')} style={toggleBtnStyle(payerMode === 'MULTI')}>Multiple</button>
                </div>
            </div>

            {payerMode === 'SINGLE' && (
                <select
                    className="input"
                    value={singlePayer}
                    onChange={e => setSinglePayer(e.target.value)}
                    style={{ minHeight: '48px', fontSize: '0.95rem' }}
                >
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            )}

            {payerMode === 'MULTI' && (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {users.map(u => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minHeight: '44px' }}>
                            <span style={{ width: '110px', fontSize: '0.92rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {u.name}
                            </span>
                            <input
                                className="input"
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                value={multiPayers[u.id] || ''}
                                onChange={e => setMultiPayers({ ...multiPayers, [u.id]: e.target.value })}
                                placeholder="0.00"
                                style={{ minHeight: '44px', padding: '0.5rem 0.75rem' }}
                            />
                        </div>
                    ))}
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, marginTop: '0.5rem', color: isPayerValid ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))' }}>
                        Entered: {currentPayerTotal.toFixed(2)} / {(parseFloat(totalAmount)||0).toFixed(2)}
                    </div>
                </div>
            )}
        </div>
    );
}
