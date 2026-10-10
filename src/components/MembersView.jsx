import React, { useState, useMemo } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, Search, UserPlus, UserMinus } from 'lucide-react';

export default function MembersView() {
    const navigate = useNavigate();
    const {
        state,
        balances,
        addUser,
        selectedGroupId,
        selectedGroup,
        getGroupBalances,
        addMemberToGroup,
        removeMemberFromGroup
    } = useExpenses();

    const isGroupSelected = !!selectedGroupId && !!selectedGroup;
    const isNonGroup = selectedGroupId === 'non-group';

    const [searchQuery, setSearchQuery] = useState('');
    const [newMemberName, setNewMemberName] = useState('');
    const [selectedExistingUser, setSelectedExistingUser] = useState('');

    // Active users list based on scope
    const scopedUsers = useMemo(() => {
        if (isGroupSelected && !isNonGroup) {
            return (state.users || []).filter(u => selectedGroup.members.includes(u.id));
        }
        return state.users || [];
    }, [isGroupSelected, isNonGroup, selectedGroup, state.users]);

    // Users not yet in this group
    const availableUsersToAdd = useMemo(() => {
        if (!isGroupSelected || isNonGroup) return [];
        return (state.users || []).filter(u => !selectedGroup.members.includes(u.id));
    }, [isGroupSelected, isNonGroup, selectedGroup, state.users]);

    // Active balances based on scope
    const activeBalances = useMemo(() => {
        if (isGroupSelected) {
            return getGroupBalances(selectedGroupId);
        }
        return balances;
    }, [isGroupSelected, selectedGroupId, getGroupBalances, balances]);

    const handleAddMember = () => {
        const name = newMemberName.trim();
        if (name) {
            const newId = addUser(name);
            if (isGroupSelected && !isNonGroup) {
                addMemberToGroup(selectedGroupId, newId);
            }
            setNewMemberName('');
        }
    };

    const handleAddExistingUser = () => {
        if (selectedExistingUser && isGroupSelected && !isNonGroup) {
            addMemberToGroup(selectedGroupId, selectedExistingUser);
            setSelectedExistingUser('');
        }
    };

    const handleRemoveMember = (e, userId, userName) => {
        e.stopPropagation();
        if (selectedGroup.members.length <= 1) {
            alert('A group must have at least one member.');
            return;
        }
        const userBal = activeBalances[userId] || 0;
        if (Math.abs(userBal) > 0.01) {
            if (!window.confirm(`${userName} has an unsettled balance of ${formatMoney(Math.abs(userBal))} in this group. Are you sure you want to remove them?`)) {
                return;
            }
        } else {
            if (!window.confirm(`Remove ${userName} from ${selectedGroup.name}?`)) {
                return;
            }
        }
        removeMemberFromGroup(selectedGroupId, userId);
    };

    const filteredUsers = scopedUsers.filter(user => {
        if (!searchQuery) return true;
        return user.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const sortedUsers = [...filteredUsers].sort((a, b) => a.name.localeCompare(b.name));

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const getMemberStats = (userId) => {
        const transactions = (state.transactions || []).filter(t => {
            if (isGroupSelected) {
                if (isNonGroup) return !t.groupId || t.groupId === 'non-group';
                return t.groupId === selectedGroupId;
            }
            return true;
        });

        const expenseCount = transactions.filter(t => {
            if (t.type === 'EXPENSE') {
                const isPayer = t.payers?.some(p => p.userId === userId);
                const isSplit = t.splits?.some(s => s.userId === userId);
                return isPayer || isSplit;
            }
            return false;
        }).length;

        return { expenseCount };
    };

    return (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
            {/* Header & Controls Toolbar */}
            <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
                            {isGroupSelected
                                ? `Members in ${selectedGroup.name}`
                                : 'All Members'
                            }
                        </h2>
                        <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                            {scopedUsers.length} total people
                        </span>
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative', minWidth: '220px' }}>
                        <Search size={15} style={{
                            position: 'absolute',
                            left: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'hsl(var(--color-text-muted))'
                        }} />
                        <input
                            type="text"
                            placeholder="Search members..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input"
                            style={{
                                paddingLeft: '2.2rem',
                                padding: '0.45rem 0.65rem 0.45rem 2.2rem',
                                fontSize: '0.84rem'
                            }}
                        />
                    </div>
                </div>

                {/* Add Member Actions */}
                <div style={{ display: 'grid', gap: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid hsl(var(--color-border-subtle))' }}>
                    {isGroupSelected && !isNonGroup && availableUsersToAdd.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                                className="input"
                                value={selectedExistingUser}
                                onChange={(e) => setSelectedExistingUser(e.target.value)}
                                style={{ flex: '1 1 200px', padding: '0.45rem 0.75rem', fontSize: '0.84rem' }}
                            >
                                <option value="">Add existing friend to {selectedGroup.name}...</option>
                                {availableUsersToAdd.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleAddExistingUser}
                                className="btn btn-secondary btn-sm"
                                disabled={!selectedExistingUser}
                            >
                                <UserPlus size={15} />
                                <span>Add to Group</span>
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            placeholder={isGroupSelected && !isNonGroup ? `New member name for ${selectedGroup.name}...` : "New member name..."}
                            value={newMemberName}
                            onChange={(e) => setNewMemberName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddMember();
                            }}
                            className="input"
                            style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.84rem' }}
                        />
                        <button
                            type="button"
                            onClick={handleAddMember}
                            className="btn btn-primary btn-sm"
                            disabled={!newMemberName.trim()}
                        >
                            <UserPlus size={15} />
                            <span>Add</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Members Directory */}
            {sortedUsers.length === 0 ? (
                <div className="card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'hsl(var(--color-surface-dim))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem',
                        color: 'hsl(var(--color-text-muted))'
                    }}>
                        <Users size={24} />
                    </div>
                    <p style={{ color: 'hsl(var(--color-text-main))', fontWeight: 600, fontSize: '1rem', margin: 0 }}>
                        {searchQuery ? `No members matching "${searchQuery}"` : 'No members found'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {sortedUsers.map(user => {
                        const balance = activeBalances[user.id] || 0;
                        const stats = getMemberStats(user.id);
                        const isPositive = balance > 0.009;
                        const isNegative = balance < -0.009;
                        const isYou = user.id === state.currentUserId;

                        return (
                            <div
                                key={user.id}
                                className="card card-interactive"
                                style={{
                                    padding: '0.95rem 1.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '1rem'
                                }}
                                onClick={() => navigate(`/members/${user.id}`)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: isGroupSelected ? `${selectedGroup.color || '#10b981'}20` : 'hsl(var(--color-accent) / 0.15)',
                                        color: isGroupSelected ? (selectedGroup.color || '#10b981') : 'hsl(var(--color-accent))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        fontSize: '1rem',
                                        flexShrink: 0
                                    }}>
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>

                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                            <span>{user.name}</span>
                                            {isYou && (
                                                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                                                    You
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.1rem' }}>
                                            {stats.expenseCount} {stats.expenseCount === 1 ? 'expense' : 'expenses'} {isGroupSelected ? 'in group' : 'overall'}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{
                                            fontWeight: 800,
                                            fontSize: '1.05rem',
                                            color: isPositive ? 'hsl(var(--color-success))' : isNegative ? 'hsl(var(--color-danger))' : 'hsl(var(--color-text-muted))'
                                        }}>
                                            {isPositive && `+${formatMoney(balance)}`}
                                            {isNegative && `-${formatMoney(Math.abs(balance))}`}
                                            {!isPositive && !isNegative && '₹0.00'}
                                        </div>
                                        <div style={{ fontSize: '0.76rem', color: isPositive ? 'hsl(var(--color-success))' : isNegative ? 'hsl(var(--color-danger))' : 'hsl(var(--color-text-muted))' }}>
                                            {isPositive ? 'gets back' : isNegative ? 'owes' : 'settled'}
                                        </div>
                                    </div>

                                    {isGroupSelected && !isNonGroup && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleRemoveMember(e, user.id, user.name)}
                                            title={`Remove ${user.name} from group`}
                                            className="btn-icon"
                                            style={{ color: 'hsl(var(--color-danger))' }}
                                        >
                                            <UserMinus size={16} />
                                        </button>
                                    )}

                                    <ChevronRight size={18} style={{ color: 'hsl(var(--color-text-subtle))' }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
