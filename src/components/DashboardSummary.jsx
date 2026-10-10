import React from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { TrendingUp, Users, Receipt, Scale, Layers, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function DashboardSummary() {
    const {
        state,
        balances,
        selectedGroupId,
        selectedGroup,
        getGroupBalances,
        currentUserGroupSummary
    } = useExpenses();

    const isGroupSelected = !!selectedGroupId && !!selectedGroup;

    const transactions = isGroupSelected
        ? (state.transactions || []).filter(t => selectedGroupId === 'non-group' ? (!t.groupId || t.groupId === 'non-group') : t.groupId === selectedGroupId)
        : (state.transactions || []);
    const expenses = transactions.filter(t => t.type === 'EXPENSE');

    const membersCount = isGroupSelected
        ? (selectedGroup.members?.length || 0)
        : (state.users || []).length;

    const activeBalances = isGroupSelected
        ? getGroupBalances(selectedGroupId)
        : balances;

    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const pendingSettlements = Object.values(activeBalances).filter(bal => Math.abs(bal) > 0.01).length;

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const stats = isGroupSelected ? [
        {
            icon: TrendingUp,
            label: `${selectedGroup.name} Total`,
            value: formatMoney(totalExpenses),
            accent: 'hsl(var(--color-accent))',
            sub: `${expenses.length} expenses recorded`
        },
        {
            icon: Scale,
            label: 'Your Net Balance',
            value: currentUserGroupSummary.status === 'owed'
                ? `+${formatMoney(currentUserGroupSummary.amount)}`
                : currentUserGroupSummary.status === 'owe'
                    ? `-${formatMoney(currentUserGroupSummary.amount)}`
                    : '₹0.00',
            accent: currentUserGroupSummary.status === 'owed'
                ? 'hsl(var(--color-success))'
                : currentUserGroupSummary.status === 'owe'
                    ? 'hsl(var(--color-danger))'
                    : 'hsl(var(--color-text-muted))',
            sub: currentUserGroupSummary.status === 'owed' ? 'You are owed' : currentUserGroupSummary.status === 'owe' ? 'You owe money' : 'All settled'
        },
        {
            icon: Receipt,
            label: 'Transactions',
            value: transactions.length,
            accent: '#3b82f6',
            sub: 'Expenses & settlements'
        },
        {
            icon: Users,
            label: 'Members',
            value: membersCount,
            accent: '#8b5cf6',
            sub: 'In this group'
        },
    ] : [
        {
            icon: TrendingUp,
            label: 'Total Expenses',
            value: formatMoney(totalExpenses),
            accent: 'hsl(var(--color-accent))',
            sub: `Across all ${state.groups?.length || 0} groups`
        },
        {
            icon: Scale,
            label: 'Your Total Balance',
            value: currentUserGroupSummary.status === 'owed'
                ? `+${formatMoney(currentUserGroupSummary.amount)}`
                : currentUserGroupSummary.status === 'owe'
                    ? `-${formatMoney(currentUserGroupSummary.amount)}`
                    : '₹0.00',
            accent: currentUserGroupSummary.status === 'owed'
                ? 'hsl(var(--color-success))'
                : currentUserGroupSummary.status === 'owe'
                    ? 'hsl(var(--color-danger))'
                    : 'hsl(var(--color-text-muted))',
            sub: currentUserGroupSummary.status === 'owed' ? 'You are owed' : currentUserGroupSummary.status === 'owe' ? 'You owe money' : 'All settled'
        },
        {
            icon: Layers,
            label: 'Active Groups',
            value: (state.groups || []).length,
            accent: '#8b5cf6',
            sub: `${(state.users || []).length} total members`
        },
        {
            icon: Receipt,
            label: 'Transactions',
            value: transactions.length,
            accent: '#3b82f6',
            sub: `${pendingSettlements} pending balances`
        },
    ];

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
        }}>
            {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                    <div
                        key={index}
                        className="card card-interactive"
                        style={{
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <span style={{
                                fontSize: '0.78rem',
                                color: 'hsl(var(--color-text-muted))',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {stat.label}
                            </span>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--radius-md)',
                                background: `${stat.accent}15`,
                                color: stat.accent,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Icon size={18} />
                            </div>
                        </div>

                        <div>
                            <div style={{
                                fontSize: '1.75rem',
                                fontWeight: 800,
                                color: stat.accent,
                                lineHeight: 1.15,
                                letterSpacing: '-0.5px'
                            }}>
                                {stat.value}
                            </div>
                            <div style={{
                                fontSize: '0.78rem',
                                color: 'hsl(var(--color-text-muted))',
                                marginTop: '0.35rem'
                            }}>
                                {stat.sub}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
