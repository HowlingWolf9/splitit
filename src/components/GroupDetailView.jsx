import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExpenses } from '../store/ExpenseContext';
import {
    ArrowLeft, Plus, Settings, Trash2, Edit3, Scale, Receipt,
    Users, ArrowRight, CheckCircle2, Calendar, UserCheck, HandCoins
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
    } = useExpenses();

    const [activeTab, setActiveTab] = useState('expenses'); // 'expenses', 'balances', 'members'
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
    const [viewingExpense, setViewingExpense] = useState(null);

    const group = (state.groups || []).find(g => g.id === id);

    const currentUserId = state.currentUserId || state.users[0]?.id;

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

    // Calculate group debts and balances
    const groupDebtsInfo = useMemo(() => {
        if (!group) return { netBalance: 0, debts: [], allSettlements: [] };
        return getGroupPairwiseDebts(group.id, currentUserId);
    }, [group, getGroupPairwiseDebts, currentUserId]);

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
                <button className="btn" onClick={() => navigate('/')} style={{ marginTop: '1rem' }}>
                    Back to Groups
                </button>
            </div>
        );
    }

    const handleDeleteGroup = () => {
        if (window.confirm(`Are you sure you want to delete "${group.name}"? Transactions in this group will be converted to non-group expenses.`)) {
            deleteGroup(group.id);
            navigate('/');
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
                    onClick={() => navigate('/')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: 'hsl(var(--color-text-muted))',
                        fontWeight: '600',
                        fontSize: '0.9rem'
                    }}
                >
                    <ArrowLeft size={18} />
                    All Groups
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                        className="btn"
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
                                    ? (tx.payers?.find(p => p.userId === currentUserId)?.amount || 0)
                                    : (tx.from === currentUserId ? tx.amount : 0);
                                const myOwed = isExpense
                                    ? (tx.splits?.find(s => s.userId === currentUserId)?.amount || 0)
                                    : (tx.to === currentUserId ? tx.amount : 0);
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
                                                {getUserName(s.from)} {s.from === currentUserId ? '(You)' : ''}
                                            </span>
                                            <ArrowRight size={16} color="hsl(var(--color-text-muted))" />
                                            <span style={{ fontWeight: '700', color: '#00d09c' }}>
                                                {getUserName(s.to)} {s.to === currentUserId ? '(You)' : ''}
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
                                            {getUserName(mId)} {mId === currentUserId ? <span style={{ opacity: 0.6 }}>(You)</span> : ''}
                                        </div>
                                        <div style={{
                                            fontWeight: '800',
                                            color: isPos ? '#00d09c' : isNeg ? '#ff6b35' : 'hsl(var(--color-text-muted))'
                                        }}>
                                            {isPos && `+${formatMoney(bal)}`}
                                            {isNeg && `-${formatMoney(Math.abs(bal))}`}
                                            {!isPos && !isNeg && '₹0.00'}
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
                            const isYou = mId === currentUserId;
                            const bal = memberBalances[mId] || 0;

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
                                            <div style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))' }}>
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
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        zIndex: 1100,
                        padding: '1rem',
                        overflowY: 'auto'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowAddExpenseModal(false);
                    }}
                >
                    <div style={{ marginTop: '2rem', marginBottom: '2rem', width: '100%', maxWidth: '800px' }}>
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
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        zIndex: 1100,
                        padding: '1rem',
                        overflowY: 'auto'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setViewingExpense(null);
                    }}
                >
                    <div style={{ marginTop: '2rem', marginBottom: '2rem', width: '100%', maxWidth: '600px' }}>
                        <ExpenseDetailView
                            expense={viewingExpense}
                            onClose={() => setViewingExpense(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
