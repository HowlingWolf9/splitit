import React from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { TrendingUp, Users, Receipt, Scale } from 'lucide-react';

export default function DashboardSummary() {
    const { state, getBalances } = useExpenses();

    const transactions = state.transactions || [];
    const expenses = transactions.filter(t => t.type === 'EXPENSE');
    const settlements = transactions.filter(t => t.type === 'SETTLEMENT');
    const users = state.users || [];
    const balances = getBalances();

    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate pending settlements (users with non-zero balances)
    const pendingSettlements = Object.values(balances).filter(bal => Math.abs(bal) > 0.01).length;

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    const stats = [
        {
            icon: TrendingUp,
            label: 'Total Expenses',
            value: formatMoney(totalExpenses),
            color: 'hsl(var(--color-accent))'
        },
        {
            icon: Receipt,
            label: 'Transactions',
            value: transactions.length,
            color: 'hsl(var(--color-primary))'
        },
        {
            icon: Users,
            label: 'Members',
            value: users.length,
            color: 'hsl(var(--color-success))'
        },
        {
            icon: Scale,
            label: 'Pending Balances',
            value: pendingSettlements,
            color: pendingSettlements > 0 ? 'hsl(var(--color-warning))' : 'hsl(var(--color-success))'
        }
    ];

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
        }}>
            {stats.map((stat, index) => (
                <div
                    key={index}
                    className="card"
                    style={{
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        borderLeft: `4px solid ${stat.color}`,
                        transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <stat.icon size={20} style={{ color: stat.color }} />
                        <span style={{
                            fontSize: '0.85rem',
                            color: 'hsl(var(--color-text-muted))',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {stat.label}
                        </span>
                    </div>
                    <div style={{
                        fontSize: '1.75rem',
                        fontWeight: '800',
                        color: stat.color
                    }}>
                        {stat.value}
                    </div>
                </div>
            ))}
        </div>
    );
}
