import React from 'react';

export default function PayerSelector({ 
    users, 
    payerMode, setPayerMode, 
    singlePayer, setSinglePayer, 
    multiPayers, setMultiPayers,
    totalAmount, currentPayerTotal, isPayerValid
}) {
    const toggleContainerStyle = { display: 'flex', background: 'hsl(var(--color-bg))', borderRadius: 'var(--radius-sm)', padding: '2px', gap: '2px' };
    const toggleBtnStyle = (isActive) => ({
        flex: 1,
        padding: '0.25rem 0.75rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.85rem',
        fontWeight: isActive ? 600 : 400,
        background: isActive ? 'hsl(var(--color-primary))' : 'transparent',
        color: isActive ? 'hsl(var(--color-text-inverted))' : 'hsl(var(--color-text-muted))',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all var(--transition-fast)'
    });

    return (
        <div style={{ padding: '1rem', border: '1px solid hsl(var(--color-text-muted) / 0.2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 600 }}>Who Paid?</span>
                <div style={toggleContainerStyle}>
                    <div onClick={() => setPayerMode('SINGLE')} style={toggleBtnStyle(payerMode === 'SINGLE')}>Single</div>
                    <div onClick={() => setPayerMode('MULTI')} style={toggleBtnStyle(payerMode === 'MULTI')}>Multi</div>
                </div>
            </div>

            {payerMode === 'SINGLE' && (
                <select className="input" value={singlePayer} onChange={e => setSinglePayer(e.target.value)}>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            )}

            {payerMode === 'MULTI' && (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {users.map(u => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '100px', fontSize: '0.9rem' }}>{u.name}</span>
                            <input
                                className="input"
                                type="number"
                                step="0.01"
                                value={multiPayers[u.id] || ''}
                                onChange={e => setMultiPayers({ ...multiPayers, [u.id]: e.target.value })}
                                placeholder="0.00"
                                style={{ padding: '0.4rem' }}
                            />
                        </div>
                    ))}
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.5rem', color: isPayerValid ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))' }}>
                        Entered: {currentPayerTotal.toFixed(2)} / {(parseFloat(totalAmount)||0).toFixed(2)}
                    </div>
                </div>
            )}
        </div>
    );
}
