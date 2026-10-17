import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExpenses } from '../store/ExpenseContext';
import { useModalBackHandler } from '../utils/backButton';
import {
    ArrowLeft, Plus, Settings, Trash2, Edit3, Scale, Receipt,
    Users, ArrowRight, CheckCircle2, Calendar, UserCheck, HandCoins,
    Radio, Share2, Copy, Check, RefreshCw, ShieldCheck, User, X, Mail
} from 'lucide-react';
import GroupCardBanner from './GroupCardBanner';
import GroupFormModal from './GroupFormModal';
import GroupSettleUpModal from './GroupSettleUpModal';
import ExpenseForm from './ExpenseForm';
import ExpenseDetailView from './ExpenseDetailView';

export default function GroupDetailView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const {
        state,
        deleteGroup,
        getGroupBalances,
        getGroupPairwiseDebts,
        groupSyncStates,
        enableGroupSync,
        disableGroupSync,
        setGroupMemberIdentity,
        syncGroupNow,
        generateInviteCode,
        getShareableInviteMessage,
    } = useExpenses();

    const [activeTab, setActiveTab] = useState('expenses'); // 'expenses', 'balances', 'members'
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
    const [viewingExpense, setViewingExpense] = useState(null);
    const [showLiveSyncModal, setShowLiveSyncModal] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [isManualSyncing, setIsManualSyncing] = useState(false);

    useModalBackHandler(showEditModal, () => setShowEditModal(false));
    useModalBackHandler(showSettleModal, () => setShowSettleModal(false));
    useModalBackHandler(showAddExpenseModal, () => setShowAddExpenseModal(false));
    useModalBackHandler(!!viewingExpense, () => setViewingExpense(null));
    useModalBackHandler(showLiveSyncModal, () => setShowLiveSyncModal(false));

    const group = (state.groups || []).find(g => g.id === id);

    // Effective member identity for this group (persisted on group.myMemberId)
    const currentMemberId = group?.myMemberId || state.currentUserId || state.users[0]?.id;

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const getUserName = (userId) => {
        const u = state.users.find(u => u.id === userId);
        return u ? u.name : 'Unknown';
    };

    // Calculate group debts and balances based on effective member identity
    const groupDebtsInfo = useMemo(() => {
        if (!group) return { netBalance: 0, debts: [], allSettlements: [] };
        return getGroupPairwiseDebts(group.id, currentMemberId);
    }, [group, getGroupPairwiseDebts, currentMemberId]);


    const memberBalances = useMemo(() => {
        if (!group) return {};
        return getGroupBalances(group.id);
    }, [group, getGroupBalances]);

    // Group transactions
    const groupTransactions = useMemo(() => {
        if (!group) return [];
        return (state.transactions || []).filter(t => t.groupId === group.id);
    }, [group, state.transactions]);

    const groupExpenses = useMemo(() => {
        return groupTransactions.filter(t => t.type === 'EXPENSE');
    }, [groupTransactions]);

    const totalGroupSpending = useMemo(() => {
        return groupExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    }, [groupExpenses]);

    if (!group) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p>Group not found.</p>
                <button className="btn" onClick={() => navigate('/groups')} style={{ marginTop: '1rem' }}>
                    Back to Groups
                </button>
            </div>
        );
    }

    const handleDeleteGroup = () => {
        if (window.confirm(`Are you sure you want to delete "${group.name}"? Transactions in this group will be converted to non-group expenses.`)) {
            deleteGroup(group.id);
            navigate('/groups');
        }
    };

    const hasOwed = groupDebtsInfo.netBalance > 0.009;
    const hasOwe = groupDebtsInfo.netBalance < -0.009;

    return (
        <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: '5rem' }}>
            {/* Top Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <button
                    type="button"
                    onClick={() => navigate('/groups')}
                    className="btn btn-secondary btn-sm desktop-only-action"
                    style={{
                        alignItems: 'center',
                        gap: '0.45rem',
                        minHeight: '44px',
                        padding: '0.4rem 0.85rem'
                    }}
                >
                    <ArrowLeft size={18} />
                    <span>Back to Groups</span>
                </button>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => setShowLiveSyncModal(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.4rem 0.8rem',
                            borderRadius: 'var(--radius-md)',
                            border: group.isShared
                                ? '1px solid hsl(var(--color-success) / 0.4)'
                                : '1px solid hsl(var(--color-accent) / 0.35)',
                            background: group.isShared
                                ? 'hsl(var(--color-success) / 0.12)'
                                : 'hsl(var(--color-accent) / 0.08)',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            color: group.isShared ? 'hsl(var(--color-success))' : 'hsl(var(--color-accent))'
                        }}
                    >
                        <Radio size={15} />
                        <span>{group.isShared ? 'Live Sync' : 'Invite / Sync'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.4rem 0.8rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid hsl(var(--color-text-muted) / 0.2)',
                            background: 'hsl(var(--color-surface))',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            color: 'hsl(var(--color-text-main))'
                        }}
                    >
                        <Settings size={15} />
                        Group Settings
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteGroup}
                        title="Delete Group"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.4rem 0.6rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid hsl(var(--color-danger) / 0.3)',
                            background: 'hsl(var(--color-danger) / 0.1)',
                            color: 'hsl(var(--color-danger))',
                        }}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Group Header Card */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <GroupCardBanner
                        type={group.type}
                        icon={group.icon}
                        color={group.color}
                        size={72}
                    />
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: '1.65rem', fontWeight: '800', margin: 0 }}>
                                {group.name}
                            </h1>
                            <span style={{
                                textTransform: 'capitalize',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                padding: '0.2rem 0.6rem',
                                borderRadius: 'var(--radius-full)',
                                background: `${group.color || '#10b981'}20`,
                                color: group.color || '#10b981',
                                border: `1px solid ${group.color || '#10b981'}40`
                            }}>
                                {group.type}
                            </span>
                            {group.isShared && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setIsManualSyncing(true);
                                        await syncGroupNow(group.id);
                                        setIsManualSyncing(false);
                                    }}
                                    title="Click to sync group now with Nostr relays"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        padding: '0.2rem 0.65rem',
                                        borderRadius: 'var(--radius-full)',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        border: '1px solid hsl(var(--color-border))',
                                        cursor: 'pointer',
                                        background: (groupSyncStates[group.id]?.status === 'live')
                                            ? 'hsl(var(--color-success) / 0.15)'
                                            : (groupSyncStates[group.id]?.status === 'syncing' || isManualSyncing)
                                                ? 'hsl(var(--color-accent) / 0.15)'
                                                : 'hsl(var(--color-surface-dim))',
                                        color: (groupSyncStates[group.id]?.status === 'live')
                                            ? 'hsl(var(--color-success))'
                                            : (groupSyncStates[group.id]?.status === 'syncing' || isManualSyncing)
                                                ? 'hsl(var(--color-accent))'
                                                : 'hsl(var(--color-text-muted))'
                                    }}
                                >
                                    <span style={{
                                        width: '7px',
                                        height: '7px',
                                        borderRadius: '50%',
                                        background: (groupSyncStates[group.id]?.status === 'live')
                                            ? 'hsl(var(--color-success))'
                                            : 'hsl(var(--color-accent))',
                                        display: 'inline-block'
                                    }} />
                                    <span>
                                        {(groupSyncStates[group.id]?.status === 'syncing' || isManualSyncing)
                                            ? 'Syncing...'
                                            : groupSyncStates[group.id]?.status === 'live'
                                                ? 'Live Sync'
                                                : 'Synced'}
                                    </span>
                                    <RefreshCw size={11} className={(groupSyncStates[group.id]?.status === 'syncing' || isManualSyncing) ? 'spin-animation' : ''} />
                                </button>
                            )}
                            {group.myMemberId && (
                                <button
                                    type="button"
                                    onClick={() => setShowLiveSyncModal(true)}
                                    title="Click to switch your member identity"
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        padding: '0.2rem 0.65rem',
                                        borderRadius: 'var(--radius-full)',
                                        background: 'hsl(var(--color-surface-dim))',
                                        color: 'hsl(var(--color-text-main))',
                                        border: '1px solid hsl(var(--color-border))',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <User size={12} style={{ color: 'hsl(var(--color-accent))' }} />
                                    <span>You: <strong>{getUserName(group.myMemberId)}</strong></span>
                                </button>
                            )}
                            {group.defaultCollectorId && (
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    padding: '0.2rem 0.65rem',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'hsl(var(--color-surface-dim))',
                                    color: 'hsl(var(--color-text-main))',
                                    border: '1px solid hsl(var(--color-border))',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                }}>
                                    <HandCoins size={12} style={{ color: 'hsl(var(--color-accent))' }} />
                                    Collector: <strong>{getUserName(group.defaultCollectorId)}</strong>
                                </span>
                            )}
                        </div>

                        {/* Status Balance */}
                        <div style={{
                            fontSize: '1.15rem',
                            fontWeight: '800',
                            marginTop: '0.5rem',
                            color: hasOwed ? '#00d09c' : hasOwe ? '#ff6b35' : 'hsl(var(--color-text-muted))'
                        }}>
                            {hasOwed && `you are owed ${formatMoney(groupDebtsInfo.netBalance)}`}
                            {hasOwe && `you owe ${formatMoney(Math.abs(groupDebtsInfo.netBalance))}`}
                            {!hasOwed && !hasOwe && 'settled up in this group'}
                        </div>

                        {/* Summary of what others owe */}
                        <div style={{ fontSize: '0.86rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.35rem' }}>
                            {groupDebtsInfo.debts.map((d, i) => (
                                <div key={i}>
                                    {d.type === 'you_owe'
                                        ? `You owe ${getUserName(d.otherUserId)} ${formatMoney(d.amount)}`
                                        : `${getUserName(d.otherUserId)} owes you ${formatMoney(d.amount)}`}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Metrics Bar */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    marginTop: '1.5rem',
                    paddingTop: '1.25rem',
                    borderTop: '1px solid hsl(var(--color-text-muted) / 0.15)'
                }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))', fontWeight: '600' }}>TOTAL SPENDING</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'hsl(var(--color-text-main))' }}>
                            {formatMoney(totalGroupSpending)}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))', fontWeight: '600' }}>EXPENSES</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'hsl(var(--color-text-main))' }}>
                            {groupExpenses.length}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))', fontWeight: '600' }}>MEMBERS</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'hsl(var(--color-text-main))' }}>
                            {group.members.length}
                        </div>
                    </div>
                </div>

                {/* Primary Group Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setShowAddExpenseModal(true)}
                        className="btn desktop-only-action"
                        style={{ flex: 1, minWidth: '160px', backgroundColor: '#00d09c' }}
                    >
                        <Plus size={18} />
                        Add Expense
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowSettleModal(true)}
                        className="btn btn-secondary"
                        style={{ flex: 1, minWidth: '140px', borderColor: '#ff6b35', color: '#ff6b35' }}
                    >
                        Settle Up
                    </button>
                </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                borderBottom: '1px solid hsl(var(--color-text-muted) / 0.2)',
                paddingBottom: '0.5rem'
            }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('expenses')}
                    style={{
                        padding: '0.5rem 1rem',
                        fontWeight: '700',
                        fontSize: '0.92rem',
                        color: activeTab === 'expenses' ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))',
                        borderBottom: activeTab === 'expenses' ? '3px solid hsl(var(--color-accent))' : '3px solid transparent',
                        borderRadius: '0',
                    }}
                >
                    Expenses ({groupTransactions.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('balances')}
                    style={{
                        padding: '0.5rem 1rem',
                        fontWeight: '700',
                        fontSize: '0.92rem',
                        color: activeTab === 'balances' ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))',
                        borderBottom: activeTab === 'balances' ? '3px solid hsl(var(--color-accent))' : '3px solid transparent',
                        borderRadius: '0',
                    }}
                >
                    Balances & Debts
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('members')}
                    style={{
                        padding: '0.5rem 1rem',
                        fontWeight: '700',
                        fontSize: '0.92rem',
                        color: activeTab === 'members' ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))',
                        borderBottom: activeTab === 'members' ? '3px solid hsl(var(--color-accent))' : '3px solid transparent',
                        borderRadius: '0',
                    }}
                >
                    Members ({group.members.length})
                </button>
            </div>

            {/* TAB CONTENT */}

            {/* 1. EXPENSES TAB */}
            {activeTab === 'expenses' && (
                <div>
                    {groupTransactions.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                            <Receipt size={48} color="hsl(var(--color-text-muted))" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                            <h3 style={{ marginBottom: '0.5rem' }}>No expenses in this group yet</h3>
                            <p style={{ color: 'hsl(var(--color-text-muted))', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                Add the first group expense to start splitting bills with friends.
                            </p>
                            <button
                                type="button"
                                className="btn"
                                onClick={() => setShowAddExpenseModal(true)}
                                style={{ backgroundColor: '#00d09c' }}
                            >
                                <Plus size={18} />
                                Add First Expense
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {groupTransactions.map(tx => {
                                const isExpense = tx.type === 'EXPENSE';
                                const myPaid = isExpense
                                    ? (tx.payers?.find(p => p.userId === currentMemberId)?.amount || 0)
                                    : (tx.from === currentMemberId ? tx.amount : 0);
                                const myOwed = isExpense
                                    ? (tx.splits?.find(s => s.userId === currentMemberId)?.amount || 0)
                                    : (tx.to === currentMemberId ? tx.amount : 0);
                                const myNetOnTx = myPaid - myOwed;

                                const dateStr = new Date(tx.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                });

                                return (
                                    <div
                                        key={tx.id}
                                        className="card"
                                        style={{
                                            padding: '1rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '1rem',
                                            cursor: 'pointer',
                                            transition: 'transform var(--transition-fast)'
                                        }}
                                        onClick={() => {
                                            if (isExpense) setViewingExpense(tx);
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '10px',
                                                background: isExpense ? 'hsl(var(--color-accent) / 0.15)' : 'hsl(var(--color-primary) / 0.15)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: isExpense ? 'hsl(var(--color-accent))' : 'hsl(var(--color-primary))',
                                                fontWeight: '700',
                                                fontSize: '0.75rem',
                                                flexShrink: 0
                                            }}>
                                                {dateStr}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '0.15rem' }}>
                                                    {tx.description}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))' }}>
                                                    {isExpense ? (
                                                        <>
                                                            Paid by {tx.payers?.map(p => getUserName(p.userId)).join(', ')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {getUserName(tx.from)} paid {getUserName(tx.to)}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: '800', fontSize: '1.05rem' }}>
                                                {formatMoney(tx.amount)}
                                            </div>
                                            {isExpense && (
                                                <div style={{
                                                    fontSize: '0.78rem',
                                                    fontWeight: '700',
                                                    color: myNetOnTx > 0.009 ? '#00d09c' : myNetOnTx < -0.009 ? '#ff6b35' : 'hsl(var(--color-text-muted))'
                                                }}>
                                                    {myNetOnTx > 0.009 && `you lent ${formatMoney(myNetOnTx)}`}
                                                    {myNetOnTx < -0.009 && `you borrowed ${formatMoney(Math.abs(myNetOnTx))}`}
                                                    {Math.abs(myNetOnTx) <= 0.009 && 'not involved'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 2. BALANCES & DEBTS TAB */}
            {activeTab === 'balances' && (
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {/* Simplified Settlements */}
                    <div className="card">
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Scale size={18} />
                            Suggested Group Settlements
                        </h3>

                        {groupDebtsInfo.allSettlements?.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--color-success))' }}>
                                <CheckCircle2 size={40} style={{ margin: '0 auto 0.5rem' }} />
                                <div style={{ fontWeight: '700' }}>Everyone in this group is settled up!</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {groupDebtsInfo.allSettlements.map((s, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: '1rem',
                                            background: 'hsl(var(--color-surface-dim))',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.75rem',
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontWeight: '700', color: '#ff6b35' }}>
                                                {getUserName(s.from)} {s.from === currentMemberId ? '(You)' : ''}
                                            </span>
                                            <ArrowRight size={16} color="hsl(var(--color-text-muted))" />
                                            <span style={{ fontWeight: '700', color: '#00d09c' }}>
                                                {getUserName(s.to)} {s.to === currentMemberId ? '(You)' : ''}
                                            </span>
                                        </div>
                                        <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>
                                            {formatMoney(s.amount)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Member Balances Table */}
                    <div className="card">
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Users size={18} />
                            Individual Member Net Balances
                        </h3>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {group.members.map(mId => {
                                const bal = memberBalances[mId] || 0;
                                const isPos = bal > 0.009;
                                const isNeg = bal < -0.009;

                                return (
                                    <div
                                        key={mId}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.75rem 1rem',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'hsl(var(--color-surface-dim))'
                                        }}
                                    >
                                        <div style={{ fontWeight: '600' }}>
                                            {getUserName(mId)} {mId === currentMemberId ? <span style={{ opacity: 0.6 }}>(You)</span> : ''}
                                        </div>
                                        <div style={{
                                            fontWeight: '800',
                                            color: isPos ? '#00d09c' : isNeg ? '#ff6b35' : 'hsl(var(--color-text-muted))'
                                        }}>
                                            {isPos && `+${formatMoney(bal)}`}
                                            {isNeg && `-${formatMoney(Math.abs(bal))}`}
                                            {!isPos && !isNeg && formatMoney(0)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. MEMBERS TAB */}
            {activeTab === 'members' && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                            Group Members ({group.members.length})
                        </h3>
                        <button
                            type="button"
                            className="btn"
                            onClick={() => setShowEditModal(true)}
                            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                        >
                            <Users size={15} />
                            Manage Members
                        </button>
                    </div>

                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {group.members.map(mId => {
                            const isYou = mId === currentMemberId;
                            const bal = memberBalances[mId] || 0;

                            const memberObj = (state.users || []).find(u => u.id === mId);

                            return (
                                <div
                                    key={mId}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.85rem 1rem',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'hsl(var(--color-surface-dim))',
                                        border: '1px solid hsl(var(--color-text-muted) / 0.1)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: `${group.color || '#10b981'}25`,
                                            color: group.color || '#10b981',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: '800'
                                        }}>
                                            {getUserName(mId).charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '700' }}>
                                                {getUserName(mId)} {isYou && <span style={{ opacity: 0.6, fontSize: '0.82rem' }}>(You)</span>}
                                            </div>
                                            {memberObj?.email && (
                                                <div style={{
                                                    fontSize: '0.78rem',
                                                    color: 'hsl(var(--color-text-muted))',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    marginTop: '0.1rem'
                                                }}>
                                                    <Mail size={12} style={{ flexShrink: 0 }} />
                                                    <span>{memberObj.email}</span>
                                                </div>
                                            )}
                                            <div style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.1rem' }}>
                                                {bal > 0.009 ? `Gets back ${formatMoney(bal)}` : bal < -0.009 ? `Owes ${formatMoney(Math.abs(bal))}` : 'Settled up'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MODALS */}
            {showEditModal && (
                <GroupFormModal
                    groupToEdit={group}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={() => setShowEditModal(false)}
                />
            )}

            {showSettleModal && (
                <GroupSettleUpModal
                    group={group}
                    onClose={() => setShowSettleModal(false)}
                    onSuccess={() => setShowSettleModal(false)}
                />
            )}

            {showAddExpenseModal && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowAddExpenseModal(false);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '800px' }}>
                        <div className="bottom-sheet-handle" />
                        <ExpenseForm
                            defaultGroupId={group.id}
                            onCancel={() => setShowAddExpenseModal(false)}
                            onSuccess={() => setShowAddExpenseModal(false)}
                        />
                    </div>
                </div>
            )}

            {viewingExpense && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setViewingExpense(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '640px' }}>
                        <div className="bottom-sheet-handle" />
                        <ExpenseDetailView
                            expense={viewingExpense}
                            onClose={() => setViewingExpense(null)}
                        />
                    </div>
                </div>
            )}

            {/* LIVE SYNC & INVITE BOTTOM SHEET MODAL */}
            {showLiveSyncModal && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowLiveSyncModal(false);
                    }}
                >
                    <div className="modal-content bottom-sheet" style={{ maxWidth: '600px' }}>
                        <div className="bottom-sheet-handle" />

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'hsl(var(--color-accent) / 0.12)',
                                    color: 'hsl(var(--color-accent))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Radio size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                                        Multi-User Live Sync
                                    </h3>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn-icon"
                                onClick={() => setShowLiveSyncModal(false)}
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {!group.isShared ? (
                            <div style={{ padding: '0.5rem 0' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 700 }}
                                    onClick={async () => {
                                        await enableGroupSync(group.id);
                                    }}
                                >
                                    <Radio size={18} />
                                    <span>Enable Live Sync for "{group.name}"</span>
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Invite Code Block */}
                                <div className="card" style={{
                                    padding: '1.25rem',
                                    background: 'hsl(var(--color-surface-dim))',
                                    border: '1px solid hsl(var(--color-border))',
                                    borderRadius: 'var(--radius-lg)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--color-text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Group Invite Code
                                        </span>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: 'var(--radius-full)',
                                            background: 'hsl(var(--color-success) / 0.15)',
                                            color: 'hsl(var(--color-success))'
                                        }}>
                                            Active E2EE
                                        </span>
                                    </div>

                                    <div style={{
                                        fontFamily: 'monospace',
                                        fontSize: '0.88rem',
                                        padding: '0.75rem 1rem',
                                        background: 'hsl(var(--color-surface))',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid hsl(var(--color-border))',
                                        wordBreak: 'break-all',
                                        userSelect: 'all',
                                        marginBottom: '0.85rem',
                                        color: 'hsl(var(--color-text-main))',
                                        fontWeight: 600
                                    }}>
                                        {generateInviteCode(group, group.syncSecret)}
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ flex: 1, padding: '0.55rem' }}
                                            onClick={() => {
                                                const code = generateInviteCode(group, group.syncSecret);
                                                navigator.clipboard.writeText(code);
                                                setCodeCopied(true);
                                                setTimeout(() => setCodeCopied(false), 2500);
                                            }}
                                        >
                                            {codeCopied ? <Check size={16} style={{ color: 'hsl(var(--color-success))' }} /> : <Copy size={16} />}
                                            <span>{codeCopied ? 'Copied Code!' : 'Copy Code'}</span>
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            style={{ flex: 1, padding: '0.55rem' }}
                                            onClick={() => {
                                                const code = generateInviteCode(group, group.syncSecret);
                                                const msg = getShareableInviteMessage(group, code);
                                                if (navigator.share) {
                                                    navigator.share({
                                                        title: `SplitIt: Join ${group.name}`,
                                                        text: msg
                                                    }).catch(() => {});
                                                } else {
                                                    navigator.clipboard.writeText(msg);
                                                    setCodeCopied(true);
                                                    setTimeout(() => setCodeCopied(false), 2500);
                                                }
                                            }}
                                        >
                                            <Share2 size={16} />
                                            <span>Share Invite</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Identity Selector: "Which member are you?" */}
                                <div className="card" style={{
                                    padding: '1.25rem',
                                    border: '1px solid hsl(var(--color-border))',
                                    borderRadius: 'var(--radius-lg)'
                                }}>
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                                            Which member are you in this group?
                                        </h4>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '200px', overflowY: 'auto' }}>
                                        {(group.members || []).map(memberId => {
                                            const isMe = currentMemberId === memberId;
                                            return (
                                                <div
                                                    key={memberId}
                                                    onClick={() => setGroupMemberIdentity(group.id, memberId)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.6rem 0.85rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        cursor: 'pointer',
                                                        border: isMe
                                                            ? '2px solid hsl(var(--color-accent))'
                                                            : '1px solid hsl(var(--color-border))',
                                                        background: isMe
                                                            ? 'hsl(var(--color-accent) / 0.08)'
                                                            : 'hsl(var(--color-surface))'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <User size={16} style={{ color: isMe ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))' }} />
                                                        <span style={{ fontWeight: isMe ? 700 : 500, fontSize: '0.9rem' }}>
                                                            {getUserName(memberId)}
                                                        </span>
                                                        {isMe && (
                                                            <span style={{
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                padding: '0.1rem 0.45rem',
                                                                borderRadius: 'var(--radius-full)',
                                                                background: 'hsl(var(--color-accent))',
                                                                color: '#fff'
                                                            }}>
                                                                You
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isMe && <CheckCircle2 size={18} style={{ color: 'hsl(var(--color-accent))' }} />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Live Sync Controls & Status */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.85rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'hsl(var(--color-surface-dim))',
                                    border: '1px solid hsl(var(--color-border))'
                                }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}>
                                            <span style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: groupSyncStates[group.id]?.status === 'live' ? 'hsl(var(--color-success))' : 'hsl(var(--color-accent))'
                                            }} />
                                            <span>
                                                {groupSyncStates[group.id]?.status === 'live'
                                                    ? 'Connected to Public Nostr Relays'
                                                    : groupSyncStates[group.id]?.status === 'syncing' || isManualSyncing
                                                        ? 'Syncing with Relays...'
                                                        : 'Synced with Relays'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.74rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.2rem' }}>
                                            {groupSyncStates[group.id]?.lastSyncedAt
                                                ? `Last synchronized: ${new Date(groupSyncStates[group.id].lastSyncedAt).toLocaleTimeString()}`
                                                : 'Auto-sync active'}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        disabled={isManualSyncing}
                                        onClick={async () => {
                                            setIsManualSyncing(true);
                                            await syncGroupNow(group.id);
                                            setIsManualSyncing(false);
                                        }}
                                    >
                                        <RefreshCw size={14} className={isManualSyncing ? 'spin-animation' : ''} />
                                        <span>Sync Now</span>
                                    </button>
                                </div>

                                {/* Danger Zone: Disable Sync */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                                    <button
                                        type="button"
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'hsl(var(--color-danger))',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            padding: '0.3rem 0.5rem'
                                        }}
                                        onClick={() => {
                                            if (window.confirm('Disable live sync for this group? Friends will no longer receive your updates and you will no longer receive theirs.')) {
                                                disableGroupSync(group.id);
                                                setShowLiveSyncModal(false);
                                            }
                                        }}
                                    >
                                        Disable Live Sync
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
