import React from 'react';

export default function SplitSelector({
    users,
    getSplits,
    splitMode,
    setSplitMode,
    splitSelected,
    setSplitSelected,
    splitShares,
    setSplitShares,
    splitAmounts,
    setSplitAmounts,
    splitAmountsManual,
    setSplitAmountsManual,
    addUser,
    totalAmount = 0,
    currency = 'INR',
    isSplitValid = true
}) {
    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'INR'
        }).format(val || 0);
    };

    const toggleContainerStyle = {
        display: 'flex',
        background: 'hsl(var(--color-bg))',
        borderRadius: 'var(--radius-sm)',
        padding: '2px',
        gap: '2px'
    };

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

    const splits = getSplits();
    const currentSplitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
    const selectedUsers = users.filter(u => splitSelected[u.id] !== undefined ? splitSelected[u.id] : true);
    const remainingDiff = Math.round((totalAmount - currentSplitTotal) * 100) / 100;

    return (
        <div style={{ padding: '1rem', border: '1px solid hsl(var(--color-text-muted) / 0.2)', borderRadius: 'var(--radius-md)' }}>
            {/* Header: Title and Mode Toggles */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>Split How?</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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

            {/* Members List */}
            {users.map(u => {
                const isSelected = splitSelected[u.id] !== undefined ? splitSelected[u.id] : true;
                const userSplit = splits.find(s => s.userId === u.id);
                const assignedAmount = userSplit ? userSplit.amount : 0;
                const isManual = !!splitAmountsManual[u.id];

                return (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', padding: '0.25rem 0', gap: '0.5rem' }}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => setSplitSelected({ ...splitSelected, [u.id]: e.target.checked })}
                            style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ flex: 1, fontWeight: 500, opacity: isSelected ? 1 : 0.45 }}>{u.name}</span>

                        {isSelected && splitMode === 'SHARES' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={splitShares[u.id] !== undefined ? splitShares[u.id] : 1}
                                    onChange={e => setSplitShares({ ...splitShares, [u.id]: e.target.value })}
                                    style={{
                                        width: '75px',
                                        padding: '0.3rem 0.45rem',
                                        fontSize: '0.85rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid hsl(var(--color-border))',
                                        background: 'hsl(var(--color-surface))',
                                        color: 'hsl(var(--color-text-main))'
                                    }}
                                    placeholder="Shares"
                                />
                                <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))', minWidth: '70px', textAlign: 'right' }}>
                                    {formatMoney(assignedAmount)}
                                </span>
                            </div>
                        )}

                        {isSelected && splitMode === 'EXACT_AMOUNTS' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={splitAmounts[u.id] !== undefined ? splitAmounts[u.id] : ''}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setSplitAmounts({ ...splitAmounts, [u.id]: val });
                                        if (val.trim() === '') {
                                            const next = { ...splitAmountsManual };
                                            delete next[u.id];
                                            setSplitAmountsManual(next);
                                        } else {
                                            setSplitAmountsManual({ ...splitAmountsManual, [u.id]: true });
                                        }
                                    }}
                                    style={{
                                        width: '95px',
                                        padding: '0.3rem 0.5rem',
                                        fontSize: '0.85rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: isManual ? '1px solid hsl(var(--color-accent))' : '1px solid hsl(var(--color-border))',
                                        background: 'hsl(var(--color-surface))',
                                        color: 'hsl(var(--color-text-main))'
                                    }}
                                    placeholder="Auto"
                                />

                                {isManual ? (
                                    <button
                                        type="button"
                                        title="Click to reset to auto-split"
                                        onClick={() => {
                                            const nextAmounts = { ...splitAmounts };
                                            delete nextAmounts[u.id];
                                            setSplitAmounts(nextAmounts);
                                            const nextManual = { ...splitAmountsManual };
                                            delete nextManual[u.id];
                                            setSplitAmountsManual(nextManual);
                                        }}
                                        style={{
                                            fontSize: '0.72rem',
                                            padding: '0.2rem 0.45rem',
                                            background: 'hsl(var(--color-surface-dim))',
                                            color: 'hsl(var(--color-accent))',
                                            border: '1px solid hsl(var(--color-accent) / 0.3)',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            fontWeight: 600
                                        }}
                                    >
                                        Auto
                                    </button>
                                ) : (
                                    <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-success))', fontStyle: 'italic', minWidth: '65px', textAlign: 'right' }}>
                                        {formatMoney(assignedAmount)}
                                    </span>
                                )}
                            </div>
                        )}

                        {isSelected && splitMode === 'EQUAL' && (
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--color-text-muted))', minWidth: '70px', textAlign: 'right' }}>
                                {formatMoney(assignedAmount)}
                            </span>
                        )}
                    </div>
                );
            })}

            {/* Dynamic Status / Summary Banner */}
            <div style={{
                marginTop: '0.85rem',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                background: isSplitValid
                    ? 'hsl(var(--color-success) / 0.1)'
                    : 'hsl(var(--color-danger) / 0.1)',
                border: `1px solid ${isSplitValid ? 'hsl(var(--color-success) / 0.3)' : 'hsl(var(--color-danger) / 0.3)'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: isSplitValid ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))',
                flexWrap: 'wrap',
                gap: '0.5rem'
            }}>
                {splitMode === 'EXACT_AMOUNTS' && (
                    <>
                        <span>
                            Allocated: {formatMoney(currentSplitTotal)} of {formatMoney(totalAmount)}
                        </span>
                        <span>
                            {Math.abs(remainingDiff) < 0.01
                                ? '✓ All amounts matched'
                                : remainingDiff > 0
                                    ? `${formatMoney(remainingDiff)} remaining`
                                    : `${formatMoney(Math.abs(remainingDiff))} over total`}
                        </span>
                    </>
                )}

                {splitMode === 'SHARES' && (
                    <>
                        {(() => {
                            const totalShares = selectedUsers.reduce((sum, u) => {
                                const s = parseFloat(splitShares[u.id] !== undefined ? splitShares[u.id] : 1);
                                return sum + ((isNaN(s) || s < 0) ? 0 : s);
                            }, 0);
                            return (
                                <>
                                    <span>
                                        Total Shares: {totalShares} ({selectedUsers.length} selected)
                                    </span>
                                    <span>
                                        {totalShares > 0 && totalAmount > 0
                                            ? `${formatMoney(totalAmount / totalShares)} per share`
                                            : isSplitValid
                                                ? '✓ Valid shares'
                                                : '⚠️ Assign at least 1 share'}
                                    </span>
                                </>
                            );
                        })()}
                    </>
                )}

                {splitMode === 'EQUAL' && (
                    <>
                        <span>
                            Split equally among {selectedUsers.length} {selectedUsers.length === 1 ? 'member' : 'members'}
                        </span>
                        <span>
                            {selectedUsers.length > 0 && totalAmount > 0
                                ? `${formatMoney(totalAmount / selectedUsers.length)} each`
                                : 'Select at least 1 member'}
                        </span>
                    </>
                )}
            </div>

            {/* Quick Add Member */}
            <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid hsl(var(--color-text-muted) / 0.1)' }}>
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
