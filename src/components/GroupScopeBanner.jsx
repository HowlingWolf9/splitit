import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { Layers, X, Settings as SettingsIcon, HandCoins, ChevronDown } from 'lucide-react';
import GroupCardBanner from './GroupCardBanner';
import GroupFormModal from './GroupFormModal';
import GroupSettleUpModal from './GroupSettleUpModal';

export default function GroupScopeBanner() {
    const {
        state,
        selectedGroupId,
        setSelectedGroupId,
        selectedGroup,
        currentUserGroupSummary
    } = useExpenses();

    const [showEditModal, setShowEditModal] = useState(false);
    const [showSettleModal, setShowSettleModal] = useState(false);

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const handleSelectChange = (e) => {
        const val = e.target.value;
        if (val === 'ALL') {
            setSelectedGroupId(null);
        } else {
            setSelectedGroupId(val);
        }
    };

    // If in overall "All Groups" scope
    if (!selectedGroupId || !selectedGroup) {
        return (
            <div style={{
                background: 'hsl(var(--color-surface))',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid hsl(var(--color-border))',
                padding: '0.65rem 1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-xs)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'hsl(var(--color-accent) / 0.12)',
                        color: 'hsl(var(--color-accent))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Layers size={16} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))', marginRight: '0.4rem' }}>
                            Scope:
                        </span>
                        <strong style={{ fontSize: '0.88rem', color: 'hsl(var(--color-text-main))' }}>
                            All Groups (Overall View)
                        </strong>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <select
                        className="input"
                        value="ALL"
                        onChange={handleSelectChange}
                        style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.82rem',
                            minWidth: '160px',
                            background: 'hsl(var(--color-surface-dim))'
                        }}
                    >
                        <option value="ALL">🌐 All Groups</option>
                        {(state.groups || []).map(g => (
                            <option key={g.id} value={g.id}>👥 {g.name}</option>
                        ))}
                        <option value="non-group">📄 Non-group expenses</option>
                    </select>
                </div>
            </div>
        );
    }

    // Active Group Scope Banner
    const isNonGroup = selectedGroupId === 'non-group';
    const hasOwed = currentUserGroupSummary.status === 'owed';
    const hasOwe = currentUserGroupSummary.status === 'owe';

    return (
        <div style={{
            background: `linear-gradient(135deg, ${selectedGroup.color ? selectedGroup.color + '14' : 'hsl(var(--color-surface))'}, hsl(var(--color-surface)))`,
            borderRadius: 'var(--radius-lg)',
            border: `1.5px solid ${selectedGroup.color ? selectedGroup.color + '35' : 'hsl(var(--color-border))'}`,
            padding: '0.9rem 1.25rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                {/* Left: Group Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', minWidth: '200px' }}>
                    <div style={{ flexShrink: 0 }}>
                        <GroupCardBanner
                            type={selectedGroup.type}
                            icon={selectedGroup.icon}
                            color={selectedGroup.color}
                            size={44}
                        />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: selectedGroup.color || 'hsl(var(--color-accent))',
                                background: `${selectedGroup.color || 'hsl(var(--color-accent))'}20`,
                                padding: '0.12rem 0.5rem',
                                borderRadius: 'var(--radius-full)'
                            }}>
                                Active Scope
                            </span>
                            {!isNonGroup && (
                                <span style={{ fontSize: '0.76rem', color: 'hsl(var(--color-text-muted))' }}>
                                    • {selectedGroup.members?.length || 0} members
                                </span>
                            )}
                        </div>

                        <div style={{
                            fontSize: '1.15rem',
                            fontWeight: '800',
                            color: 'hsl(var(--color-text-main))',
                            lineHeight: 1.2,
                            marginTop: '0.15rem'
                        }}>
                            {selectedGroup.name}
                        </div>

                        <div style={{
                            fontSize: '0.84rem',
                            fontWeight: '600',
                            marginTop: '0.15rem',
                            color: hasOwed ? 'hsl(var(--color-success))' : hasOwe ? 'hsl(var(--color-danger))' : 'hsl(var(--color-text-muted))'
                        }}>
                            {hasOwed && `You are owed ${formatMoney(currentUserGroupSummary.amount)}`}
                            {hasOwe && `You owe ${formatMoney(currentUserGroupSummary.amount)}`}
                            {!hasOwed && !hasOwe && 'All settled up in this group'}
                        </div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    marginLeft: 'auto'
                }}>
                    <select
                        className="input"
                        value={selectedGroupId}
                        onChange={handleSelectChange}
                        style={{
                            padding: '0.4rem 0.65rem',
                            fontSize: '0.82rem',
                            minWidth: '150px',
                            background: 'hsl(var(--color-surface))'
                        }}
                    >
                        <option value="ALL">🌐 All Groups</option>
                        {(state.groups || []).map(g => (
                            <option key={g.id} value={g.id}>👥 {g.name}</option>
                        ))}
                        <option value="non-group">📄 Non-group expenses</option>
                    </select>

                    {!isNonGroup && (hasOwe || hasOwed) && (
                        <button
                            type="button"
                            onClick={() => setShowSettleModal(true)}
                            className="btn btn-sm"
                            style={{
                                background: 'hsl(var(--color-danger-soft))',
                                color: 'hsl(var(--color-danger-text))',
                                borderColor: 'hsl(var(--color-danger) / 0.3)'
                            }}
                        >
                            <HandCoins size={14} />
                            Settle up
                        </button>
                    )}

                    {!isNonGroup && (
                        <button
                            type="button"
                            onClick={() => setShowEditModal(true)}
                            title="Group Settings"
                            className="btn-icon"
                            style={{
                                border: '1px solid hsl(var(--color-border))',
                                background: 'hsl(var(--color-surface))'
                            }}
                        >
                            <SettingsIcon size={15} />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setSelectedGroupId(null)}
                        title="Clear filter and view all groups"
                        className="btn btn-sm btn-ghost"
                        style={{ border: '1px solid hsl(var(--color-border))' }}
                    >
                        <X size={14} />
                        <span>All Groups</span>
                    </button>
                </div>
            </div>

            {/* Modals */}
            {showEditModal && !isNonGroup && (
                <GroupFormModal
                    groupToEdit={selectedGroup}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={() => setShowEditModal(false)}
                />
            )}

            {showSettleModal && !isNonGroup && (
                <GroupSettleUpModal
                    group={selectedGroup}
                    onClose={() => setShowSettleModal(false)}
                    onSuccess={() => setShowSettleModal(false)}
                />
            )}
        </div>
    );
}
