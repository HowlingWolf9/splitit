import React, { createContext, useReducer, useContext, useEffect } from 'react';

// CURRENCIES
const CURRENCIES = {
    USD: { symbol: '$', name: 'US Dollar' },
    EUR: { symbol: '€', name: 'Euro' },
    GBP: { symbol: '£', name: 'British Pound' },
    INR: { symbol: '₹', name: 'Indian Rupee' },
    JPY: { symbol: '¥', name: 'Japanese Yen' },
    AUD: { symbol: 'A$', name: 'Australian Dollar' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar' },
};

// STABLE INITIAL STATE
const initialState = {
    users: [
        { id: 'u1', name: 'Alice' },
        { id: 'u2', name: 'Bob' },
    ],
    transactions: [],
    currency: 'USD',
};

// ACTIONS
const ADD_USER = 'ADD_USER';
const DELETE_USER = 'DELETE_USER';
const ADD_TRANSACTION = 'ADD_TRANSACTION';
const UPDATE_TRANSACTION = 'UPDATE_TRANSACTION';
const DELETE_TRANSACTION = 'DELETE_TRANSACTION';
const SET_CURRENCY = 'SET_CURRENCY';
const IMPORT_DATA = 'IMPORT_DATA';

// REDUCER
function expenseReducer(state, action) {
    switch (action.type) {
        case ADD_USER:
            return {
                ...state,
                users: [...state.users, action.payload]
            };
        case DELETE_USER:
            return {
                ...state,
                users: state.users.filter(u => u.id !== action.payload),
                // Note: We keep transactions as historical record
            };
        case ADD_TRANSACTION:
            return {
                ...state,
                transactions: [action.payload, ...state.transactions]
            };
        case UPDATE_TRANSACTION:
            return {
                ...state,
                transactions: state.transactions.map(t =>
                    t.id === action.payload.id ? action.payload : t
                )
            };
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
            return action.payload;
        default:
            return state;
    }
}

// CONTEXT
const ExpenseContext = createContext({
    state: initialState,
    addUser: () => { },
    deleteUser: () => { },
    addExpense: () => { },
    updateExpense: () => { },
    deleteTransaction: () => { },
    addSettlement: () => { },
    getBalances: () => ({}),
    setCurrency: () => { },
    exportData: () => { },
    importData: () => { },
    currencies: CURRENCIES,
});

// PROVIDER
export function ExpenseProvider({ children }) {
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
                    return parsed;
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

    // Helper: Safe ID Generator
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const addUser = (name) => {
        dispatch({
            type: ADD_USER,
            payload: { id: generateId(), name }
        });
    };

    const deleteUser = (userId) => {
        dispatch({
            type: DELETE_USER,
            payload: userId
        });
    };

    const addExpense = (description, amount, date, payers, splits) => {
        dispatch({
            type: ADD_TRANSACTION,
            payload: {
                id: generateId(),
                type: 'EXPENSE',
                description,
                amount: parseFloat(amount),
                date,
                payers, // Array of { userId, amount }
                splits, // Array of { userId, amount }
            }
        });
    };

    const updateExpense = (id, description, amount, date, payers, splits) => {
        dispatch({
            type: UPDATE_TRANSACTION,
            payload: {
                id,
                type: 'EXPENSE',
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

    const addSettlement = (fromUserId, toUserId, amount, date) => {
        dispatch({
            type: ADD_TRANSACTION,
            payload: {
                id: generateId(),
                type: 'SETTLEMENT',
                description: 'Settlement',
                amount: parseFloat(amount),
                date,
                from: fromUserId,
                to: toUserId,
            }
        });
    };

    const updateSettlement = (id, fromUserId, toUserId, amount, date) => {
        dispatch({
            type: UPDATE_TRANSACTION,
            payload: {
                id,
                type: 'SETTLEMENT',
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

    // Derived State: Balances
    const getBalances = () => {
        const balances = {};
        // Init all users to 0
        state.users.forEach(u => balances[u.id] = 0);

        state.transactions.forEach(t => {
            if (t.type === 'EXPENSE') {
                // Payer gets positive balance (they are owed)
                t.payers.forEach(p => {
                    if (balances[p.userId] !== undefined) {
                        balances[p.userId] += p.amount;
                    }
                });
                // Splitter gets negative balance (they owe)
                t.splits.forEach(s => {
                    if (balances[s.userId] !== undefined) {
                        balances[s.userId] -= s.amount;
                    }
                });
            }
            if (t.type === 'SETTLEMENT') {
                // Sender (from) pays money. Balance increases (debt decreases / credit increases)
                // Receiver (to) gets money. Balance decreases (debt increases / credit decreases)
                if (balances[t.from] !== undefined) balances[t.from] += t.amount;
                if (balances[t.to] !== undefined) balances[t.to] -= t.amount;
            }
        });

        return balances;
    };

    // Export Data
    const exportData = () => {
        const exportObject = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            data: state
        };
        return JSON.stringify(exportObject, null, 2);
    };

    // Import Data
    const importData = (jsonString) => {
        try {
            const imported = JSON.parse(jsonString);

            // Validate structure
            if (!imported.data || typeof imported.data !== 'object') {
                throw new Error('Invalid data structure: missing data object');
            }

            const { data } = imported;

            // Validate required fields
            if (!Array.isArray(data.users)) {
                throw new Error('Invalid data: users must be an array');
            }
            if (!Array.isArray(data.transactions)) {
                throw new Error('Invalid data: transactions must be an array');
            }
            if (typeof data.currency !== 'string') {
                throw new Error('Invalid data: currency must be a string');
            }

            // Dispatch import action
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

    return (
        <ExpenseContext.Provider value={{
            state,
            addUser,
            deleteUser,
            addExpense,
            updateExpense,
            deleteTransaction,
            addSettlement,
            updateSettlement,
            getBalances,
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
export function useExpenses() {
    const context = useContext(ExpenseContext);
    if (!context) {
        throw new Error("useExpenses must be used within an ExpenseProvider");
    }
    return context;
}
