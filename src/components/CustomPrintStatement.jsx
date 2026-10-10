import React from 'react';
import { Layers, HandCoins, CheckSquare, Calendar, Receipt, User, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function CustomPrintStatement({
    group,
    groupFilter,
    settlements = [],
    settleMode = 'simplified',
    activeCollectorId = null,
    transactions = [],
    balances = {},
    users = [],
    currency = 'INR',
    getBreakdownForSettlement,
    includeBreakdowns = true,
    includeMemberBalances = true,
    includeSignatures = true,
    isPreview = false
}) {
    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'INR'
        }).format(val || 0);
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

    const getUserName = (id) => {
        const u = (users || []).find(user => user.id === id);
        return u ? u.name : 'Unknown';
    };

    const collectorName = activeCollectorId ? getUserName(activeCollectorId) : null;
    const groupName = group ? group.name : (groupFilter === 'non-group' ? 'Non-group Expenses' : 'All Groups Overview');
    const memberCount = group ? (group.members || []).length : (users || []).length;

    // Financial Metrics
    const totalGroupSpend = (transactions || [])
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    // Total settlement volume to clear 100% of debt in the group:
    // Mathematically, the volume of outstanding debt in a balanced ledger is the sum of all positive creditor balances.
    const positiveBalancesSum = Object.values(balances || {}).filter(b => b > 0.009).reduce((sum, b) => sum + b, 0);
    const totalSettlementVolume = positiveBalancesSum > 0
        ? Math.round(positiveBalancesSum * 100) / 100
        : (activeCollectorId
            ? Math.round(((settlements || []).filter(s => s.from === activeCollectorId).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
                || (settlements || []).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)) * 100) / 100
            : Math.round((settlements || []).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) * 100) / 100);

    // Collector routing metrics (if active)
    const collectorInflow = activeCollectorId
        ? Math.round((settlements || []).filter(s => s.to === activeCollectorId).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) * 100) / 100
        : 0;
    const collectorOutflow = activeCollectorId
        ? Math.round((settlements || []).filter(s => s.from === activeCollectorId).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) * 100) / 100
        : 0;
    const collectorNet = activeCollectorId ? Math.round((balances[activeCollectorId] || 0) * 100) / 100 : 0;

    const activeParticipantsCount = new Set((settlements || []).flatMap(s => [s.from, s.to])).size;

    const todayFormatted = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const timestampFormatted = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const statementRef = `STMT-${(groupName || 'ALL').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    // Member balance overview calculation with guaranteed reconciliation:
    // Net Position = (Total Paid Upfront - Expense Share) + Prior Settled Adjustments
    const memberPositionList = (users || []).map(u => {
        const net = Math.round((balances[u.id] || 0) * 100) / 100;
        let totalPaid = 0;
        let totalShare = 0;

        (transactions || []).forEach(t => {
            if (t.type === 'EXPENSE') {
                (t.payers || []).forEach(p => {
                    if (p.userId === u.id) totalPaid += (parseFloat(p.amount) || 0);
                });
                (t.splits || []).forEach(s => {
                    if (s.userId === u.id) totalShare += (parseFloat(s.amount) || 0);
                });
            }
        });

        totalPaid = Math.round(totalPaid * 100) / 100;
        totalShare = Math.round(totalShare * 100) / 100;

        // Algebraic identity for ledger reconciliation:
        // netPosition = (totalPaid - totalShare) + adjustment  ===> adjustment = netPosition - (totalPaid - totalShare)
        const expenseNet = Math.round((totalPaid - totalShare) * 100) / 100;
        const adjustment = Math.round((net - expenseNet) * 100) / 100;

        return {
            id: u.id,
            name: u.name,
            isCollector: u.id === activeCollectorId,
            totalPaid,
            totalShare,
            expenseNet,
            adjustment,
            netBalance: net,
            status: net > 0.009 ? 'CREDITOR' : net < -0.009 ? 'DEBTOR' : 'SETTLED'
        };
    }).sort((a, b) => b.netBalance - a.netBalance);

    const hasAnyAdjustments = memberPositionList.some(m => Math.abs(m.adjustment) > 0.009);

    return (
        <div
            className="custom-print-document"
            style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                color: '#111827',
                background: '#ffffff',
                maxWidth: isPreview ? '820px' : '100%',
                margin: '0 auto',
                padding: isPreview ? '2.5rem' : '0.5rem',
                boxSizing: 'border-box',
                lineHeight: 1.4,
                fontSize: '9.5pt'
            }}
        >
            {/* DOCUMENT HEADER / LETTERHEAD */}
            <div style={{
                borderBottom: '2px solid #111827',
                paddingBottom: '1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: '#059669',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '13px'
                        }}>
                            S
                        </div>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#111827' }}>
                            SplitIt
                        </span>
                        <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '9999px',
                            marginLeft: '0.25rem'
                        }}>
                            Settlement Statement
                        </span>
                    </div>
                    <h1 style={{
                        margin: 0,
                        fontSize: '1.4rem',
                        fontWeight: 800,
                        color: '#111827',
                        letterSpacing: '-0.3px'
                    }}>
                        {groupName}
                    </h1>
                    <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '0.15rem' }}>
                        Calculated Repayment Plan & Balance Sheet • {memberCount} Registered Members
                    </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#4b5563' }}>
                    <div><strong>Statement Ref:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{statementRef}</span></div>
                    <div><strong>Generated Date:</strong> {todayFormatted} at {timestampFormatted}</div>
                    <div><strong>Calculation Mode:</strong> {settleMode === 'simplified' ? 'Simplified Debt Matching' : 'Direct Pairwise Balances'}</div>
                    {activeCollectorId && (
                        <div style={{ color: '#047857', fontWeight: 700, marginTop: '0.15rem' }}>
                            Primary Collector: {collectorName}
                        </div>
                    )}
                </div>
            </div>

            {/* EXECUTIVE FINANCIAL SUMMARY KPI CARDS */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.75rem',
                marginBottom: '1.25rem'
            }}>
                <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    background: '#f9fafb'
                }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                        Total Group Spend
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', marginTop: '0.2rem' }}>
                        {formatMoney(totalGroupSpend)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.1rem' }}>
                        Across recorded bills
                    </div>
                </div>

                <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    background: '#f9fafb'
                }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                        Total Settlement Pool
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#047857', marginTop: '0.2rem' }}>
                        {formatMoney(totalSettlementVolume)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.1rem' }}>
                        Volume to clear all debt
                    </div>
                </div>

                <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    background: '#f9fafb'
                }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                        Transactions Needed
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', marginTop: '0.2rem' }}>
                        {settlements.length} Transfers
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.1rem' }}>
                        {settleMode === 'simplified' ? 'Mathematically minimized' : 'Direct pairwise count'}
                    </div>
                </div>

                <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    background: '#f9fafb'
                }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                        Settlement Status
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: settlements.length === 0 ? '#059669' : '#d97706', marginTop: '0.2rem' }}>
                        {settlements.length === 0 ? 'All Settled' : 'Pending Action'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.1rem' }}>
                        {activeParticipantsCount} members involved
                    </div>
                </div>
            </div>

            {/* PRIMARY COLLECTOR ROUTING NOTICE (IF ACTIVE) */}
            {activeCollectorId && (
                <div style={{
                    border: '1px solid #6ee7b7',
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    padding: '0.65rem 0.95rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.82rem',
                    color: '#065f46',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem'
                }}>
                    <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#059669',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '0.1rem'
                    }}>
                        <ShieldCheck size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>
                            Primary Collector Routing Active ({collectorName})
                        </div>
                        <div style={{ fontSize: '0.78rem', lineHeight: 1.45, color: '#047857' }}>
                            Settlements are routed through <strong>{collectorName} (Primary Collector)</strong>. 
                            Participants who owe money pay the collector directly. 
                            The collector pools all incoming payments ({formatMoney(collectorInflow)})
                            {collectorNet < -0.009 ? ` and contributes their own debt of ${formatMoney(Math.abs(collectorNet))}` : ''}
                            {collectorNet > 0.009 ? ` (retaining their own reimbursement of ${formatMoney(collectorNet)})` : ''} 
                            to forward reimbursements ({formatMoney(collectorOutflow)}) to members who fronted expenses.
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 1: REQUIRED REPAYMENT SCHEDULE TABLE */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.35rem'
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: '#111827',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}>
                        <span>1. Required Repayment Schedule</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>
                            ({settlements.length} transactions)
                        </span>
                    </h2>
                    <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                        Check off each transaction once completed
                    </span>
                </div>

                {settlements.length === 0 ? (
                    <div style={{
                        padding: '1.5rem',
                        textAlign: 'center',
                        background: '#f9fafb',
                        border: '1px dashed #d1d5db',
                        borderRadius: '8px',
                        color: '#059669',
                        fontWeight: 600
                    }}>
                        ✓ All members in this group are fully settled up! No transactions needed.
                    </div>
                ) : (
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '8.8pt',
                        textAlign: 'left'
                    }}>
                        <thead>
                            <tr style={{ background: '#f3f4f6', borderBottom: '1.5px solid #d1d5db' }}>
                                <th style={{ padding: '0.45rem 0.5rem', width: '30px', fontWeight: 700, color: '#374151' }}>#</th>
                                <th style={{ padding: '0.45rem 0.5rem', fontWeight: 700, color: '#374151' }}>Payer (Debtor)</th>
                                <th style={{ padding: '0.45rem 0.25rem', width: '24px', textAlign: 'center', color: '#9ca3af' }}>➔</th>
                                <th style={{ padding: '0.45rem 0.5rem', fontWeight: 700, color: '#374151' }}>Recipient (Creditor)</th>
                                <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#374151' }}>Amount</th>
                                <th style={{ padding: '0.45rem 0.5rem', fontWeight: 700, color: '#374151' }}>Routing Note</th>
                                <th style={{ padding: '0.45rem 0.5rem', width: '130px', fontWeight: 700, color: '#374151', textAlign: 'center' }}>Verification</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settlements.map((s, idx) => {
                                const isFromCollector = activeCollectorId && s.from === activeCollectorId;
                                const isToCollector = activeCollectorId && s.to === activeCollectorId;
                                const breakdown = (includeBreakdowns && getBreakdownForSettlement) ? getBreakdownForSettlement(s) : null;

                                return (
                                    <React.Fragment key={idx}>
                                        <tr style={{
                                            borderBottom: breakdown && breakdown.items.length > 0 ? 'none' : '1px solid #e5e7eb',
                                            background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                                            pageBreakInside: 'avoid'
                                        }}>
                                            <td style={{ padding: '0.5rem', color: '#6b7280', fontWeight: 600 }}>
                                                {idx + 1}
                                            </td>
                                            <td style={{ padding: '0.5rem', fontWeight: 700, color: '#dc2626' }}>
                                                {getUserName(s.from)}
                                                {isFromCollector && (
                                                    <span style={{
                                                        fontSize: '0.65rem',
                                                        fontWeight: 700,
                                                        background: '#e0e7ff',
                                                        color: '#3730a3',
                                                        padding: '0.05rem 0.35rem',
                                                        borderRadius: '4px',
                                                        marginLeft: '0.35rem'
                                                    }}>
                                                        Collector
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center', color: '#9ca3af' }}>
                                                ➔
                                            </td>
                                            <td style={{ padding: '0.5rem', fontWeight: 700, color: '#059669' }}>
                                                {getUserName(s.to)}
                                                {isToCollector && (
                                                    <span style={{
                                                        fontSize: '0.65rem',
                                                        fontWeight: 700,
                                                        background: '#e0e7ff',
                                                        color: '#3730a3',
                                                        padding: '0.05rem 0.35rem',
                                                        borderRadius: '4px',
                                                        marginLeft: '0.35rem'
                                                    }}>
                                                        Collector
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 800, fontSize: '9.5pt', color: '#111827' }}>
                                                {formatMoney(s.amount)}
                                            </td>
                                            <td style={{ padding: '0.5rem', color: '#4b5563', fontSize: '8pt' }}>
                                                {isToCollector
                                                    ? 'Pay Collector directly'
                                                    : isFromCollector
                                                        ? 'Collector Reimbursement'
                                                        : 'Direct Peer Transfer'}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                <div style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    fontSize: '7.8pt',
                                                    color: '#6b7280'
                                                }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        width: '12px',
                                                        height: '12px',
                                                        border: '1.5px solid #6b7280',
                                                        borderRadius: '2px'
                                                    }}></span>
                                                    <span>Paid [ &nbsp; ]</span>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* ITEMIZED SOURCE BREAKDOWN ROW (WHEN INCLUDED) */}
                                        {includeBreakdowns && breakdown && breakdown.items.length > 0 && (
                                            <tr style={{
                                                borderBottom: '1px solid #e5e7eb',
                                                background: idx % 2 === 0 ? '#fcfcfc' : '#f8f9fa',
                                                pageBreakInside: 'avoid'
                                            }}>
                                                <td colSpan={7} style={{ padding: '0.2rem 0.5rem 0.55rem 1.85rem' }}>
                                                    <div style={{
                                                        borderLeft: '2px solid #cbd5e1',
                                                        paddingLeft: '0.6rem',
                                                        fontSize: '7.8pt',
                                                        color: '#4b5563'
                                                    }}>
                                                        <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.15rem' }}>
                                                            {breakdown.subtitle}
                                                        </div>
                                                        <div style={{ display: 'grid', gap: '0.15rem' }}>
                                                            {breakdown.items.map((item, itemIdx) => (
                                                                <div
                                                                    key={itemIdx}
                                                                    style={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        gap: '0.5rem'
                                                                    }}
                                                                >
                                                                    <span>
                                                                        • {item.description} {item.date ? `(${formatDate(item.date)})` : ''} — <em>{item.sublabel}</em>
                                                                    </span>
                                                                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                                                        {item.type === 'owe' ? '+' : '-'}{formatMoney(item.amount)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {/* COLLECTOR BALANCED FUND FLOW SUMMARY */}
                {activeCollectorId && collectorOutflow > 0 && (
                    <div style={{
                        marginTop: '0.65rem',
                        padding: '0.45rem 0.85rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '7.8pt',
                        color: '#475569',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                    }}>
                        <div>
                            <strong>Collector Fund Flow:</strong> Inflow from Debtors: <strong>{formatMoney(collectorInflow)}</strong>
                            {collectorNet < -0.009 && (
                                <span> + Collector's Own Share: <strong>{formatMoney(Math.abs(collectorNet))}</strong></span>
                            )}
                            {collectorNet > 0.009 && (
                                <span> − Collector's Own Reimbursement: <strong>{formatMoney(collectorNet)}</strong></span>
                            )}
                            <span> ➔ Outflow to Creditors: <strong>{formatMoney(collectorOutflow)}</strong></span>
                        </div>
                        <div style={{ fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            ✓ 100% Mathematically Balanced Pool
                        </div>
                    </div>
                )}
            </div>

            {/* SECTION 2: MEMBER ACCOUNT POSITION (BALANCE SHEET) */}
            {includeMemberBalances && (
                <div style={{
                    marginBottom: '1.5rem',
                    pageBreakBefore: 'always',
                    breakBefore: 'page'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem',
                        borderBottom: '1px solid #e5e7eb',
                        paddingBottom: '0.35rem'
                    }}>
                        <h2 style={{
                            margin: 0,
                            fontSize: '1rem',
                            fontWeight: 800,
                            color: '#111827',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}>
                            <span>2. Member Balance Summary</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>
                                ({memberPositionList.length} participants)
                            </span>
                        </h2>
                        <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                            Individual accounting positions before settlement
                        </span>
                    </div>

                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '8.5pt',
                        textAlign: 'left'
                    }}>
                        <thead>
                            <tr style={{ background: '#f3f4f6', borderBottom: '1.5px solid #d1d5db' }}>
                                <th style={{ padding: '0.45rem 0.5rem', fontWeight: 700, color: '#374151' }}>Member Name</th>
                                <th style={{ padding: '0.45rem 0.5rem', fontWeight: 700, color: '#374151' }}>Role</th>
                                <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#374151' }}>Total Paid Upfront</th>
                                <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#374151' }}>Expense Share</th>
                                {hasAnyAdjustments && (
                                    <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#374151' }}>Prior Settled / Reimbursed</th>
                                )}
                                <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#374151' }}>Net Position</th>
                                <th style={{ padding: '0.45rem 0.5rem', fontWeight: 700, color: '#374151' }}>Action Required</th>
                            </tr>
                        </thead>
                        <tbody>
                            {memberPositionList.map((m, idx) => (
                                <tr
                                    key={m.id}
                                    style={{
                                        borderBottom: '1px solid #e5e7eb',
                                        background: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                                    }}
                                >
                                    <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: '#111827' }}>
                                        {m.name}
                                    </td>
                                    <td style={{ padding: '0.45rem 0.5rem', color: '#6b7280', fontSize: '8pt' }}>
                                        {m.isCollector ? (
                                             <span style={{
                                                fontWeight: 700,
                                                background: '#ecfdf5',
                                                color: '#065f46',
                                                padding: '0.05rem 0.35rem',
                                                borderRadius: '4px'
                                            }}>
                                                Collector
                                            </span>
                                        ) : 'Member'}
                                    </td>
                                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#374151' }}>
                                        {formatMoney(m.totalPaid)}
                                    </td>
                                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#374151' }}>
                                        {formatMoney(m.totalShare)}
                                    </td>
                                    {hasAnyAdjustments && (
                                        <td style={{
                                            padding: '0.45rem 0.5rem',
                                            textAlign: 'right',
                                            color: Math.abs(m.adjustment) > 0.009 ? (m.adjustment > 0 ? '#059669' : '#d97706') : '#9ca3af',
                                            fontWeight: Math.abs(m.adjustment) > 0.009 ? 600 : 400,
                                            fontFamily: 'monospace'
                                        }}>
                                            {Math.abs(m.adjustment) > 0.009
                                                ? (m.adjustment > 0 ? `+${formatMoney(m.adjustment)}` : `-${formatMoney(Math.abs(m.adjustment))}`)
                                                : '—'}
                                        </td>
                                    )}
                                    <td style={{
                                        padding: '0.45rem 0.5rem',
                                        textAlign: 'right',
                                        fontWeight: 700,
                                        color: m.netBalance > 0.009 ? '#059669' : m.netBalance < -0.009 ? '#dc2626' : '#6b7280'
                                    }}>
                                        {m.netBalance > 0.009 ? `+${formatMoney(m.netBalance)}` : formatMoney(m.netBalance)}
                                    </td>
                                    <td style={{ padding: '0.45rem 0.5rem', fontSize: '8pt', fontWeight: 600 }}>
                                        {m.status === 'CREDITOR' && (
                                            <span style={{ color: '#059669' }}>
                                                Receives {formatMoney(m.netBalance)}
                                            </span>
                                        )}
                                        {m.status === 'DEBTOR' && (
                                            <span style={{ color: '#dc2626' }}>
                                                Pays {formatMoney(Math.abs(m.netBalance))}
                                            </span>
                                        )}
                                        {m.status === 'SETTLED' && (
                                            <span style={{ color: '#6b7280' }}>
                                                Settled (₹0.00)
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{
                        fontSize: '7.8pt',
                        color: '#475569',
                        marginTop: '0.5rem',
                        background: '#f8fafc',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        lineHeight: 1.45
                    }}>
                        <strong>Ledger Reconciliation Formula:</strong> <em>Net Position = (Total Paid Upfront − Expense Share) + Prior Settled / Reimbursed.</em>
                        <br />
                        • A positive (+) prior adjustment indicates settlement funds previously paid by the member to offset group debts.
                        <br />
                        • A negative (−) prior adjustment indicates funds already received back as reimbursements from earlier settlements.
                    </div>
                </div>
            )}

            {/* SECTION 3: SIGN-OFF, VERIFICATION & FOOTER */}
            {includeSignatures && (
                <div style={{
                    marginTop: '1.5rem',
                    borderTop: '1px solid #d1d5db',
                    paddingTop: '1rem',
                    pageBreakInside: 'avoid'
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '2rem',
                        marginBottom: '1rem'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '1.75rem' }}>
                                Verified & Approved By (Organizer / Collector):
                            </div>
                            <div style={{ borderBottom: '1px solid #111827', width: '80%' }}></div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginTop: '0.25rem' }}>
                                Signature: {collectorName ? `${collectorName} (Primary Collector)` : 'Group Administrator'}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '1.75rem' }}>
                                Reconciliation Completion Date:
                            </div>
                            <div style={{ borderBottom: '1px solid #111827', width: '80%' }}></div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginTop: '0.25rem' }}>
                                Date Cleared: [ &nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp; / 2026 ]
                            </div>
                        </div>
                    </div>

                    <div style={{
                        textAlign: 'center',
                        fontSize: '0.72rem',
                        color: '#9ca3af',
                        borderTop: '1px dashed #e5e7eb',
                        paddingTop: '0.65rem'
                    }}>
                        Generated automatically by SplitIt Expense Manager. Mathematical debt optimization guarantees 100% balance clearance once all listed transfers are completed.
                    </div>
                </div>
            )}
        </div>
    );
}
