import React, { createContext, useReducer, useContext, useEffect, useMemo } from 'react';

// CURRENCIES
const CURRENCIES = {
    INR: { symbol: '₹', name: 'Indian Rupee' },
    USD: { symbol: '$', name: 'US Dollar' },
    EUR: { symbol: '€', name: 'Euro' },
    GBP: { symbol: '£', name: 'British Pound' },
    JPY: { symbol: '¥', name: 'Japanese Yen' },
    AUD: { symbol: 'A$', name: 'Australian Dollar' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar' },
};

// INITIAL SEED DATA
const seedUsers = [
    { id: 'u_you', name: 'Athul' },
    { id: 'u_adhish', name: 'Adhish' },
    { id: 'u_suryakiran', name: 'Suryakiran M.' },
    { id: 'u_vishal', name: 'Vishal' },
    { id: 'u_shiburaj', name: 'Shiburaj' },
    { id: 'u_swetha', name: 'Swetha' },
    { id: 'u_bob', name: 'Bob' },
];

const seedGroups = [
    {
        id: 'grp_iedc',
        name: 'IEDC Summit 2026',
        type: 'trip',
        icon: 'plane',
        color: '#10b981',
        members: ['u_you', 'u_adhish', 'u_suryakiran', 'u_vishal'],
        simplifyDebts: true,
        createdAt: '2026-10-01T08:00:00.000Z'
    },
    {
        id: 'grp_infosys',
        name: 'Infosys Exam',
        type: 'project',
        icon: 'clipboard',
        color: '#f97316',
        members: ['u_you', 'u_shiburaj', 'u_swetha', 'u_bob'],
        simplifyDebts: true,
        createdAt: '2026-10-02T10:00:00.000Z'
    }
];

const seedTransactions = [
    {
        id: 'tx_iedc_1',
        type: 'EXPENSE',
        groupId: 'grp_iedc',
        description: 'Flight & Travel to Summit',
        amount: 500.00,
        date: '2026-10-01T09:30:00.000Z',
        createdAt: '2026-10-01T09:30:00.000Z',
        updatedAt: '2026-10-01T09:30:00.000Z',
        payers: [{ userId: 'u_you', amount: 500.00 }],
        splits: [
            { userId: 'u_you', amount: 124.95 },
            { userId: 'u_adhish', amount: 190.05 },
            { userId: 'u_suryakiran', amount: 185.00 }
        ]
    },
    {
        id: 'tx_iedc_2',
        type: 'EXPENSE',
        groupId: 'grp_iedc',
        description: 'Summit Registration Fee',
        amount: 320.00,
        date: '2026-10-01T14:15:00.000Z',
        createdAt: '2026-10-01T14:15:00.000Z',
        updatedAt: '2026-10-01T14:15:00.000Z',
        payers: [{ userId: 'u_suryakiran', amount: 320.00 }],
        splits: [{ userId: 'u_you', amount: 320.00 }]
    },
    {
        id: 'tx_iedc_3',
        type: 'EXPENSE',
        groupId: 'grp_iedc',
        description: 'Airport Coffee & Refreshments',
        amount: 0.10,
        date: '2026-10-02T07:45:00.000Z',
        createdAt: '2026-10-02T07:45:00.000Z',
        updatedAt: '2026-10-02T07:45:00.000Z',
        payers: [{ userId: 'u_you', amount: 0.10 }],
        splits: [
            { userId: 'u_you', amount: 0.05 },
            { userId: 'u_vishal', amount: 0.05 }
        ]
    },
    {
        id: 'tx_info_1',
        type: 'EXPENSE',
        groupId: 'grp_infosys',
        description: 'Exam Preparation & Study Material',
        amount: 6000.00,
        date: '2026-10-02T11:00:00.000Z',
        createdAt: '2026-10-02T11:00:00.000Z',
        updatedAt: '2026-10-02T11:00:00.000Z',
        payers: [{ userId: 'u_you', amount: 6000.00 }],
        splits: [
            { userId: 'u_you', amount: 279.35 },
            { userId: 'u_shiburaj', amount: 5720.65 }
        ]
    },
    {
        id: 'tx_info_2',
        type: 'EXPENSE',
        groupId: 'grp_infosys',
        description: 'Hostel Booking & Stay',
        amount: 1156.00,
        date: '2026-10-03T16:20:00.000Z',
        createdAt: '2026-10-03T16:20:00.000Z',
        updatedAt: '2026-10-03T16:20:00.000Z',
        payers: [{ userId: 'u_swetha', amount: 1156.00 }],
        splits: [{ userId: 'u_you', amount: 1156.00 }]
    },
    {
        id: 'tx_info_3',
        type: 'EXPENSE',
        groupId: 'grp_infosys',
        description: 'Exam Center Commute Cab',
        amount: 4784.99,
        date: '2026-10-04T08:00:00.000Z',
        createdAt: '2026-10-04T08:00:00.000Z',
        updatedAt: '2026-10-04T08:00:00.000Z',
        payers: [{ userId: 'u_bob', amount: 4784.99 }],
        splits: [{ userId: 'u_you', amount: 4784.99 }]
    }
];

// STABLE INITIAL STATE
const initialState = {
    users: seedUsers,
    groups: seedGroups,
    currentUserId: 'u_you',
    transactions: seedTransactions,
    currency: 'INR',
    selectedGroupId: null, // null = All Groups, or 'grp_...' or 'non-group'
};

// ACTIONS
const ADD_USER = 'ADD_USER';
const DELETE_USER = 'DELETE_USER';
const ADD_GROUP = 'ADD_GROUP';
const UPDATE_GROUP = 'UPDATE_GROUP';
const DELETE_GROUP = 'DELETE_GROUP';
const SET_SELECTED_GROUP = 'SET_SELECTED_GROUP';
const SET_CURRENT_USER = 'SET_CURRENT_USER';
const ADD_TRANSACTION = 'ADD_TRANSACTION';
const UPDATE_TRANSACTION = 'UPDATE_TRANSACTION';
const DELETE_TRANSACTION = 'DELETE_TRANSACTION';
const SET_CURRENCY = 'SET_CURRENCY';
const IMPORT_DATA = 'IMPORT_DATA';

// REDUCER
function expenseReducer(state, action) {
    switch (action.type) {
        case SET_SELECTED_GROUP:
            return {
                ...state,
                selectedGroupId: action.payload || null
            };
        case ADD_USER: {
            const newUser = action.payload;
            return {
                ...state,
                users: [...state.users, newUser],
            };
        }
        case DELETE_USER:
            return {
                ...state,
                users: state.users.filter(u => u.id !== action.payload),
                // Remove user from groups
                groups: (state.groups || []).map(g => ({
                    ...g,
                    members: g.members.filter(mId => mId !== action.payload)
                })),
                currentUserId: state.currentUserId === action.payload
                    ? (state.users.find(u => u.id !== action.payload)?.id || '')
                    : state.currentUserId
            };
        case ADD_GROUP: {
            const newGroup = {
                ...action.payload,
                createdAt: action.payload.createdAt || new Date().toISOString()
            };
            return {
                ...state,
                groups: [...(state.groups || []), newGroup]
            };
        }
        case UPDATE_GROUP:
            return {
                ...state,
                groups: (state.groups || []).map(g =>
                    g.id === action.payload.id ? { ...g, ...action.payload } : g
                )
            };
        case DELETE_GROUP: {
            const groupIdToDelete = action.payload;
            return {
                ...state,
                selectedGroupId: state.selectedGroupId === groupIdToDelete ? null : state.selectedGroupId,
                groups: (state.groups || []).filter(g => g.id !== groupIdToDelete),
                // Reassign transactions of deleted group to non-group
                transactions: (state.transactions || []).map(t =>
                    t.groupId === groupIdToDelete ? { ...t, groupId: null } : t
                )
            };
        }
        case SET_CURRENT_USER:
            return {
                ...state,
                currentUserId: action.payload
            };
        case ADD_TRANSACTION: {
            const now = new Date().toISOString();
            const newTx = {
                ...action.payload,
                createdAt: action.payload.createdAt || now,
                updatedAt: action.payload.updatedAt || now
            };
            return {
                ...state,
                transactions: [newTx, ...state.transactions]
            };
        }
        case UPDATE_TRANSACTION: {
            const now = new Date().toISOString();
            return {
                ...state,
                transactions: state.transactions.map(t =>
                    t.id === action.payload.id
                        ? {
                            ...action.payload,
                            createdAt: t.createdAt || now,
                            updatedAt: now
                        }
                        : t
                )
            };
        }
        case DELETE_TRANSACTION:
            return {
                ...state,
                transactions: state.transactions.filter(t => t.id !== action.payload)
            };
        case SET_CURRENCY:
            return {
                ...state,
                currency: action.payload
            };
        case IMPORT_DATA:
            return {
                ...state,
                ...action.payload,
                groups: action.payload.groups || seedGroups,
                currentUserId: action.payload.currentUserId || (action.payload.users?.[0]?.id || 'u_you')
            };
        default:
            return state;
    }
}

// CONTEXT
const ExpenseContext = createContext(null);

// HELPER: Debt Simplification Algorithm
function calculateSimplifiedSettlementsFromBalances(balances) {
    const creditors = [];
    const debtors = [];

    Object.entries(balances).forEach(([userId, balance]) => {
        if (balance > 0.009) {
            creditors.push({ userId, amount: balance });
        } else if (balance < -0.009) {
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

        if (settleAmount > 0.009) {
            settlements.push({
                from: debtor.userId,
                to: creditor.userId,
                amount: Math.round(settleAmount * 100) / 100
            });
        }

        debtor.amount -= settleAmount;
        creditor.amount -= settleAmount;

        if (debtor.amount < 0.009) i++;
        if (creditor.amount < 0.009) j++;
    }

    return settlements;
}

// HELPER: Collector-Centric Debt Simplification
function calculateCollectorSimplifiedSettlements(balances, collectorId) {
    if (!collectorId || balances[collectorId] === undefined) {
        return calculateSimplifiedSettlementsFromBalances(balances);
    }

    const creditors = [];
    const debtors = [];

    Object.entries(balances).forEach(([userId, balance]) => {
        if (balance > 0.009) {
            creditors.push({ userId, amount: balance });
        } else if (balance < -0.009) {
            debtors.push({ userId, amount: -balance });
        }
    });

    if (debtors.length === 0 || creditors.length === 0) {
        return [];
    }

    const settlements = [];
    let collectorInflow = 0;

    // 1. Other debtors pay the designated collector
    debtors.forEach(d => {
        if (d.userId !== collectorId) {
            settlements.push({
                from: d.userId,
                to: collectorId,
                amount: Math.round(d.amount * 100) / 100,
                isCollectorRoute: true
            });
            collectorInflow += d.amount;
        }
    });

    // 2. Collector settles with creditors
    const collectorDirectDebt = debtors.find(d => d.userId === collectorId)?.amount || 0;
    const collectorDirectCredit = creditors.find(c => c.userId === collectorId)?.amount || 0;
    let collectorOutflow = collectorInflow + collectorDirectDebt - collectorDirectCredit;

    creditors.forEach(c => {
        if (c.userId !== collectorId && collectorOutflow > 0.009) {
            const payAmt = Math.min(collectorOutflow, c.amount);
            if (payAmt > 0.009) {
                settlements.push({
                    from: collectorId,
                    to: c.userId,
                    amount: Math.round(payAmt * 100) / 100,
                    isCollectorRoute: true
                });
                collectorOutflow -= payAmt;
            }
        }
    });

    return settlements;
}

// PROVIDER
export function ExpenseProvider({ children }) {
    // Helper: Safe ID Generator
    const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));

    // Safe localStorage loading
    const loadState = () => {
        try {
            const saved = localStorage.getItem('expense_manager_data');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate structure
                if (
                    typeof parsed === 'object' &&
                    Array.isArray(parsed.users) &&
                    Array.isArray(parsed.transactions) &&
                    typeof parsed.currency === 'string'
                ) {
                    // Check if existing state was just the empty 2-user default without transactions
                    const isOldDefault =
                        parsed.users.length === 2 &&
                        parsed.users[0]?.id === 'u1' &&
                        parsed.transactions.length === 0 &&
                        (!parsed.groups || parsed.groups.length === 0);

                    if (isOldDefault) {
                        return initialState;
                    }

                    // Ensure groups exists
                    const groups = Array.isArray(parsed.groups) && parsed.groups.length > 0
                        ? parsed.groups
                        : seedGroups;

                    // Ensure currentUserId exists
                    const currentUserId = parsed.currentUserId || parsed.users[0]?.id || 'u_you';
                    const selectedGroupId = parsed.selectedGroupId || null;

                    return {
                        ...parsed,
                        groups,
                        currentUserId,
                        selectedGroupId,
                    };
                }
            }
        } catch (e) {
            console.error('Failed to load data from localStorage:', e);
        }
        return initialState;
    };

    const [state, dispatch] = useReducer(expenseReducer, initialState, loadState);

    // Save to localStorage on every state change
    useEffect(() => {
        try {
            localStorage.setItem('expense_manager_data', JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save data to localStorage:', e);
        }
    }, [state]);

    const addUser = (name) => {
        const id = generateId();
        dispatch({
            type: ADD_USER,
            payload: { id, name }
        });
        return id;
    };

    const deleteUser = (userId) => {
        dispatch({
            type: DELETE_USER,
            payload: userId
        });
    };

    const addGroup = ({ name, type = 'other', icon = 'users', color = '#10b981', members = [], simplifyDebts = true, defaultCollectorId = null }) => {
        const id = 'grp_' + generateId();
        dispatch({
            type: ADD_GROUP,
            payload: {
                id,
                name,
                type,
                icon,
                color,
                members,
                simplifyDebts,
                defaultCollectorId: defaultCollectorId || null,
                createdAt: new Date().toISOString()
            }
        });
        return id;
    };

    const updateGroup = (id, updates) => {
        dispatch({
            type: UPDATE_GROUP,
            payload: { id, ...updates }
        });
    };

    const deleteGroup = (groupId) => {
        dispatch({
            type: DELETE_GROUP,
            payload: groupId
        });
    };

    const setCurrentUserId = (userId) => {
        dispatch({
            type: SET_CURRENT_USER,
            payload: userId
        });
    };

    const setSelectedGroupId = (groupId) => {
        dispatch({
            type: SET_SELECTED_GROUP,
            payload: groupId || null
        });
    };

    const addMemberToGroup = (groupId, userId) => {
        const grp = (state.groups || []).find(g => g.id === groupId);
        if (grp && !grp.members.includes(userId)) {
            updateGroup(groupId, { members: [...grp.members, userId] });
        }
    };

    const removeMemberFromGroup = (groupId, userId) => {
        const grp = (state.groups || []).find(g => g.id === groupId);
        if (grp) {
            updateGroup(groupId, { members: grp.members.filter(m => m !== userId) });
        }
    };

    const addExpense = (description, amount, date, payers, splits, groupId = null, collectorId = null) => {
        dispatch({
            type: ADD_TRANSACTION,
            payload: {
                id: generateId(),
                type: 'EXPENSE',
                groupId: groupId || null,
                collectorId: collectorId || null,
                description,
                amount: parseFloat(amount),
                date,
                payers, // Array of { userId, amount }
                splits, // Array of { userId, amount }
            }
        });
    };

    const updateExpense = (id, description, amount, date, payers, splits, groupId = null, collectorId = null) => {
        dispatch({
            type: UPDATE_TRANSACTION,
            payload: {
                id,
                type: 'EXPENSE',
                groupId: groupId || null,
                collectorId: collectorId || null,
                description,
                amount: parseFloat(amount),
                date,
                payers,
                splits,
            }
        });
    };

    const deleteTransaction = (id) => {
        dispatch({
            type: DELETE_TRANSACTION,
            payload: id
        });
    };

    const addSettlement = (fromUserId, toUserId, amount, date, groupId = null) => {
        dispatch({
            type: ADD_TRANSACTION,
            payload: {
                id: generateId(),
                type: 'SETTLEMENT',
                groupId: groupId || null,
                description: 'Settlement',
                amount: parseFloat(amount),
                date,
                from: fromUserId,
                to: toUserId,
            }
        });
    };

    const updateSettlement = (id, fromUserId, toUserId, amount, date, groupId = null) => {
        dispatch({
            type: UPDATE_TRANSACTION,
            payload: {
                id,
                type: 'SETTLEMENT',
                groupId: groupId || null,
                description: 'Settlement',
                amount: parseFloat(amount),
                date,
                from: fromUserId,
                to: toUserId,
            }
        });
    };

    const setCurrency = (currencyCode) => {
        if (CURRENCIES[currencyCode]) {
            dispatch({
                type: SET_CURRENCY,
                payload: currencyCode
            });
        }
    };

    // Calculate balances for a specific group (or 'non-group' for non-group expenses)
    const getGroupBalances = useMemo(() => {
        return (groupId) => {
            const groupTx = (state.transactions || []).filter(t => {
                if (groupId === 'non-group' || !groupId) {
                    return !t.groupId || t.groupId === 'non-group';
                }
                return t.groupId === groupId;
            });

            const balances = {};
            const group = (state.groups || []).find(g => g.id === groupId);
            const memberIds = group ? group.members : state.users.map(u => u.id);

            memberIds.forEach(id => {
                balances[id] = 0;
            });

            groupTx.forEach(t => {
                if (t.type === 'EXPENSE') {
                    (t.payers || []).forEach(p => {
                        balances[p.userId] = (balances[p.userId] || 0) + p.amount;
                    });
                    (t.splits || []).forEach(s => {
                        balances[s.userId] = (balances[s.userId] || 0) - s.amount;
                    });
                }
                if (t.type === 'SETTLEMENT') {
                    if (balances[t.from] !== undefined) balances[t.from] += t.amount;
                    if (balances[t.to] !== undefined) balances[t.to] -= t.amount;
                }
            });

            return balances;
        };
    }, [state.groups, state.transactions, state.users]);

    // Calculate pairwise debts for a group from perspective of a user
    const getGroupPairwiseDebts = useMemo(() => {
        return (groupId, userId = state.currentUserId) => {
            const balances = getGroupBalances(groupId);
            const myNetBalance = balances[userId] || 0;
            const group = (state.groups || []).find(g => g.id === groupId);
            const isSimplified = group ? (group.simplifyDebts !== false) : true;

            const groupTx = (state.transactions || []).filter(t => {
                if (groupId === 'non-group' || !groupId) return !t.groupId || t.groupId === 'non-group';
                return t.groupId === groupId;
            });

            const activeCollectorId = group?.defaultCollectorId || groupTx.find(t => t.collectorId)?.collectorId || null;

            if (isSimplified) {
                const settlements = activeCollectorId
                    ? calculateCollectorSimplifiedSettlements(balances, activeCollectorId)
                    : calculateSimplifiedSettlementsFromBalances(balances);
                const debts = [];

                settlements.forEach(s => {
                    if (s.from === userId) {
                        debts.push({
                            otherUserId: s.to,
                            amount: s.amount,
                            type: 'you_owe'
                        });
                    } else if (s.to === userId) {
                        debts.push({
                            otherUserId: s.from,
                            amount: s.amount,
                            type: 'owes_you'
                        });
                    }
                });

                return {
                    netBalance: Math.round(myNetBalance * 100) / 100,
                    debts,
                    allSettlements: settlements
                };
            } else {
                const memberIds = group ? group.members : state.users.map(u => u.id);
                const debtMatrix = {};
                memberIds.forEach(m1 => {
                    debtMatrix[m1] = {};
                    memberIds.forEach(m2 => { debtMatrix[m1][m2] = 0; });
                });

                groupTx.forEach(t => {
                    if (t.type === 'EXPENSE') {
                        const collectorId = t.collectorId;
                        const payers = t.payers || [];
                        const splits = t.splits || [];
                        const totalAmt = parseFloat(t.amount) || 1;

                        if (collectorId && memberIds.includes(collectorId)) {
                            splits.forEach(s => {
                                if (s.userId !== collectorId && debtMatrix[s.userId] && debtMatrix[s.userId][collectorId] !== undefined) {
                                    debtMatrix[s.userId][collectorId] += s.amount;
                                }
                            });
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

                const debts = [];
                memberIds.forEach(otherId => {
                    if (otherId === userId) return;
                    const myDebtToOther = debtMatrix[userId]?.[otherId] || 0;
                    const otherDebtToMe = debtMatrix[otherId]?.[userId] || 0;
                    const net = otherDebtToMe - myDebtToOther;

                    if (Math.abs(net) > 0.009) {
                        const rounded = Math.round(Math.abs(net) * 100) / 100;
                        if (net > 0) {
                            debts.push({ otherUserId: otherId, amount: rounded, type: 'owes_you' });
                        } else {
                            debts.push({ otherUserId: otherId, amount: rounded, type: 'you_owe' });
                        }
                    }
                });

                return {
                    netBalance: Math.round(myNetBalance * 100) / 100,
                    debts,
                    allSettlements: []
                };
            }
        };
    }, [getGroupBalances, state.currentUserId, state.groups, state.transactions, state.users]);

    // Derived State: Global Balances across all transactions
    const balances = useMemo(() => {
        const globalBalances = {};
        state.users.forEach(u => globalBalances[u.id] = 0);

        (state.transactions || []).forEach(t => {
            if (t.type === 'EXPENSE') {
                (t.payers || []).forEach(p => {
                    if (globalBalances[p.userId] !== undefined) {
                        globalBalances[p.userId] += p.amount;
                    }
                });
                (t.splits || []).forEach(s => {
                    if (globalBalances[s.userId] !== undefined) {
                        globalBalances[s.userId] -= s.amount;
                    }
                });
            }
            if (t.type === 'SETTLEMENT') {
                if (globalBalances[t.from] !== undefined) globalBalances[t.from] += t.amount;
                if (globalBalances[t.to] !== undefined) globalBalances[t.to] -= t.amount;
            }
        });

        return globalBalances;
    }, [state.users, state.transactions]);

    // Current User Overall Balance across all groups
    const currentUserOverall = useMemo(() => {
        const net = balances[state.currentUserId] || 0;
        return {
            net: Math.round(net * 100) / 100,
            status: net > 0.009 ? 'owed' : net < -0.009 ? 'owe' : 'settled',
            amount: Math.abs(Math.round(net * 100) / 100)
        };
    }, [balances, state.currentUserId]);

    // Export Data
    const exportData = () => {
        const exportObject = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            data: state
        };
        return JSON.stringify(exportObject, null, 2);
    };

    // Import Data
    const importData = (jsonString) => {
        try {
            const imported = JSON.parse(jsonString);
            if (!imported.data || typeof imported.data !== 'object') {
                throw new Error('Invalid data structure: missing data object');
            }
            const { data } = imported;
            if (!Array.isArray(data.users)) throw new Error('users must be an array');
            if (!Array.isArray(data.transactions)) throw new Error('transactions must be an array');
            if (typeof data.currency !== 'string') throw new Error('currency must be a string');

            dispatch({
                type: IMPORT_DATA,
                payload: data
            });

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to import data'
            };
        }
    };

    // Active Group Object
    const selectedGroup = useMemo(() => {
        if (!state.selectedGroupId) return null;
        if (state.selectedGroupId === 'non-group') {
            return {
                id: 'non-group',
                name: 'Non-group expenses',
                type: 'nongroup',
                icon: 'nongroup',
                color: '#6366f1',
                members: state.users.map(u => u.id),
                simplifyDebts: true
            };
        }
        return (state.groups || []).find(g => g.id === state.selectedGroupId) || null;
    }, [state.selectedGroupId, state.groups, state.users]);

    // Filtered Transactions for Active Group
    const filteredTransactions = useMemo(() => {
        if (!state.selectedGroupId) return state.transactions || [];
        if (state.selectedGroupId === 'non-group') {
            return (state.transactions || []).filter(t => !t.groupId || t.groupId === 'non-group');
        }
        return (state.transactions || []).filter(t => t.groupId === state.selectedGroupId);
    }, [state.selectedGroupId, state.transactions]);

    // Current User Summary for Active Group or Overall
    const currentUserGroupSummary = useMemo(() => {
        if (state.selectedGroupId) {
            const debtsInfo = getGroupPairwiseDebts(state.selectedGroupId, state.currentUserId);
            const net = debtsInfo.netBalance;
            return {
                net,
                status: net > 0.009 ? 'owed' : net < -0.009 ? 'owe' : 'settled',
                amount: Math.abs(net),
                debts: debtsInfo.debts,
                allSettlements: debtsInfo.allSettlements
            };
        }
        return {
            ...currentUserOverall,
            debts: [],
            allSettlements: []
        };
    }, [state.selectedGroupId, getGroupPairwiseDebts, state.currentUserId, currentUserOverall]);

    return (
        <ExpenseContext.Provider value={{
            state,
            selectedGroupId: state.selectedGroupId,
            setSelectedGroupId,
            selectedGroup,
            filteredTransactions,
            currentUserGroupSummary,
            addMemberToGroup,
            removeMemberFromGroup,
            addUser,
            deleteUser,
            addGroup,
            updateGroup,
            deleteGroup,
            setCurrentUserId,
            addExpense,
            updateExpense,
            deleteTransaction,
            addSettlement,
            updateSettlement,
            balances,
            currentUserOverall,
            getGroupBalances,
            getGroupPairwiseDebts,
            calculateCollectorSimplifiedSettlements,
            setCurrency,
            exportData,
            importData,
            currencies: CURRENCIES
        }}>
            {children}
        </ExpenseContext.Provider>
    );
}

// HOOK
// eslint-disable-next-line react-refresh/only-export-components
export function useExpenses() {
    const context = useContext(ExpenseContext);
    if (!context) {
        throw new Error("useExpenses must be used within an ExpenseProvider");
    }
    return context;
}
