import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { Scale, ArrowRight, CheckCircle2, Minimize2, Users, Printer } from 'lucide-react';

export default function BalancesView() {
    const { state, getBalances } = useExpenses();
    const balances = getBalances();
    const [settleMode, setSettleMode] = useState('simplified'); // 'simplified' or 'direct'

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const getUserName = (id) => {
        const user = state.users.find(u => u.id === id);
        return user ? user.name : 'Unknown';
    };

    // Simplified debt settlement algorithm (existing)
    const calculateSettlements = () => {
        const creditors = [];
        const debtors = [];

        Object.entries(balances).forEach(([userId, balance]) => {
            if (balance > 0.01) {
                creditors.push({ userId, amount: balance });
            } else if (balance < -0.01) {
                debtors.push({ userId, amount: -balance });
            }
        });

        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);

        const settlements = [];
        let i = 0, j = 0;

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const settleAmount = Math.min(debtor.amount, creditor.amount);

            settlements.push({
                from: debtor.userId,
                to: creditor.userId,
                amount: settleAmount
            });

            debtor.amount -= settleAmount;
            creditor.amount -= settleAmount;

            if (debtor.amount < 0.01) i++;
            if (creditor.amount < 0.01) j++;
        }

        return settlements;
    };

    // Direct pairwise settlement calculation (new)
    const calculateDirectSettlements = () => {
        const directDebts = [];

        for (let i = 0; i < state.users.length; i++) {
            for (let j = i + 1; j < state.users.length; j++) {
                const user1 = state.users[i];
                const user2 = state.users[j];
                let netBalance = 0;

                state.transactions.forEach(t => {
                    if (t.type === 'EXPENSE') {
                        const user1Paid = t.payers.find(p => p.userId === user1.id)?.amount || 0;
                        const user1Owes = t.splits.find(s => s.userId === user1.id)?.amount || 0;
                        const user2Paid = t.payers.find(p => p.userId === user2.id)?.amount || 0;
                        const user2Owes = t.splits.find(s => s.userId === user2.id)?.amount || 0;

                        if (user1Paid > 0 && user2Owes > 0) {
                            netBalance += (user1Paid / t.amount) * user2Owes;
                        }
                        if (user2Paid > 0 && user1Owes > 0) {
                            netBalance -= (user2Paid / t.amount) * user1Owes;
                        }
                    }
                    if (t.type === 'SETTLEMENT') {
                        if (t.from === user1.id && t.to === user2.id) netBalance += t.amount;
                        if (t.from === user2.id && t.to === user1.id) netBalance -= t.amount;
                    }
                });

                if (Math.abs(netBalance) > 0.01) {
                    directDebts.push({
                        from: netBalance < 0 ? user1.id : user2.id,
                        to: netBalance < 0 ? user2.id : user1.id,
                        amount: Math.abs(netBalance)
                    });
                }
            }
        }

        return directDebts.sort((a, b) => b.amount - a.amount);
    };

    const settlements = settleMode === 'simplified' ? calculateSettlements() : calculateDirectSettlements();
    const allSettled = settlements.length === 0;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="card">
            <div style={{
                marginBottom: '1.5rem',
                borderBottom: '1px solid hsl(var(--color-text-muted) / 0.2)',
                paddingBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
            }}>
                <h3 style={{
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <Scale size={20} />
                    Who Owes Who
                </h3>
                <button
                    onClick={handlePrint}
                    className="print-hide"
                    style={{
                        background: 'hsl(var(--color-accent))',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'opacity var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <Printer size={16} />
                    Print PDF
                </button>
            </div>

            {/* Mode Toggle */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                padding: '0.25rem',
                background: 'hsl(var(--color-surface-dim))',
                borderRadius: 'var(--radius-md)',
                border: '1px solid hsl(var(--color-text-muted) / 0.2)'
            }}>
                <button
                    onClick={() => setSettleMode('simplified')}
                    style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        background: settleMode === 'simplified' ? 'hsl(var(--color-primary))' : 'transparent',
                        color: settleMode === 'simplified' ? 'white' : 'hsl(var(--color-text-main))',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'all var(--transition-fast)'
                    }}
                >
                    <Minimize2 size={16} />
                    Simplified
                </button>
                <button
                    onClick={() => setSettleMode('direct')}
                    style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        background: settleMode === 'direct' ? 'hsl(var(--color-primary))' : 'transparent',
                        color: settleMode === 'direct' ? 'white' : 'hsl(var(--color-text-main))',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'all var(--transition-fast)'
                    }}
                >
                    <Users size={16} />
                    Direct
                </button>
            </div>

            {allSettled ? (
                <div style={{
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    background: 'hsl(var(--color-success) / 0.1)',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid hsl(var(--color-success) / 0.3)'
                }}>
                    <CheckCircle2
                        size={64}
                        style={{
                            color: 'hsl(var(--color-success))',
                            marginBottom: '1rem'
                        }}
                    />
                    <h2 style={{
                        color: 'hsl(var(--color-success))',
                        margin: '0 0 0.5rem 0',
                        fontSize: '1.5rem'
                    }}>
                        Everyone is settled up!
                    </h2>
                    <p style={{
                        color: 'hsl(var(--color-text-muted))',
                        margin: 0
                    }}>
                        All balances are at zero. No settlements needed.
                    </p>
                </div>
            ) : (
                <>
                    <p style={{
                        color: 'hsl(var(--color-text-muted))',
                        marginBottom: '1.5rem',
                        fontSize: '0.95rem'
                    }}>
                        {settleMode === 'simplified'
                            ? 'Simplified settlements to balance everyone with minimum transactions:'
                            : 'Direct balances between all members based on actual expenses:'
                        }
                    </p>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {settlements.map((settlement, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: '1.5rem',
                                    background: 'hsl(var(--color-bg))',
                                    borderRadius: 'var(--radius-md)',
                                    border: '2px solid hsl(var(--color-primary) / 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    flexWrap: 'wrap'
                                }}
                            >
                                <div style={{ flex: '1 1 auto', minWidth: '150px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))', marginBottom: '0.25rem' }}>
                                        From
                                    </div>
                                    <div style={{
                                        fontSize: '1.1rem',
                                        fontWeight: '700',
                                        color: 'hsl(var(--color-danger))'
                                    }}>
                                        {getUserName(settlement.from)}
                                    </div>
                                </div>

                                <ArrowRight
                                    size={28}
                                    style={{
                                        color: 'hsl(var(--color-primary))',
                                        flexShrink: 0
                                    }}
                                />

                                <div style={{ flex: '1 1 auto', minWidth: '150px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))', marginBottom: '0.25rem' }}>
                                        To
                                    </div>
                                    <div style={{
                                        fontSize: '1.1rem',
                                        fontWeight: '700',
                                        color: 'hsl(var(--color-success))'
                                    }}>
                                        {getUserName(settlement.to)}
                                    </div>
                                </div>

                                <div style={{
                                    marginLeft: 'auto',
                                    padding: '0.75rem 1.25rem',
                                    background: 'hsl(var(--color-primary) / 0.1)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '2px solid hsl(var(--color-primary))'
                                }}>
                                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))', marginBottom: '0.25rem' }}>
                                        Amount
                                    </div>
                                    <div style={{
                                        fontSize: '1.5rem',
                                        fontWeight: '800',
                                        color: 'hsl(var(--color-primary))'
                                    }}>
                                        {formatMoney(settlement.amount)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        background: 'hsl(var(--color-accent) / 0.05)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        color: 'hsl(var(--color-text-muted))'
                    }}>
                        💡 <strong>Tip:</strong> {settleMode === 'simplified'
                            ? `These settlements are optimized to minimize the number of transactions needed. After completing these ${settlements.length} ${settlements.length === 1 ? 'payment' : 'payments'}, everyone will be settled up!`
                            : `These show who owes what to whom based on actual expenses. You can use "Simplified" mode to see the minimum transactions needed to settle all debts.`
                        }
                    </div>
                </>
            )}
        </div>
    );
}
