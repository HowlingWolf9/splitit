import React, { useState, useMemo } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, SlidersHorizontal, ArrowRight, HandCoins, ChevronRight } from 'lucide-react';
import GroupCardBanner from './GroupCardBanner';
import GroupFormModal from './GroupFormModal';
import GroupSettleUpModal from './GroupSettleUpModal';

export default function GroupsView() {
    const navigate = useNavigate();
    const {
        state,
        selectedGroupId,
        setSelectedGroupId,
        currentUserOverall,
        getGroupPairwiseDebts,
    } = useExpenses();

    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('default'); // 'default', 'balance-desc', 'name-asc'
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [settleGroupTarget, setSettleGroupTarget] = useState(null);

    const currentUserId = state.currentUserId || state.users[0]?.id;

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const getUserName = (id) => {
        const u = state.users.find(u => u.id === id);
        return u ? u.name : 'Unknown';
    };

    // Calculate non-group debts
    const nonGroupDebtsInfo = useMemo(() => {
        return getGroupPairwiseDebts('non-group', currentUserId);
    }, [getGroupPairwiseDebts, currentUserId]);

    // Process all groups with debt calculations
    const groupsWithData = useMemo(() => {
        const list = (state.groups || []).map(group => {
            const debtsInfo = getGroupPairwiseDebts(group.id, currentUserId);
            return {
                ...group,
                netBalance: debtsInfo.netBalance,
                debts: debtsInfo.debts,
            };
        });

        // Filter by search
        let filtered = list.filter(g =>
            g.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Sorting
        if (sortBy === 'name-asc') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'balance-desc') {
            filtered.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
        }

        return filtered;
    }, [state.groups, getGroupPairwiseDebts, currentUserId, searchQuery, sortBy]);

    return (
        <div style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '3rem' }}>
            {/* Top Toolbar: Balance Summary & Actions */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                gap: '1rem',
                flexWrap: 'wrap'
            }}>
                {/* Overall Balance Summary */}
                <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--color-text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Your Position
                    </span>
                    <div style={{
                        fontSize: '1.35rem',
                        fontWeight: '800',
                        color: 'hsl(var(--color-text-main))',
                        letterSpacing: '-0.3px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        {currentUserOverall.status === 'owe' && (
                            <>
                                <span>You owe</span>
                                <span style={{ color: 'hsl(var(--color-danger))' }}>
                                    {formatMoney(currentUserOverall.amount)}
                                </span>
                            </>
                        )}
                        {currentUserOverall.status === 'owed' && (
                            <>
                                <span>You are owed</span>
                                <span style={{ color: 'hsl(var(--color-success))' }}>
                                    {formatMoney(currentUserOverall.amount)}
                                </span>
                            </>
                        )}
                        {currentUserOverall.status === 'settled' && (
                            <span style={{ color: 'hsl(var(--color-text-muted))' }}>
                                All settled up
                            </span>
                        )}
                    </div>
                </div>

                {/* Primary Action Button (Single canonical + New Group CTA) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                        type="button"
                        onClick={() => {
                            setSortBy(prev => prev === 'default' ? 'balance-desc' : prev === 'balance-desc' ? 'name-asc' : 'default');
                        }}
                        className="btn btn-secondary btn-sm"
                        title={`Sort groups: ${sortBy}`}
                    >
                        <SlidersHorizontal size={15} />
                        <span>{sortBy === 'default' ? 'Sort' : sortBy === 'balance-desc' ? 'By Balance' : 'A-Z'}</span>
                    </button>
                </div>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                <Search size={16} style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'hsl(var(--color-text-muted))'
                }} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search your groups..."
                    className="input"
                    style={{
                        paddingLeft: '2.5rem',
                        borderRadius: 'var(--radius-lg)',
                        background: 'hsl(var(--color-surface))'
                    }}
                />
            </div>

            {/* Groups Grid / List */}
            <div style={{ display: 'grid', gap: '0.85rem' }}>
                {/* 1. All Groups Card */}
                {(!searchQuery || 'all groups combined overall'.includes(searchQuery.toLowerCase())) && (
                    <div
                        className="card card-interactive"
                        style={{
                            padding: '1.1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            border: selectedGroupId === null
                                ? '2px solid hsl(var(--color-accent))'
                                : '1px solid hsl(var(--color-border))',
                            boxShadow: selectedGroupId === null ? 'var(--shadow-glow)' : 'var(--shadow-xs)'
                        }}
                        onClick={() => {
                            setSelectedGroupId(null);
                            navigate('/dashboard');
                        }}
                    >
                        <div style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: 'var(--radius-lg)',
                            background: 'linear-gradient(135deg, hsl(var(--color-accent) / 0.15), hsl(210 40% 90%))',
                            border: '1px solid hsl(var(--color-accent) / 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.6rem',
                            flexShrink: 0
                        }}>
                            🌐
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--color-text-main))' }}>
                                    All Groups (Overall View)
                                </div>
                                {selectedGroupId === null && (
                                    <span className="badge badge-owed">ACTIVE</span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.2rem' }}>
                                View combined metrics, transactions, and balances across all groups
                            </div>
                        </div>

                        <ChevronRight size={18} style={{ color: 'hsl(var(--color-text-subtle))', flexShrink: 0 }} />
                    </div>
                )}

                {/* 2. Group Cards */}
                {groupsWithData.map(group => {
                    const isSelected = selectedGroupId === group.id;
                    const hasOwed = group.netBalance > 0.009;
                    const hasOwe = group.netBalance < -0.009;
                    const isSettled = !hasOwed && !hasOwe;

                    const displayDebts = (group.debts || []).slice(0, 3);
                    const remainingDebtCount = (group.debts || []).length - displayDebts.length;

                    return (
                        <div
                            key={group.id}
                            className="card card-interactive"
                            style={{
                                padding: '1.1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                border: isSelected
                                    ? `2px solid ${group.color || 'hsl(var(--color-accent))'}`
                                    : '1px solid hsl(var(--color-border))',
                                position: 'relative'
                            }}
                            onClick={() => {
                                setSelectedGroupId(group.id);
                                navigate('/dashboard');
                            }}
                        >
                            <div style={{ flexShrink: 0 }}>
                                <GroupCardBanner
                                    type={group.type}
                                    icon={group.icon}
                                    color={group.color}
                                    size={54}
                                />
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--color-text-main))' }}>
                                        {group.name}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {isSelected && (
                                            <span className="badge badge-owed">ACTIVE</span>
                                        )}
                                        {(hasOwe || hasOwed) && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSettleGroupTarget(group);
                                                }}
                                                className="btn btn-sm"
                                                style={{
                                                    background: 'hsl(var(--color-danger-soft))',
                                                    color: 'hsl(var(--color-danger-text))',
                                                    borderColor: 'hsl(var(--color-danger) / 0.3)',
                                                    padding: '0.25rem 0.65rem'
                                                }}
                                                title="Settle up balance in this group"
                                            >
                                                <HandCoins size={13} />
                                                Settle
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{
                                    fontSize: '0.92rem',
                                    fontWeight: 700,
                                    marginBottom: '0.35rem',
                                    color: hasOwed ? 'hsl(var(--color-success))' : hasOwe ? 'hsl(var(--color-danger))' : 'hsl(var(--color-text-muted))'
                                }}>
                                    {hasOwed && `You are owed ${formatMoney(group.netBalance)}`}
                                    {hasOwe && `You owe ${formatMoney(Math.abs(group.netBalance))}`}
                                    {isSettled && `Settled up`}
                                </div>

                                {/* Debt breakdown */}
                                {displayDebts.length > 0 && (
                                    <div style={{ display: 'grid', gap: '0.15rem', fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))' }}>
                                        {displayDebts.map((debt, dIdx) => {
                                            const isOwing = debt.type === 'you_owe';
                                            return (
                                                <div key={dIdx} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {isOwing ? (
                                                        <span>You owe {getUserName(debt.otherUserId)} <strong style={{ color: 'hsl(var(--color-text-main))' }}>{formatMoney(debt.amount)}</strong></span>
                                                    ) : (
                                                        <span>{getUserName(debt.otherUserId)} owes you <strong style={{ color: 'hsl(var(--color-text-main))' }}>{formatMoney(debt.amount)}</strong></span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {remainingDebtCount > 0 && (
                                            <div style={{ fontSize: '0.76rem', color: 'hsl(var(--color-text-subtle))' }}>
                                                +{remainingDebtCount} more balance{remainingDebtCount > 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <ChevronRight size={18} style={{ color: 'hsl(var(--color-text-subtle))', flexShrink: 0 }} />
                        </div>
                    );
                })}

                {/* 3. Non-Group Expenses */}
                {(!searchQuery || 'non-group expenses'.includes(searchQuery.toLowerCase())) && (
                    <div
                        className="card card-interactive"
                        style={{
                            padding: '1.1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            border: selectedGroupId === 'non-group'
                                ? '2px solid hsl(var(--color-accent))'
                                : '1px solid hsl(var(--color-border))'
                        }}
                        onClick={() => {
                            setSelectedGroupId('non-group');
                            navigate('/expenses');
                        }}
                    >
                        <div style={{ flexShrink: 0 }}>
                            <GroupCardBanner
                                type="nongroup"
                                icon="nongroup"
                                size={54}
                            />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--color-text-main))', marginBottom: '0.2rem' }}>
                                Non-group Expenses
                            </div>
                            <div style={{
                                fontSize: '0.92rem',
                                fontWeight: 700,
                                color: nonGroupDebtsInfo.netBalance > 0.009
                                    ? 'hsl(var(--color-success))'
                                    : nonGroupDebtsInfo.netBalance < -0.009
                                        ? 'hsl(var(--color-danger))'
                                        : 'hsl(var(--color-text-muted))'
                            }}>
                                {nonGroupDebtsInfo.netBalance > 0.009 && `You are owed ${formatMoney(nonGroupDebtsInfo.netBalance)}`}
                                {nonGroupDebtsInfo.netBalance < -0.009 && `You owe ${formatMoney(Math.abs(nonGroupDebtsInfo.netBalance))}`}
                                {Math.abs(nonGroupDebtsInfo.netBalance) <= 0.009 && `Settled up`}
                            </div>
                        </div>

                        <ChevronRight size={18} style={{ color: 'hsl(var(--color-text-subtle))', flexShrink: 0 }} />
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCreateGroupModal && (
                <GroupFormModal
                    onClose={() => setShowCreateGroupModal(false)}
                    onSuccess={(newId) => {
                        setShowCreateGroupModal(false);
                        setSelectedGroupId(newId);
                        navigate('/dashboard');
                    }}
                />
            )}

            {settleGroupTarget && (
                <GroupSettleUpModal
                    group={settleGroupTarget}
                    onClose={() => setSettleGroupTarget(null)}
                    onSuccess={() => setSettleGroupTarget(null)}
                />
            )}

            {/* Floating Action Button */}
            <div className="fab-container">
                <button
                    type="button"
                    className="fab fab-primary"
                    onClick={() => setShowCreateGroupModal(true)}
                    title="New Group"
                >
                    <Plus size={20} strokeWidth={2.5} />
                    <span>New Group</span>
                </button>
            </div>
        </div>
    );
}
