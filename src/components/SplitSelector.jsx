import React from 'react';

export default function SplitSelector({
    users, getSplits,
    splitMode, setSplitMode,
    splitSelected, setSplitSelected,
    splitShares, setSplitShares,
    splitAmounts, setSplitAmounts,
    splitAmountsManual, setSplitAmountsManual,
    addUser
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
                <span style={{ fontWeight: 600 }}>Split How?</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => {
                            const allSelected = {};
                            users.forEach(u => allSelected[u.id] = true);
                            setSplitSelected(allSelected);
                        }}
                        style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            background: 'hsl(var(--color-success) / 0.1)',
                            color: 'hsl(var(--color-success))',
                            border: '1px solid hsl(var(--color-success) / 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer'
                        }}
                    >
                        Select All
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const noneSelected = {};
                            users.forEach(u => noneSelected[u.id] = false);
                            setSplitSelected(noneSelected);
                        }}
                        style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            background: 'hsl(var(--color-danger) / 0.1)',
                            color: 'hsl(var(--color-danger))',
                            border: '1px solid hsl(var(--color-danger) / 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer'
                        }}
                    >
                        Deselect All
                    </button>
                    <div style={toggleContainerStyle}>
                        <div onClick={() => setSplitMode('EQUAL')} style={toggleBtnStyle(splitMode === 'EQUAL')}>Equally</div>
                        <div onClick={() => setSplitMode('SHARES')} style={toggleBtnStyle(splitMode === 'SHARES')}>Shares</div>
                        <div onClick={() => setSplitMode('EXACT_AMOUNTS')} style={toggleBtnStyle(splitMode === 'EXACT_AMOUNTS')}>Amounts</div>
                    </div>
                </div>
            </div>

            {users.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', padding: '0.25rem 0' }}>
                    <input
                        type="checkbox"
                        checked={splitSelected[u.id] || false}
                        onChange={e => setSplitSelected({ ...splitSelected, [u.id]: e.target.checked })}
                        style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.75rem', cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, fontWeight: 500 }}>{u.name}</span>

                    {splitSelected[u.id] && splitMode === 'SHARES' && (
                        <input
                            type="number"
                            value={splitShares[u.id] || ''}
                            onChange={e => setSplitShares({ ...splitShares, [u.id]: e.target.value })}
                            style={{ width: '60px', padding: '0.25rem', marginRight: '0.5rem' }}
                            placeholder="Shares"
                        />
                    )}

                    {splitSelected[u.id] && splitMode === 'EXACT_AMOUNTS' && (
                        <input
                            type="number"
                            step="0.01"
                            value={splitAmounts[u.id] || ''}
                            onChange={e => {
                                setSplitAmounts({ ...splitAmounts, [u.id]: e.target.value });
                                setSplitAmountsManual({ ...splitAmountsManual, [u.id]: true });
                            }}
                            style={{ width: '80px', padding: '0.25rem', marginRight: '0.5rem' }}
                            placeholder="Auto"
                        />
                    )}

                    {splitSelected[u.id] && splitMode !== 'EXACT_AMOUNTS' && (
                        <span style={{ fontSize: '0.9rem', color: 'hsl(var(--color-text-muted))' }}>
                            {(getSplits().find(s => s.userId === u.id)?.amount || 0).toFixed(2)}
                        </span>
                    )}

                    {splitSelected[u.id] && splitMode === 'EXACT_AMOUNTS' && !splitAmountsManual[u.id] && (
                        <span style={{ fontSize: '0.9rem', color: 'hsl(var(--color-success))', fontStyle: 'italic' }}>
                            {(getSplits().find(s => s.userId === u.id)?.amount || 0).toFixed(2)}
                        </span>
                    )}
                </div>
            ))}

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid hsl(var(--color-text-muted) / 0.1)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Add new member..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const name = e.target.value.trim();
                                if (name) {
                                    addUser(name);
                                    e.target.value = '';
                                }
                            }
                        }}
                        style={{
                            flex: 1,
                            padding: '0.5rem',
                            fontSize: '0.85rem',
                            border: '1px solid hsl(var(--color-text-muted) / 0.2)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'hsl(var(--color-surface-dim))',
                            color: 'hsl(var(--color-text-main))'
                        }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))' }}>Press Enter</span>
                </div>
            </div>
        </div>
    );
}
