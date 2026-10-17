import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { ArrowLeft, User, ArrowRight, UserMinus, Mail, Edit3, GitMerge, Copy, Check, HandCoins } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import TransactionList from './TransactionList';
import MemberEditModal from './MemberEditModal';
import MergeUsersModal from './MergeUsersModal';
import SettlementForm from './SettlementForm';
import { useModalBackHandler } from '../utils/backButton';

export default function MemberDetail({ onEditTransaction, onViewTransaction, onEditSettlement, onViewSettlement }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const { state, balances, deleteUser, selectedGroupId, selectedGroup, getGroupBalances } = useExpenses();

    const [showEditModal, setShowEditModal] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [settleTarget, setSettleTarget] = useState(null);
    const [mergeTargetId, setMergeTargetId] = useState('');
    const [copiedEmail, setCopiedEmail] = useState(false);

    useModalBackHandler(showEditModal, () => setShowEditModal(false));
    useModalBackHandler(showMergeModal, () => setShowMergeModal(false));
    useModalBackHandler(!!settleTarget, () => setSettleTarget(null));
    
    const member = (state.users || []).find(u => u.id === id);

    if (!member) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'hsl(var(--color-text-muted))' }}>Member not found.</p>
                <button className="btn btn-secondary" onClick={() => navigate('/members')} style={{ marginTop: '1rem' }}>
                    Back to Members
                </button>
            </div>
        );
    }

    const isGroupSelected = !!selectedGroupId && !!selectedGroup;
    const isNonGroup = selectedGroupId === 'non-group';

    const balance = isGroupSelected
        ? (getGroupBalances(selectedGroupId)[member.id] || 0)
        : (balances[member.id] || 0);

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const transactionsInScope = (state.transactions || []).filter(t => {
        if (isGroupSelected) {
            if (isNonGroup) return !t.groupId || t.groupId === 'non-group';
            return t.groupId === selectedGroupId;
        }
        return true;
    });

    const sortByDateDesc = (a, b) => {
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        const updA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const updB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return updB - updA;
    };

    const memberTransactions = transactionsInScope.filter(t => {
        if (t.type === 'EXPENSE') {
            const isPayer = t.payers.some(p => p.userId === member.id);
            const isSplit = t.splits.some(s => s.userId === member.id);
            return isPayer || isSplit;
        }
        if (t.type === 'SETTLEMENT') {
            return t.from === member.id || t.to === member.id;
        }
        return false;
    }).sort(sortByDateDesc);

    const expenses = memberTransactions.filter(t => t.type === 'EXPENSE');
    const settlements = memberTransactions.filter(t => t.type === 'SETTLEMENT');

    const expensesWithMemberShare = expenses.map(expense => {
        const paidAmount = expense.payers.find(p => p.userId === member.id)?.amount || 0;
        const owedAmount = expense.splits.find(s => s.userId === member.id)?.amount || 0;
        return {
            ...expense,
            memberPaidAmount: paidAmount,
            memberOwedAmount: owedAmount
        };
    });

    const isPositive = balance > 0.009;
    const isNegative = balance < -0.009;

    const usersInScope = isGroupSelected && !isNonGroup
        ? (state.users || []).filter(u => selectedGroup.members.includes(u.id))
        : (state.users || []);

    const pairwiseBalances = [];
    usersInScope.forEach(otherUser => {
        if (otherUser.id === member.id) return;

        let netBalance = 0;

        transactionsInScope.forEach(t => {
            if (t.type === 'EXPENSE') {
                const memberPaid = t.payers.find(p => p.userId === member.id)?.amount || 0;
                const memberOwes = t.splits.find(s => s.userId === member.id)?.amount || 0;
                const otherPaid = t.payers.find(p => p.userId === otherUser.id)?.amount || 0;
                const otherOwes = t.splits.find(s => s.userId === otherUser.id)?.amount || 0;

                if (memberPaid > 0 && otherOwes > 0 && t.amount > 0) {
                    netBalance += (memberPaid / t.amount) * otherOwes;
                }
                if (otherPaid > 0 && memberOwes > 0 && t.amount > 0) {
                    netBalance -= (otherPaid / t.amount) * memberOwes;
                }
            }
            if (t.type === 'SETTLEMENT') {
                if (t.from === member.id && t.to === otherUser.id) netBalance += t.amount;
                if (t.from === otherUser.id && t.to === member.id) netBalance -= t.amount;
            }
        });

        if (Math.abs(netBalance) > 0.01) {
            pairwiseBalances.push({
                user: otherUser,
                balance: netBalance
            });
        }
    });

    const owes = pairwiseBalances.filter(p => p.balance < 0).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    const isOwed = pairwiseBalances.filter(p => p.balance > 0).sort((a, b) => b.balance - a.balance);

    const handleDeleteMember = () => {
        if (window.confirm(`Delete ${member.name} from the system? This action cannot be undone.`)) {
            deleteUser(member.id);
            navigate('/members');
        }
    };

    const handleCopyEmail = (e) => {
        e.stopPropagation();
        if (!member.email) return;

        const markCopied = () => {
            setCopiedEmail(true);
            setTimeout(() => setCopiedEmail(false), 2000);
        };

        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(member.email)
                .then(markCopied)
                .catch(() => {
                    // Fallback to execCommand if permission denied
                    try {
                        const input = document.createElement('textarea');
                        input.value = member.email;
                        input.style.position = 'fixed';
                        input.style.opacity = '0';
                        document.body.appendChild(input);
                        input.select();
                        document.execCommand('copy');
                        document.body.removeChild(input);
                        markCopied();
                    } catch {
                        // Safe fallback without throwing unhandled rejection
                    }
                });
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'grid', gap: '1.25rem' }}>
            {/* Header Card */}
            <div className="card">
                <button
                    onClick={() => navigate('/members')}
                    className="btn btn-secondary btn-sm"
                    style={{ marginBottom: '1.25rem' }}
                >
                    <ArrowLeft size={16} />
                    <span>Back to Members</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'hsl(var(--color-accent) / 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'hsl(var(--color-accent))',
                            fontWeight: 800,
                            fontSize: '1.5rem'
                        }}>
                            {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{member.name}</h2>
                            
                            {/* Email Display or Assign Email Prompt */}
                            {member.email ? (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    marginTop: '0.2rem',
                                    fontSize: '0.85rem'
                                }}>
                                    <Mail size={13} style={{ color: 'hsl(var(--color-text-muted))', flexShrink: 0 }} />
                                    <a
                                        href={`mailto:${member.email}`}
                                        style={{
                                            color: 'hsl(var(--color-accent))',
                                            textDecoration: 'none',
                                            fontWeight: 500
                                        }}
                                    >
                                        {member.email}
                                    </a>
                                    <button
                                        type="button"
                                        onClick={handleCopyEmail}
                                        className="btn-icon"
                                        title="Copy email address"
                                        style={{
                                            padding: '0.2rem',
                                            color: copiedEmail ? 'hsl(var(--color-success))' : 'hsl(var(--color-text-muted))',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            ) : (
                                <div style={{ marginTop: '0.2rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(true)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: 0,
                                            fontSize: '0.8rem',
                                            color: 'hsl(var(--color-accent))',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        <Mail size={13} />
                                        <span>+ Assign Email</span>
                                    </button>
                                </div>
                            )}

                            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.2rem' }}>
                                {memberTransactions.length} {memberTransactions.length === 1 ? 'transaction' : 'transactions'}
                            </div>
                        </div>
                    </div>

                    <div style={{
                        padding: '0.75rem 1.25rem',
                        background: 'hsl(var(--color-surface-dim))',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid hsl(var(--color-border))',
                        textAlign: 'right'
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--color-text-muted))', textTransform: 'uppercase' }}>
                            Net Balance
                        </div>
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 800,
                            color: isPositive ? 'hsl(var(--color-success))' : isNegative ? 'hsl(var(--color-danger))' : 'hsl(var(--color-text-main))'
                        }}>
                            {isPositive && `+${formatMoney(balance)}`}
                            {isNegative && `-${formatMoney(Math.abs(balance))}`}
                            {!isPositive && !isNegative && formatMoney(0)}
                        </div>
                    </div>
                </div>

                {/* Member Action Bar */}
                <div style={{
                    display: 'flex',
                    gap: '0.6rem',
                    marginTop: '1.25rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid hsl(var(--color-border-subtle))',
                    flexWrap: 'wrap',
                    alignItems: 'center'
                }}>
                    <button
                        type="button"
                        onClick={() => {
                            setSettleTarget({
                                from: isNegative ? member.id : null,
                                to: isPositive ? member.id : null,
                                amount: Math.abs(balance) > 0.009 ? Math.abs(balance) : null,
                                groupId: isGroupSelected && !isNonGroup ? selectedGroupId : null
                            });
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                        <HandCoins size={15} />
                        <span>Record Settlement</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                        <Edit3 size={15} />
                        <span>Edit Member</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowMergeModal(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                        <GitMerge size={15} />
                        <span>Merge Member</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteMember}
                        className="btn btn-secondary btn-sm"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            color: 'hsl(var(--color-danger))',
                            marginLeft: 'auto'
                        }}
                    >
                        <UserMinus size={15} />
                        <span>Delete Member</span>
                    </button>
                </div>
            </div>

            {/* Pairwise Breakdown */}
            {(owes.length > 0 || isOwed.length > 0) && (
                <div className="card">
                    <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700 }}>
                        Balance Breakdown
                    </h3>

                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                        {owes.map(({ user, balance }) => (
                            <div key={user.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                background: 'hsl(var(--color-danger-soft))',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid hsl(var(--color-danger) / 0.2)',
                                gap: '0.75rem',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                    <strong style={{ color: 'hsl(var(--color-danger-text))' }}>{member.name}</strong>
                                    <ArrowRight size={14} style={{ color: 'hsl(var(--color-text-muted))' }} />
                                    <strong>{user.name}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'hsl(var(--color-danger-text))' }}>
                                        {formatMoney(Math.abs(balance))}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setSettleTarget({
                                            from: member.id,
                                            to: user.id,
                                            amount: Math.abs(balance),
                                            groupId: isGroupSelected && !isNonGroup ? selectedGroupId : null
                                        })}
                                        className="btn btn-primary btn-sm"
                                        title={`Settle ${formatMoney(Math.abs(balance))} from ${member.name} to ${user.name}`}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem' }}
                                    >
                                        <HandCoins size={13} />
                                        <span>Settle</span>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {isOwed.map(({ user, balance }) => (
                            <div key={user.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                background: 'hsl(var(--color-success-soft))',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid hsl(var(--color-success) / 0.2)',
                                gap: '0.75rem',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                    <strong>{user.name}</strong>
                                    <ArrowRight size={14} style={{ color: 'hsl(var(--color-text-muted))' }} />
                                    <strong style={{ color: 'hsl(var(--color-success))' }}>{member.name}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'hsl(var(--color-success))' }}>
                                        {formatMoney(Math.abs(balance))}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setSettleTarget({
                                            from: user.id,
                                            to: member.id,
                                            amount: Math.abs(balance),
                                            groupId: isGroupSelected && !isNonGroup ? selectedGroupId : null
                                        })}
                                        className="btn btn-primary btn-sm"
                                        title={`Settle ${formatMoney(Math.abs(balance))} from ${user.name} to ${member.name}`}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem' }}
                                    >
                                        <HandCoins size={13} />
                                        <span>Settle</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Expenses */}
            {expenses.length > 0 && (
                <div className="card">
                    <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700 }}>
                        Expenses ({expenses.length})
                    </h3>
                    <TransactionList
                        transactions={expensesWithMemberShare}
                        onEditTransaction={onEditTransaction}
                        onViewTransaction={onViewTransaction}
                        showMemberShare={true}
                    />
                </div>
            )}

            {/* Settlements */}
            {settlements.length > 0 && (
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                            Settlements ({settlements.length})
                        </h3>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSettleTarget({
                                from: isNegative ? member.id : null,
                                to: isPositive ? member.id : null,
                                amount: null,
                                groupId: isGroupSelected && !isNonGroup ? selectedGroupId : null
                            })}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                            <HandCoins size={14} />
                            <span>Record Settlement</span>
                        </button>
                    </div>
                    <TransactionList
                        transactions={settlements}
                        onEditSettlement={onEditSettlement}
                        onViewSettlement={onViewSettlement}
                    />
                </div>
            )}

            {/* Modals */}
            {showEditModal && (
                <MemberEditModal
                    member={member}
                    onClose={() => setShowEditModal(false)}
                    onOpenMerge={(mem, dup) => {
                        setShowEditModal(false);
                        setMergeTargetId(dup.id);
                        setShowMergeModal(true);
                    }}
                />
            )}

            {showMergeModal && (
                <MergeUsersModal
                    initialSourceUserId={member.id}
                    initialTargetUserId={mergeTargetId || ''}
                    onClose={() => {
                        setShowMergeModal(false);
                        setMergeTargetId('');
                    }}
                    onSuccess={(targetId) => {
                        setShowMergeModal(false);
                        setMergeTargetId('');
                        navigate(`/members/${targetId}`);
                    }}
                />
            )}

            {/* Settlement Modal */}
            {settleTarget && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSettleTarget(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <div className="bottom-sheet-handle" />
                        <SettlementForm
                            defaultFrom={settleTarget.from}
                            defaultTo={settleTarget.to}
                            defaultAmount={settleTarget.amount}
                            defaultGroupId={settleTarget.groupId}
                            onCancel={() => setSettleTarget(null)}
                            onSuccess={() => setSettleTarget(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
