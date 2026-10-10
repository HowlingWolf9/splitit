import React, { useState, useMemo } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import {
    Scale,
    ArrowRight,
    CheckCircle2,
    Minimize2,
    Users,
    Printer,
    HandCoins,
    Info,
    ChevronDown,
    ChevronUp,
    Receipt,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Layers,
    FileText
} from 'lucide-react';
import SettlementForm from './SettlementForm';
import CustomPrintStatement from './CustomPrintStatement';

export default function BalancesView() {
    const {
        state,
        balances: globalBalances,
        getGroupBalances,
        calculateCollectorSimplifiedSettlements,
        selectedGroupId,
        setSelectedGroupId,
        selectedGroup
    } = useExpenses();
    const groupFilter = selectedGroupId || 'ALL';
    const [settleMode, setSettleMode] = useState('simplified'); // 'simplified' or 'direct'
    const [settleTarget, setSettleTarget] = useState(null);
    const [expandedKeys, setExpandedKeys] = useState(new Set());
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printOptions, setPrintOptions] = useState({
        includeBreakdowns: true,
        includeMemberBalances: true,
        includeSignatures: true
    });

    const handleGroupFilterChange = (e) => {
        const val = e.target.value;
        if (val === 'ALL') setSelectedGroupId(null);
        else setSelectedGroupId(val);
    };

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

    const activeGroup = (state.groups || []).find(g => g.id === groupFilter);

    const relevantBalances = useMemo(() => {
        if (groupFilter === 'ALL') return globalBalances;
        return getGroupBalances(groupFilter);
    }, [groupFilter, globalBalances, getGroupBalances]);

    const relevantUsers = useMemo(() => {
        if (activeGroup) {
            return state.users.filter(u => activeGroup.members.includes(u.id));
        }
        return state.users;
    }, [activeGroup, state.users]);

    const relevantTransactions = useMemo(() => {
        if (groupFilter === 'ALL') return state.transactions || [];
        if (groupFilter === 'non-group') return (state.transactions || []).filter(t => !t.groupId || t.groupId === 'non-group');
        return (state.transactions || []).filter(t => t.groupId === groupFilter);
    }, [groupFilter, state.transactions]);

    const activeCollectorId = activeGroup?.defaultCollectorId || relevantTransactions.find(t => t.collectorId)?.collectorId || null;

    // Simplified debt settlement algorithm (Collector-Aware)
    const calculateSettlements = () => {
        if (activeCollectorId && calculateCollectorSimplifiedSettlements) {
            return calculateCollectorSimplifiedSettlements(relevantBalances, activeCollectorId);
        }

        const creditors = [];
        const debtors = [];

        Object.entries(relevantBalances).forEach(([userId, balance]) => {
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

        const debtorCopies = debtors.map(d => ({ ...d }));
        const creditorCopies = creditors.map(c => ({ ...c }));

        while (i < debtorCopies.length && j < creditorCopies.length) {
            const debtor = debtorCopies[i];
            const creditor = creditorCopies[j];
            const settleAmount = Math.min(debtor.amount, creditor.amount);

            settlements.push({
                from: debtor.userId,
                to: creditor.userId,
                amount: Math.round(settleAmount * 100) / 100
            });

            debtor.amount -= settleAmount;
            creditor.amount -= settleAmount;

            if (debtor.amount < 0.01) i++;
            if (creditor.amount < 0.01) j++;
        }

        return settlements;
    };

    // Direct pairwise settlement calculation (Collector-Aware)
    const calculateDirectSettlements = () => {
        const debtMatrix = {};
        relevantUsers.forEach(u1 => {
            debtMatrix[u1.id] = {};
            relevantUsers.forEach(u2 => {
                debtMatrix[u1.id][u2.id] = 0;
            });
        });

        relevantTransactions.forEach(t => {
            if (t.type === 'EXPENSE') {
                const collectorId = t.collectorId;
                const payers = t.payers || [];
                const splits = t.splits || [];
                const totalAmt = parseFloat(t.amount) || 1;

                if (collectorId) {
                    // Members owe the collector
                    splits.forEach(s => {
                        if (s.userId !== collectorId && debtMatrix[s.userId] && debtMatrix[s.userId][collectorId] !== undefined) {
                            debtMatrix[s.userId][collectorId] += s.amount;
                        }
                    });

                    // Collector owes each payer
                    payers.forEach(p => {
                        if (p.amount > 0 && p.userId !== collectorId) {
                            const ratio = p.amount / totalAmt;
                            splits.forEach(s => {
                                if (s.userId !== p.userId && debtMatrix[collectorId] && debtMatrix[collectorId][p.userId] !== undefined) {
                                    debtMatrix[collectorId][p.userId] += s.amount * ratio;
                                }
                            });
                        }
                    });
                } else {
                    // Standard direct debt
                    payers.forEach(p => {
                        if (p.amount > 0) {
                            const ratio = p.amount / totalAmt;
                            splits.forEach(s => {
                                if (s.userId !== p.userId && debtMatrix[s.userId] && debtMatrix[s.userId][p.userId] !== undefined) {
                                    debtMatrix[s.userId][p.userId] += s.amount * ratio;
                                }
                            });
                        }
                    });
                }
            }

            if (t.type === 'SETTLEMENT') {
                if (debtMatrix[t.from] && debtMatrix[t.from][t.to] !== undefined) {
                    debtMatrix[t.from][t.to] -= t.amount;
                }
            }
        });

        const directDebts = [];
        for (let i = 0; i < relevantUsers.length; i++) {
            for (let j = i + 1; j < relevantUsers.length; j++) {
                const u1 = relevantUsers[i].id;
                const u2 = relevantUsers[j].id;

                const u1OwesU2 = debtMatrix[u1]?.[u2] || 0;
                const u2OwesU1 = debtMatrix[u2]?.[u1] || 0;
                const net = u1OwesU2 - u2OwesU1;

                if (Math.abs(net) > 0.01) {
                    const from = net > 0 ? u1 : u2;
                    const to = net > 0 ? u2 : u1;
                    const isCollectorRoute = !!(activeCollectorId && (to === activeCollectorId || from === activeCollectorId));
                    directDebts.push({
                        from,
                        to,
                        amount: Math.round(Math.abs(net) * 100) / 100,
                        isCollectorRoute
                    });
                }
            }
        }

        return directDebts.sort((a, b) => b.amount - a.amount);
    };

    const settlements = settleMode === 'simplified' ? calculateSettlements() : calculateDirectSettlements();
    const allSettled = settlements.length === 0;

    const getSettlementKey = (s, idx) => `${s.from}_${s.to}_${idx}`;

    const toggleExpand = (key) => {
        setExpandedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const allExpanded = settlements.length > 0 && settlements.every((s, idx) => expandedKeys.has(getSettlementKey(s, idx)));

    const toggleAllExpanded = () => {
        if (allExpanded) {
            setExpandedKeys(new Set());
        } else {
            const next = new Set(settlements.map((s, idx) => getSettlementKey(s, idx)));
            setExpandedKeys(next);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return '';
        }
    };

    const getBreakdownForSettlement = (settlement) => {
        const fromId = settlement.from;
        const toId = settlement.to;
        const fromName = getUserName(fromId);
        const toName = getUserName(toId);
        const isFromCollector = Boolean(activeCollectorId && fromId === activeCollectorId);
        const isToCollector = Boolean(activeCollectorId && toId === activeCollectorId);

        const items = [];
        const sortByDate = (a, b) => new Date(a.date || 0) - new Date(b.date || 0);

        if (isToCollector) {
            // SCENARIO 1: Member owes the primary collector
            // The member participated in expenses without paying upfront.
            relevantTransactions.forEach(t => {
                if (t.type === 'EXPENSE') {
                    const mySplit = (t.splits || []).find(s => s.userId === fromId);
                    const myPay = (t.payers || []).find(p => p.userId === fromId);
                    const splitAmt = mySplit ? parseFloat(mySplit.amount) || 0 : 0;
                    const payAmt = myPay ? parseFloat(myPay.amount) || 0 : 0;

                    if (splitAmt > 0.009 || payAmt > 0.009) {
                        const net = splitAmt - payAmt;
                        const payersLabel = (t.payers || []).map(p => getUserName(p.userId)).join(', ') || 'Group';

                        if (net > 0.009) {
                            items.push({
                                id: `${t.id}_share`,
                                date: t.date,
                                description: t.description || 'Group Expense',
                                totalAmount: t.amount,
                                amount: net,
                                type: 'owe',
                                label: `${fromName}'s share (${formatMoney(splitAmt)})${payAmt > 0 ? ` less ${formatMoney(payAmt)} paid` : ''}`,
                                sublabel: `Paid by ${payersLabel}`
                            });
                        } else if (net < -0.009) {
                            items.push({
                                id: `${t.id}_paid`,
                                date: t.date,
                                description: t.description || 'Group Expense',
                                totalAmount: t.amount,
                                amount: Math.abs(net),
                                type: 'credit',
                                label: `Paid upfront by ${fromName} (${formatMoney(payAmt)})${splitAmt > 0 ? ` less own share ${formatMoney(splitAmt)}` : ''}`,
                                sublabel: 'Credit offset'
                            });
                        }
                    }
                } else if (t.type === 'SETTLEMENT') {
                    if (t.from === fromId) {
                        items.push({
                            id: t.id,
                            date: t.date,
                            description: `Settlement payment to ${getUserName(t.to)}`,
                            totalAmount: t.amount,
                            amount: t.amount,
                            type: 'credit',
                            label: 'Previous settlement paid',
                            sublabel: `To ${getUserName(t.to)}`
                        });
                    } else if (t.to === fromId) {
                        items.push({
                            id: t.id,
                            date: t.date,
                            description: `Settlement received from ${getUserName(t.from)}`,
                            totalAmount: t.amount,
                            amount: t.amount,
                            type: 'owe',
                            label: 'Settlement received',
                            sublabel: `From ${getUserName(t.from)}`
                        });
                    }
                }
            });

            items.sort(sortByDate);

            return {
                mode: 'debtor_to_collector',
                title: `Expense Breakdown for ${fromName}`,
                subtitle: `${fromName} owes ${toName} (Collector) for their share in the following group expenses:`,
                badge: 'Collector Routing',
                items
            };
        }

        if (isFromCollector) {
            // SCENARIO 2: Primary collector forwards pooled repayments to a creditor
            // The creditor paid for group expenses upfront and is being reimbursed.
            relevantTransactions.forEach(t => {
                if (t.type === 'EXPENSE') {
                    const creditorPay = (t.payers || []).find(p => p.userId === toId);
                    const creditorSplit = (t.splits || []).find(s => s.userId === toId);
                    const payAmt = creditorPay ? parseFloat(creditorPay.amount) || 0 : 0;
                    const splitAmt = creditorSplit ? parseFloat(creditorSplit.amount) || 0 : 0;

                    if (payAmt > 0.009 || splitAmt > 0.009) {
                        const net = payAmt - splitAmt;
                        const payersLabel = (t.payers || []).map(p => getUserName(p.userId)).join(', ') || 'Group';

                        if (net > 0.009) {
                            items.push({
                                id: `${t.id}_fronted`,
                                date: t.date,
                                description: t.description || 'Group Expense',
                                totalAmount: t.amount,
                                amount: net,
                                type: 'credit',
                                label: `Fronted for group: paid ${formatMoney(payAmt)})${splitAmt > 0 ? ` (own share: ${formatMoney(splitAmt)})` : ''}`,
                                sublabel: `Paid upfront by ${toName}`
                            });
                        } else if (net < -0.009) {
                            items.push({
                                id: `${t.id}_consumed`,
                                date: t.date,
                                description: t.description || 'Group Expense',
                                totalAmount: t.amount,
                                amount: Math.abs(net),
                                type: 'owe',
                                label: `${toName}'s consumed share (${formatMoney(splitAmt)})${payAmt > 0 ? ` less paid ${formatMoney(payAmt)}` : ''}`,
                                sublabel: `Paid by ${payersLabel}`
                            });
                        }
                    }
                } else if (t.type === 'SETTLEMENT') {
                    if (t.to === toId) {
                        items.push({
                            id: t.id,
                            date: t.date,
                            description: `Previous reimbursement from ${getUserName(t.from)}`,
                            totalAmount: t.amount,
                            amount: t.amount,
                            type: 'owe',
                            label: 'Already reimbursed',
                            sublabel: `From ${getUserName(t.from)}`
                        });
                    } else if (t.from === toId) {
                        items.push({
                            id: t.id,
                            date: t.date,
                            description: `Settlement payment to ${getUserName(t.to)}`,
                            totalAmount: t.amount,
                            amount: t.amount,
                            type: 'credit',
                            label: 'Settlement paid',
                            sublabel: `To ${getUserName(t.to)}`
                        });
                    }
                }
            });

            items.sort(sortByDate);

            return {
                mode: 'collector_to_creditor',
                title: `Reimbursement Breakdown for ${toName}`,
                subtitle: `${toName} fronted money for group expenses. ${fromName} (Collector) pools member repayments to reimburse:`,
                badge: 'Collector Reimbursement',
                items
            };
        }

        if (settleMode === 'direct') {
            // SCENARIO 3: Direct Balances pairwise debts
            relevantTransactions.forEach(t => {
                if (t.type === 'EXPENSE') {
                    const totalAmt = parseFloat(t.amount) || 1;
                    const toPay = (t.payers || []).find(p => p.userId === toId)?.amount || 0;
                    const fromSplit = (t.splits || []).find(s => s.userId === fromId)?.amount || 0;
                    const fromPay = (t.payers || []).find(p => p.userId === fromId)?.amount || 0;
                    const toSplit = (t.splits || []).find(s => s.userId === toId)?.amount || 0;

                    if (toPay > 0 && fromSplit > 0) {
                        const shareOwed = fromSplit * (toPay / totalAmt);
                        if (shareOwed > 0.009) {
                            items.push({
                                id: `${t.id}_owe`,
                                date: t.date,
                                description: t.description || 'Shared Expense',
                                totalAmount: t.amount,
                                amount: shareOwed,
                                type: 'owe',
                                label: `${fromName}'s share (paid by ${toName})`,
                                sublabel: `${toName} paid ${formatMoney(toPay)} of bill`
                            });
                        }
                    }

                    if (fromPay > 0 && toSplit > 0) {
                        const shareCredit = toSplit * (fromPay / totalAmt);
                        if (shareCredit > 0.009) {
                            items.push({
                                id: `${t.id}_credit`,
                                date: t.date,
                                description: t.description || 'Shared Expense',
                                totalAmount: t.amount,
                                amount: shareCredit,
                                type: 'credit',
                                label: `${toName}'s share offset (paid by ${fromName})`,
                                sublabel: `${fromName} paid ${formatMoney(fromPay)} of bill`
                            });
                        }
                    }
                } else if (t.type === 'SETTLEMENT') {
                    if (t.from === fromId && t.to === toId) {
                        items.push({
                            id: t.id,
                            date: t.date,
                            description: `Direct settlement paid to ${toName}`,
                            totalAmount: t.amount,
                            amount: t.amount,
                            type: 'credit',
                            label: 'Previous settlement paid',
                            sublabel: 'Direct transfer'
                        });
                    } else if (t.from === toId && t.to === fromId) {
                        items.push({
                            id: t.id,
                            date: t.date,
                            description: `Direct settlement received from ${toName}`,
                            totalAmount: t.amount,
                            amount: t.amount,
                            type: 'owe',
                            label: 'Settlement received',
                            sublabel: 'Direct transfer'
                        });
                    }
                }
            });

            items.sort(sortByDate);

            return {
                mode: 'direct_pairwise',
                title: `Direct Balance Breakdown between ${fromName} and ${toName}`,
                subtitle: `Shared expenses directly involving ${fromName} and ${toName}:`,
                badge: 'Direct Balance',
                items
            };
        }

        // SCENARIO 4: Standard Debt Simplification (non-collector greedy matching)
        relevantTransactions.forEach(t => {
            if (t.type === 'EXPENSE') {
                const fromSplit = (t.splits || []).find(s => s.userId === fromId)?.amount || 0;
                const fromPay = (t.payers || []).find(p => p.userId === fromId)?.amount || 0;
                const toPay = (t.payers || []).find(p => p.userId === toId)?.amount || 0;
                const toSplit = (t.splits || []).find(s => s.userId === toId)?.amount || 0;

                if (fromSplit > 0.009 && fromPay < fromSplit) {
                    items.push({
                        id: `${t.id}_from_share`,
                        date: t.date,
                        description: t.description || 'Group Expense',
                        totalAmount: t.amount,
                        amount: fromSplit - fromPay,
                        type: 'owe',
                        label: `${fromName}'s unpaid share`,
                        sublabel: `Contributed to ${fromName}'s debt in group`
                    });
                }

                if (toPay > 0.009 && toPay > toSplit) {
                    items.push({
                        id: `${t.id}_to_paid`,
                        date: t.date,
                        description: t.description || 'Group Expense',
                        totalAmount: t.amount,
                        amount: toPay - toSplit,
                        type: 'credit',
                        label: `Fronted by ${toName}`,
                        sublabel: `Contributed to ${toName}'s credit in group`
                    });
                }
            }
        });

        items.sort(sortByDate);

        return {
            mode: 'simplified_greedy',
            title: `Simplified Settlement Origin: ${fromName} ➔ ${toName}`,
            subtitle: `Debts simplified mathematically to clear ${fromName}'s expenses by reimbursing ${toName}:`,
            badge: 'Simplified Debt',
            items
        };
    };

    const handlePrint = () => {
        setShowPrintModal(true);
    };

    const handleExecutePrint = () => {
        window.print();
    };

    return (
        <>
            {/* Screen View */}
            <div className="screen-only" style={{ display: 'grid', gap: '1.25rem' }}>
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
                                Balances & Settlements {selectedGroup ? `— ${selectedGroup.name}` : ''}
                            </h2>
                            <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
                                Calculated repayment plan to clear all pending debts
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <select
                                className="input"
                                value={groupFilter}
                                onChange={handleGroupFilterChange}
                                style={{ maxWidth: '180px', padding: '0.42rem 0.65rem', fontSize: '0.84rem' }}
                            >
                                <option value="ALL">All Groups</option>
                                <option value="non-group">Non-group expenses</option>
                                {(state.groups || []).map(g => (
                                    <option key={g.id} value={g.id}>👥 {g.name}</option>
                                ))}
                            </select>

                            <button
                                onClick={handlePrint}
                                className="btn btn-secondary btn-sm print-hide"
                                title="Export or Print Custom PDF Statement"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <Printer size={15} />
                                <span>PDF Statement</span>
                            </button>
                        </div>
                    </div>

                {/* Segmented Mode Selector & Expand All Toggle */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{
                        display: 'inline-flex',
                        background: 'hsl(var(--color-surface-dim))',
                        padding: '0.25rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid hsl(var(--color-border))',
                        gap: '0.25rem'
                    }}>
                        <button
                            type="button"
                            onClick={() => setSettleMode('simplified')}
                            style={{
                                padding: '0.4rem 0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.82rem',
                                fontWeight: settleMode === 'simplified' ? 700 : 500,
                                background: settleMode === 'simplified' ? 'hsl(var(--color-surface))' : 'transparent',
                                color: settleMode === 'simplified' ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))',
                                boxShadow: settleMode === 'simplified' ? 'var(--shadow-xs)' : 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <Minimize2 size={14} />
                            <span>Simplified Debts</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSettleMode('direct')}
                            style={{
                                padding: '0.4rem 0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.82rem',
                                fontWeight: settleMode === 'direct' ? 700 : 500,
                                background: settleMode === 'direct' ? 'hsl(var(--color-surface))' : 'transparent',
                                color: settleMode === 'direct' ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))',
                                boxShadow: settleMode === 'direct' ? 'var(--shadow-xs)' : 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <Users size={14} />
                            <span>Direct Balances</span>
                        </button>
                    </div>

                    {settlements.length > 0 && (
                        <button
                            type="button"
                            onClick={toggleAllExpanded}
                            className="btn btn-secondary btn-sm"
                            style={{
                                fontSize: '0.78rem',
                                padding: '0.35rem 0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                            }}
                            title={allExpanded ? "Collapse all breakdowns" : "Expand all settlement breakdowns"}
                        >
                            {allExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            <span>{allExpanded ? 'Collapse All' : 'Expand All Breakdowns'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            {allSettled ? (
                <div className="card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'hsl(var(--color-success-soft))',
                        color: 'hsl(var(--color-success))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem'
                    }}>
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.25rem', fontWeight: 800 }}>
                        Everyone is settled up!
                    </h3>
                    <p style={{ margin: 0, color: 'hsl(var(--color-text-muted))', fontSize: '0.9rem' }}>
                        All balances are currently at zero. No settlements are needed.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {activeCollectorId && (
                        <div style={{
                            padding: '0.85rem 1.15rem',
                            background: 'hsl(var(--color-surface-dim))',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid hsl(var(--color-accent) / 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            fontSize: '0.86rem',
                            color: 'hsl(var(--color-text-main))'
                        }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'hsl(var(--color-accent) / 0.15)',
                                color: 'hsl(var(--color-accent))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <HandCoins size={16} />
                            </div>
                            <div>
                                <strong>Primary Collector Routing Active:</strong> Settlements are routed through <strong>{getUserName(activeCollectorId)}</strong>. Participants pay the collector, who forwards collected funds to the payer.
                            </div>
                        </div>
                    )}

                    {settlements.map((settlement, index) => {
                        const itemKey = getSettlementKey(settlement, index);
                        const isExpanded = expandedKeys.has(itemKey);
                        const breakdown = isExpanded ? getBreakdownForSettlement(settlement) : null;

                        return (
                            <div
                                key={itemKey}
                                className="card"
                                onClick={() => toggleExpand(itemKey)}
                                style={{
                                    padding: '1rem 1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: isExpanded ? '0.85rem' : '0',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    border: isExpanded ? '1px solid hsl(var(--color-accent) / 0.45)' : '1px solid hsl(var(--color-border))',
                                    boxShadow: isExpanded ? 'var(--shadow-md)' : undefined
                                }}
                            >
                                {/* Main Settlement Header Row */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '1rem',
                                    flexWrap: 'wrap',
                                    width: '100%'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '220px' }}>
                                        <div>
                                            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))', fontWeight: 600 }}>OWES</span>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'hsl(var(--color-danger))', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                                {getUserName(settlement.from)}
                                                {settlement.from === activeCollectorId && (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        padding: '0.1rem 0.5rem',
                                                        borderRadius: 'var(--radius-full)',
                                                        background: 'hsl(var(--color-accent) / 0.12)',
                                                        color: 'hsl(var(--color-accent))',
                                                        border: '1px solid hsl(var(--color-accent) / 0.25)',
                                                    }}>
                                                        Collector
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <ArrowRight size={20} style={{ color: 'hsl(var(--color-text-subtle))' }} />

                                        <div>
                                            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))', fontWeight: 600 }}>TO</span>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'hsl(var(--color-success))', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                                {getUserName(settlement.to)}
                                                {settlement.to === activeCollectorId && (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        padding: '0.1rem 0.5rem',
                                                        borderRadius: 'var(--radius-full)',
                                                        background: 'hsl(var(--color-accent) / 0.12)',
                                                        color: 'hsl(var(--color-accent))',
                                                        border: '1px solid hsl(var(--color-accent) / 0.25)',
                                                    }}>
                                                        Collector
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))', fontWeight: 600 }}>AMOUNT</span>
                                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'hsl(var(--color-text-main))' }}>
                                                {formatMoney(settlement.amount)}
                                            </div>
                                        </div>

                                        {/* Expand Breakdown Toggle Button */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleExpand(itemKey);
                                            }}
                                            className="btn btn-secondary btn-sm"
                                            style={{
                                                padding: '0.45rem 0.65rem',
                                                gap: '0.35rem',
                                                fontSize: '0.78rem',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                background: isExpanded ? 'hsl(var(--color-accent) / 0.12)' : undefined,
                                                color: isExpanded ? 'hsl(var(--color-accent))' : undefined,
                                                borderColor: isExpanded ? 'hsl(var(--color-accent) / 0.35)' : undefined
                                            }}
                                            title={isExpanded ? "Collapse breakdown" : "Expand to view where this amount comes from"}
                                        >
                                            <span>{isExpanded ? 'Hide' : 'Breakdown'}</span>
                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSettleTarget({
                                                    from: settlement.from,
                                                    to: settlement.to,
                                                    amount: settlement.amount,
                                                    groupId: groupFilter === 'ALL' || groupFilter === 'non-group' ? null : groupFilter
                                                });
                                            }}
                                            className="btn btn-primary btn-sm"
                                            title="Settle this specific balance"
                                        >
                                            <HandCoins size={14} />
                                            <span>Settle</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Expandable Itemized Breakdown Container */}
                                {isExpanded && breakdown && (
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            marginTop: '0.85rem',
                                            paddingTop: '0.85rem',
                                            borderTop: '1px solid hsl(var(--color-border))',
                                            width: '100%',
                                            display: 'grid',
                                            gap: '0.75rem'
                                        }}
                                    >
                                        {/* Context Explainer Box */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                            gap: '0.75rem',
                                            flexWrap: 'wrap',
                                            padding: '0.65rem 0.85rem',
                                            background: 'hsl(var(--color-surface-dim))',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid hsl(var(--color-border-subtle))'
                                        }}>
                                            <div style={{ flex: 1, minWidth: '200px' }}>
                                                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'hsl(var(--color-text-main))', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                    <Receipt size={14} style={{ color: 'hsl(var(--color-accent))' }} />
                                                    <span>{breakdown.title}</span>
                                                </div>
                                                <div style={{ fontSize: '0.76rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.2rem' }}>
                                                    {breakdown.subtitle}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                padding: '0.18rem 0.55rem',
                                                borderRadius: 'var(--radius-full)',
                                                background: 'hsl(var(--color-accent) / 0.12)',
                                                color: 'hsl(var(--color-accent))',
                                                border: '1px solid hsl(var(--color-accent) / 0.25)',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {breakdown.badge}
                                            </span>
                                        </div>

                                        {/* Breakdown Items List */}
                                        {breakdown.items.length === 0 ? (
                                            <div style={{
                                                padding: '0.85rem 1rem',
                                                background: 'hsl(var(--color-surface-dim))',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.8rem',
                                                color: 'hsl(var(--color-text-muted))',
                                                fontStyle: 'italic',
                                                textAlign: 'center'
                                            }}>
                                                No individual split records found. This repayment clears net accumulated balances across prior group activity.
                                            </div>
                                        ) : (
                                            <div style={{
                                                display: 'grid',
                                                gap: '0.45rem',
                                                maxHeight: breakdown.items.length > 7 ? '380px' : 'none',
                                                overflowY: breakdown.items.length > 7 ? 'auto' : 'visible',
                                                paddingRight: breakdown.items.length > 7 ? '0.25rem' : '0'
                                            }}>
                                                {breakdown.items.map((item, idx) => {
                                                    const isCreditMode = breakdown.mode === 'collector_to_creditor';
                                                    const isPositive = isCreditMode ? item.type === 'credit' : item.type === 'owe';
                                                    const sign = isPositive ? '+' : '-';
                                                    const amountColor = isCreditMode
                                                        ? (item.type === 'credit' ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))')
                                                        : (item.type === 'owe' ? 'hsl(var(--color-danger))' : 'hsl(var(--color-success))');
                                                    const iconColor = amountColor;
                                                    const iconBg = isCreditMode
                                                        ? (item.type === 'credit' ? 'hsl(var(--color-success) / 0.12)' : 'hsl(var(--color-danger) / 0.12)')
                                                        : (item.type === 'owe' ? 'hsl(var(--color-danger) / 0.12)' : 'hsl(var(--color-success) / 0.12)');

                                                    return (
                                                        <div
                                                            key={item.id || idx}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: '0.75rem',
                                                                padding: '0.6rem 0.85rem',
                                                                background: 'hsl(var(--color-surface))',
                                                                borderRadius: 'var(--radius-sm)',
                                                                border: '1px solid hsl(var(--color-border))',
                                                                fontSize: '0.82rem'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                                                                <div style={{
                                                                    width: '28px',
                                                                    height: '28px',
                                                                    borderRadius: 'var(--radius-xs)',
                                                                    background: iconBg,
                                                                    color: iconColor,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    flexShrink: 0
                                                                }}>
                                                                    {isPositive ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                                                                </div>
                                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                                    <div style={{
                                                                        fontWeight: 600,
                                                                        color: 'hsl(var(--color-text-main))',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}>
                                                                        {item.description}
                                                                    </div>
                                                                    <div style={{
                                                                        fontSize: '0.72rem',
                                                                        color: 'hsl(var(--color-text-muted))',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.5rem',
                                                                        flexWrap: 'wrap',
                                                                        marginTop: '0.15rem'
                                                                    }}>
                                                                        {item.date && (
                                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                                                <Calendar size={11} />
                                                                                {formatDate(item.date)}
                                                                            </span>
                                                                        )}
                                                                        {item.totalAmount && (
                                                                            <span>Bill: {formatMoney(item.totalAmount)}</span>
                                                                        )}
                                                                        <span>•</span>
                                                                        <span>{item.sublabel}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                                <div style={{ fontWeight: 700, color: amountColor }}>
                                                                    {sign}{formatMoney(item.amount)}
                                                                </div>
                                                                <div style={{ fontSize: '0.7rem', color: 'hsl(var(--color-text-muted))' }}>
                                                                    {item.label}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Summary Footer Bar */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.6rem 0.85rem',
                                            background: 'hsl(var(--color-surface-dim))',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid hsl(var(--color-border))',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            color: 'hsl(var(--color-text-main))',
                                            flexWrap: 'wrap',
                                            gap: '0.5rem'
                                        }}>
                                            <span style={{ color: 'hsl(var(--color-text-muted))' }}>
                                                Net Settlement Total:
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'hsl(var(--color-text-main))' }}>
                                                    {formatMoney(settlement.amount)}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    color: 'hsl(var(--color-accent))',
                                                    background: 'hsl(var(--color-accent) / 0.12)',
                                                    padding: '0.12rem 0.5rem',
                                                    borderRadius: 'var(--radius-full)',
                                                    border: '1px solid hsl(var(--color-accent) / 0.25)'
                                                }}>
                                                    Calculated Total
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <div style={{
                        padding: '0.85rem 1rem',
                        background: 'hsl(var(--color-surface-dim))',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.82rem',
                        color: 'hsl(var(--color-text-muted))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <Info size={16} style={{ color: 'hsl(var(--color-accent))', flexShrink: 0 }} />
                        <span>
                            {settleMode === 'simplified'
                                ? `Debts simplified mathematically: only ${settlements.length} transaction${settlements.length === 1 ? '' : 's'} needed to completely settle all members.`
                                : 'Direct balances show the exact debt between each member based on shared expenses.'
                            }
                        </span>
                    </div>
                </div>
            )}

                {/* Settlement Modal when "Settle" is clicked */}
                {settleTarget && (
                    <div
                        className="modal-overlay"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setSettleTarget(null);
                        }}
                    >
                        <div className="modal-content" style={{ maxWidth: '600px' }}>
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

            {/* Print-Only Custom Statement (Always available in DOM for Ctrl+P or print) */}
            <div id="splitit-print-document" className="print-only">
                <CustomPrintStatement
                    group={activeGroup}
                    groupFilter={groupFilter}
                    settlements={settlements}
                    settleMode={settleMode}
                    activeCollectorId={activeCollectorId}
                    transactions={relevantTransactions}
                    balances={relevantBalances}
                    users={relevantUsers}
                    currency={state.currency}
                    getBreakdownForSettlement={getBreakdownForSettlement}
                    includeBreakdowns={printOptions.includeBreakdowns}
                    includeMemberBalances={printOptions.includeMemberBalances}
                    includeSignatures={printOptions.includeSignatures}
                    isPreview={false}
                />
            </div>

            {/* Print & PDF Export Modal Preview */}
            {showPrintModal && (
                <div
                    className="modal-overlay print-modal-active print-hide"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowPrintModal(false);
                    }}
                >
                    <div
                        className="modal-content"
                        style={{
                            maxWidth: '920px',
                            width: '95vw',
                            maxHeight: '92vh',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: 0,
                            overflow: 'hidden',
                            borderRadius: 'var(--radius-lg)'
                        }}
                    >
                        {/* Modal Header Bar */}
                        <div
                            className="print-modal-header"
                            style={{
                                padding: '1rem 1.25rem',
                                borderBottom: '1px solid hsl(var(--color-border))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                background: 'hsl(var(--color-surface))'
                            }}
                        >
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileText size={18} style={{ color: 'hsl(var(--color-accent))' }} />
                                    <span>Export Settlement Statement (PDF / Print)</span>
                                </h3>
                                <span style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))' }}>
                                    Custom accounting document formatted for clean PDF export & printout
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={handleExecutePrint}
                                    className="btn btn-primary btn-sm"
                                    style={{ gap: '0.4rem', fontWeight: 700 }}
                                    title="Open browser print dialog to print or save as PDF"
                                >
                                    <Printer size={15} />
                                    <span>Print / Save as PDF</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPrintModal(false)}
                                    className="btn btn-secondary btn-sm"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        {/* Document Configuration Toolbar */}
                        <div
                            className="print-modal-controls"
                            style={{
                                padding: '0.65rem 1.25rem',
                                background: 'hsl(var(--color-surface-dim))',
                                borderBottom: '1px solid hsl(var(--color-border))',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1.25rem',
                                flexWrap: 'wrap',
                                fontSize: '0.8rem'
                            }}
                        >
                            <span style={{ fontWeight: 700, color: 'hsl(var(--color-text-main))' }}>
                                Document Sections:
                            </span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={printOptions.includeBreakdowns}
                                    onChange={(e) => setPrintOptions(prev => ({ ...prev, includeBreakdowns: e.target.checked }))}
                                />
                                <span>Expense Origins Breakdown</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={printOptions.includeMemberBalances}
                                    onChange={(e) => setPrintOptions(prev => ({ ...prev, includeMemberBalances: e.target.checked }))}
                                />
                                <span>Member Balances Table</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={printOptions.includeSignatures}
                                    onChange={(e) => setPrintOptions(prev => ({ ...prev, includeSignatures: e.target.checked }))}
                                />
                                <span>Sign-off & Verification Block</span>
                            </label>
                        </div>

                        {/* Document Live Preview Area */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '1.5rem',
                            background: 'hsl(var(--color-bg))'
                        }}>
                            <div style={{
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                                borderRadius: '4px',
                                overflow: 'hidden'
                            }}>
                                <CustomPrintStatement
                                    group={activeGroup}
                                    groupFilter={groupFilter}
                                    settlements={settlements}
                                    settleMode={settleMode}
                                    activeCollectorId={activeCollectorId}
                                    transactions={relevantTransactions}
                                    balances={relevantBalances}
                                    users={relevantUsers}
                                    currency={state.currency}
                                    getBreakdownForSettlement={getBreakdownForSettlement}
                                    includeBreakdowns={printOptions.includeBreakdowns}
                                    includeMemberBalances={printOptions.includeMemberBalances}
                                    includeSignatures={printOptions.includeSignatures}
                                    isPreview={true}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
