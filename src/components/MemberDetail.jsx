import React from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { ArrowLeft, User, ArrowRight } from 'lucide-react';
import TransactionList from './TransactionList';

export default function MemberDetail({ member, onBack, onEditTransaction, onViewTransaction }) {
    const { state, getBalances } = useExpenses();
    const balances = getBalances();
    const balance = balances[member.id] || 0;

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    // Filter transactions to show only those involving this member
    const memberTransactions = (state.transactions || []).filter(t => {
        if (t.type === 'EXPENSE') {
            const isPayer = t.payers.some(p => p.userId === member.id);
            const isSplit = t.splits.some(s => s.userId === member.id);
            return isPayer || isSplit;
        }
        if (t.type === 'SETTLEMENT') {
            return t.from === member.id || t.to === member.id;
        }
        return false;
    });

    // Separate expenses and settlements
    const expenses = memberTransactions.filter(t => t.type === 'EXPENSE');
    const settlements = memberTransactions.filter(t => t.type === 'SETTLEMENT');

    // Calculate member's share for each expense
    const expensesWithMemberShare = expenses.map(expense => {
        const paidAmount = expense.payers.find(p => p.userId === member.id)?.amount || 0;
        const owedAmount = expense.splits.find(s => s.userId === member.id)?.amount || 0;
        return {
            ...expense,
            memberPaidAmount: paidAmount,
            memberOwedAmount: owedAmount
        };
    });

    const isPositive = balance > 0;
    const isNegative = balance < 0;

    // Calculate pairwise balances with other members
    const pairwiseBalances = [];
    state.users.forEach(otherUser => {
        if (otherUser.id === member.id) return;

        let netBalance = 0;

        state.transactions.forEach(t => {
            if (t.type === 'EXPENSE') {
                // What member paid
                const memberPaid = t.payers.find(p => p.userId === member.id)?.amount || 0;
                // What member owes
                const memberOwes = t.splits.find(s => s.userId === member.id)?.amount || 0;
                // What other user paid
                const otherPaid = t.payers.find(p => p.userId === otherUser.id)?.amount || 0;
                // What other user owes
                const otherOwes = t.splits.find(s => s.userId === otherUser.id)?.amount || 0;

                // If member paid and other owes, member is owed
                if (memberPaid > 0 && otherOwes > 0) {
                    const share = (memberPaid / t.amount) * otherOwes;
                    netBalance += share;
                }
                // If other paid and member owes, member owes
                if (otherPaid > 0 && memberOwes > 0) {
                    const share = (otherPaid / t.amount) * memberOwes;
                    netBalance -= share;
                }
            }
            if (t.type === 'SETTLEMENT') {
                if (t.from === member.id && t.to === otherUser.id) {
                    netBalance += t.amount;
                }
                if (t.from === otherUser.id && t.to === member.id) {
                    netBalance -= t.amount;
                }
            }
        });

        if (Math.abs(netBalance) > 0.01) {
            pairwiseBalances.push({
                user: otherUser,
                balance: netBalance
            });
        }
    });

    const owes = pairwiseBalances.filter(pb => pb.balance < 0);
    const isOwed = pairwiseBalances.filter(pb => pb.balance > 0);

    return (
        <div>
            {/* Header with back button */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'hsl(var(--color-primary))',
                        cursor: 'pointer',
                        padding: '0.5rem 1rem 0.5rem 0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.95rem',
                        fontWeight: '500',
                        marginBottom: '1rem'
                    }}
                >
                    <ArrowLeft size={18} />
                    Back to Members
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: 'hsl(var(--color-primary) / 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'hsl(var(--color-primary))'
                    }}>
                        <User size={30} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '700' }}>{member.name}</h2>
                        <div style={{ fontSize: '0.9rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.25rem' }}>
                            {memberTransactions.length} {memberTransactions.length === 1 ? 'transaction' : 'transactions'}
                        </div>
                    </div>
                </div>

                <div style={{
                    padding: '1rem',
                    background: isPositive ? 'hsl(var(--color-success) / 0.1)' : isNegative ? 'hsl(var(--color-danger) / 0.1)' : 'hsl(var(--color-bg))',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `4px solid ${isPositive ? 'hsl(var(--color-success))' : isNegative ? 'hsl(var(--color-danger))' : 'hsl(var(--color-text-muted))'}`
                }}>
                    <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-muted))', marginBottom: '0.25rem' }}>
                        Balance
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: isPositive ? 'hsl(var(--color-success))' : isNegative ? 'hsl(var(--color-danger))' : 'hsl(var(--color-text))' }}>
                        {formatMoney(Math.abs(balance))}
                    </div>
                    <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                        {isPositive && <span style={{ color: 'hsl(var(--color-success))' }}>is owed</span>}
                        {isNegative && <span style={{ color: 'hsl(var(--color-danger))' }}>owes</span>}
                        {!isPositive && !isNegative && <span style={{ color: 'hsl(var(--color-text-muted))' }}>settled up</span>}
                    </div>
                </div>
            </div>

            {/* Pairwise Balance Breakdown */}
            {(owes.length > 0 || isOwed.length > 0) && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid hsl(var(--color-text-muted) / 0.2)', paddingBottom: '0.5rem' }}>
                        Balance Breakdown
                    </h3>

                    {owes.length > 0 && (
                        <div style={{ marginBottom: isOwed.length > 0 ? '1.5rem' : '0' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'hsl(var(--color-danger))', marginBottom: '0.75rem' }}>
                                {member.name} owes:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {owes.map(({ user, balance }) => (
                                    <div key={user.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.75rem 1rem',
                                        background: 'hsl(var(--color-danger) / 0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        borderLeft: '3px solid hsl(var(--color-danger))'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: '600', color: 'hsl(var(--color-danger))' }}>{member.name}</span>
                                            <ArrowRight size={16} style={{ color: 'hsl(var(--color-text-muted))' }} />
                                            <span style={{ fontWeight: '600' }}>{user.name}</span>
                                        </div>
                                        <span style={{ fontWeight: '700', fontSize: '1.1rem', color: 'hsl(var(--color-danger))' }}>
                                            {formatMoney(Math.abs(balance))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {isOwed.length > 0 && (
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'hsl(var(--color-success))', marginBottom: '0.75rem' }}>
                                {member.name} is owed by:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {isOwed.map(({ user, balance }) => (
                                    <div key={user.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.75rem 1rem',
                                        background: 'hsl(var(--color-success) / 0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        borderLeft: '3px solid hsl(var(--color-success))'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: '600' }}>{user.name}</span>
                                            <ArrowRight size={16} style={{ color: 'hsl(var(--color-text-muted))' }} />
                                            <span style={{ fontWeight: '600', color: 'hsl(var(--color-success))' }}>{member.name}</span>
                                        </div>
                                        <span style={{ fontWeight: '700', fontSize: '1.1rem', color: 'hsl(var(--color-success))' }}>
                                            {formatMoney(Math.abs(balance))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Expenses Section */}
            {expenses.length > 0 && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid hsl(var(--color-text-muted) / 0.2)', paddingBottom: '0.5rem' }}>
                        Expenses ({expenses.length})
                    </h3>
                    <TransactionList
                        transactions={expensesWithMemberShare}
                        onEditTransaction={onEditTransaction}
                        onViewTransaction={onViewTransaction}
                        showMemberShare={true}
                        memberName={member.name}
                    />
                </div>
            )}

            {/* Settlements Section */}
            {settlements.length > 0 && (
                <div className="card">
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid hsl(var(--color-text-muted) / 0.2)', paddingBottom: '0.5rem' }}>
                        Settlements ({settlements.length})
                    </h3>
                    <TransactionList
                        transactions={settlements}
                        onEditTransaction={onEditTransaction}
                        onViewTransaction={onViewTransaction}
                    />
                </div>
            )}

            {/* No transactions message */}
            {memberTransactions.length === 0 && (
                <div className="card">
                    <div style={{ color: 'hsl(var(--color-text-muted))', fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>
                        {member.name} hasn't participated in any transactions yet.
                    </div>
                </div>
            )}
        </div>
    );
}
