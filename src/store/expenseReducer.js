import { mergeGroupSyncPayload } from '../services/multiUserSync.js';

// DEFAULT INITIAL USER (Clean slate for new users)
export const defaultUsers = [
    { id: 'u_you', name: 'You', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
];

// STABLE INITIAL STATE WITH DELETED IDS TOMBSTONES
export const initialState = {
    users: defaultUsers,
    groups: [],
    currentUserId: 'u_you',
    transactions: [],
    currency: 'INR',
    selectedGroupId: null, // null = All Groups, or 'grp_...' or 'non-group'
    deletedIds: {
        groups: {},
        members: {},
        expenses: {},
        settlements: {}
    }
};

// ACTIONS
export const ADD_USER = 'ADD_USER';
export const UPDATE_USER = 'UPDATE_USER';
export const MERGE_USERS = 'MERGE_USERS';
export const DELETE_USER = 'DELETE_USER';
export const ADD_GROUP = 'ADD_GROUP';
export const UPDATE_GROUP = 'UPDATE_GROUP';
export const DELETE_GROUP = 'DELETE_GROUP';
export const SET_SELECTED_GROUP = 'SET_SELECTED_GROUP';
export const SET_CURRENT_USER = 'SET_CURRENT_USER';
export const ADD_TRANSACTION = 'ADD_TRANSACTION';
export const UPDATE_TRANSACTION = 'UPDATE_TRANSACTION';
export const DELETE_TRANSACTION = 'DELETE_TRANSACTION';
export const SET_CURRENCY = 'SET_CURRENCY';
export const IMPORT_DATA = 'IMPORT_DATA';
export const MERGE_SYNCED_DATA = 'MERGE_SYNCED_DATA';
export const MERGE_GROUP_SYNC_DATA = 'MERGE_GROUP_SYNC_DATA';
export const SET_GROUP_MEMBER_IDENTITY = 'SET_GROUP_MEMBER_IDENTITY';
export const SET_GROUP_SYNC_CONFIG = 'SET_GROUP_SYNC_CONFIG';

// REDUCER
export function expenseReducer(state, action) {
    switch (action.type) {
        case SET_SELECTED_GROUP:
            return {
                ...state,
                selectedGroupId: action.payload || null
            };
        case ADD_USER: {
            const now = new Date().toISOString();
            const trimmedEmail = (typeof action.payload.email === 'string' && action.payload.email.trim())
                ? action.payload.email.trim()
                : null;
            const newUser = {
                ...action.payload,
                name: (action.payload.name || '').trim(),
                email: trimmedEmail,
                createdAt: action.payload.createdAt || now,
                updatedAt: action.payload.updatedAt || now
            };
            return {
                ...state,
                users: [...state.users, newUser],
            };
        }
        case UPDATE_USER: {
            const now = new Date().toISOString();
            const { id, name, email } = action.payload || {};
            if (!id) return state;
            const trimmedEmail = (typeof email === 'string' && email.trim()) ? email.trim() : null;
            return {
                ...state,
                users: (state.users || []).map(u => {
                    if (u.id !== id) return u;
                    return {
                        ...u,
                        name: (typeof name === 'string' && name.trim()) ? name.trim() : u.name,
                        email: email !== undefined ? trimmedEmail : (u.email || null),
                        updatedAt: now
                    };
                })
            };
        }
        case MERGE_USERS: {
            const now = new Date().toISOString();
            const { sourceUserId, targetUserId, options = {} } = action.payload || {};
            if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) {
                return state;
            }

            const targetUser = (state.users || []).find(u => u.id === targetUserId);
            const sourceUser = (state.users || []).find(u => u.id === sourceUserId);
            if (!targetUser) {
                return state;
            }

            // Determine target user's final name & email
            const resolvedName = (typeof options.name === 'string' && options.name.trim())
                ? options.name.trim()
                : targetUser.name;

            let resolvedEmail = targetUser.email || null;
            if (options.email !== undefined) {
                resolvedEmail = (typeof options.email === 'string' && options.email.trim())
                    ? options.email.trim()
                    : null;
            } else if (!resolvedEmail && sourceUser?.email) {
                resolvedEmail = sourceUser.email;
            }

            const updatedTargetUser = {
                ...targetUser,
                name: resolvedName,
                email: resolvedEmail,
                updatedAt: now
            };

            // 1. Remove source user and update target user
            const updatedUsers = (state.users || [])
                .filter(u => u.id !== sourceUserId)
                .map(u => u.id === targetUserId ? updatedTargetUser : u);

            // 2. Tombstone source user in deletedIds.members
            const updatedDeletedMembers = {
                ...(state.deletedIds?.members || {}),
                [sourceUserId]: now
            };

            // 3. Reassign currentUserId if it was source user
            const updatedCurrentUserId = state.currentUserId === sourceUserId
                ? targetUserId
                : state.currentUserId;

            // 4. Update groups: deduplicate members, update collector/myMemberId
            const updatedGroups = (state.groups || []).map(g => {
                let changed = false;
                let newMembers = g.members;
                if (Array.isArray(g.members) && g.members.includes(sourceUserId)) {
                    changed = true;
                    // Replace sourceUserId with targetUserId and deduplicate
                    newMembers = Array.from(new Set(g.members.map(m => m === sourceUserId ? targetUserId : m)));
                }
                let newCollectorId = g.defaultCollectorId;
                if (g.defaultCollectorId === sourceUserId) {
                    newCollectorId = targetUserId;
                    changed = true;
                }
                let newMyMemberId = g.myMemberId;
                if (g.myMemberId === sourceUserId) {
                    newMyMemberId = targetUserId;
                    changed = true;
                }
                if (changed) {
                    return {
                        ...g,
                        members: newMembers,
                        defaultCollectorId: newCollectorId,
                        myMemberId: newMyMemberId,
                        updatedAt: now
                    };
                }
                return g;
            });

            // 5. Update transactions: EXPENSE & SETTLEMENT
            const updatedDeletedSettlements = {
                ...(state.deletedIds?.settlements || {})
            };
            const updatedTransactions = [];

            (state.transactions || []).forEach(tx => {
                if (tx.type === 'SETTLEMENT') {
                    let changed = false;
                    let newFrom = tx.from;
                    let newTo = tx.to;
                    let newCollectorId = tx.collectorId;

                    if (tx.from === sourceUserId) {
                        newFrom = targetUserId;
                        changed = true;
                    }
                    if (tx.to === sourceUserId) {
                        newTo = targetUserId;
                        changed = true;
                    }
                    if (tx.collectorId === sourceUserId) {
                        newCollectorId = targetUserId;
                        changed = true;
                    }

                    // Redundant direct self-settlement cleanup
                    if (newFrom === targetUserId && newTo === targetUserId) {
                        updatedDeletedSettlements[tx.id] = now;
                        return;
                    }

                    if (changed) {
                        updatedTransactions.push({
                            ...tx,
                            from: newFrom,
                            to: newTo,
                            collectorId: newCollectorId,
                            updatedAt: now
                        });
                    } else {
                        updatedTransactions.push(tx);
                    }
                } else {
                    // EXPENSE
                    let changed = false;
                    let newCollectorId = tx.collectorId;
                    if (tx.collectorId === sourceUserId) {
                        newCollectorId = targetUserId;
                        changed = true;
                    }

                    let newPayerId = tx.payerId;
                    if (tx.payerId === sourceUserId) {
                        newPayerId = targetUserId;
                        changed = true;
                    }

                    // Payers (Array or Object)
                    let newPayers = tx.payers;
                    if (Array.isArray(tx.payers)) {
                        const hasSource = tx.payers.some(p => p && p.userId === sourceUserId);
                        if (hasSource) {
                            changed = true;
                            const payerMap = new Map();
                            tx.payers.forEach(p => {
                                if (!p) return;
                                const uid = p.userId === sourceUserId ? targetUserId : p.userId;
                                const existing = payerMap.get(uid);
                                if (existing) {
                                    payerMap.set(uid, {
                                        ...existing,
                                        ...p,
                                        userId: uid,
                                        amount: Math.round(((Number(existing.amount) || 0) + (Number(p.amount) || 0)) * 100) / 100
                                    });
                                } else {
                                    payerMap.set(uid, { ...p, userId: uid });
                                }
                            });
                            newPayers = Array.from(payerMap.values());
                        }
                    } else if (tx.payers && typeof tx.payers === 'object') {
                        if (sourceUserId in tx.payers) {
                            changed = true;
                            newPayers = { ...tx.payers };
                            const srcAmt = Number(newPayers[sourceUserId]) || 0;
                            const tgtAmt = Number(newPayers[targetUserId]) || 0;
                            newPayers[targetUserId] = Math.round((tgtAmt + srcAmt) * 100) / 100;
                            delete newPayers[sourceUserId];
                        }
                    }

                    // Splits (Array or Object)
                    let newSplits = tx.splits;
                    if (Array.isArray(tx.splits)) {
                        const hasSource = tx.splits.some(s => s && s.userId === sourceUserId);
                        if (hasSource) {
                            changed = true;
                            const splitMap = new Map();
                            tx.splits.forEach(s => {
                                if (!s) return;
                                const uid = s.userId === sourceUserId ? targetUserId : s.userId;
                                const existing = splitMap.get(uid);
                                if (existing) {
                                    const combinedShares = (existing.shares !== undefined || s.shares !== undefined)
                                        ? (Number(existing.shares) || 0) + (Number(s.shares) || 0)
                                        : undefined;
                                    splitMap.set(uid, {
                                        ...existing,
                                        ...s,
                                        userId: uid,
                                        amount: Math.round(((Number(existing.amount) || 0) + (Number(s.amount) || 0)) * 100) / 100,
                                        ...(combinedShares !== undefined ? { shares: combinedShares } : {})
                                    });
                                } else {
                                    splitMap.set(uid, { ...s, userId: uid });
                                }
                            });
                            newSplits = Array.from(splitMap.values());
                        }
                    } else if (tx.splits && typeof tx.splits === 'object') {
                        if (sourceUserId in tx.splits) {
                            changed = true;
                            newSplits = { ...tx.splits };
                            const srcAmt = Number(newSplits[sourceUserId]) || 0;
                            const tgtAmt = Number(newSplits[targetUserId]) || 0;
                            newSplits[targetUserId] = Math.round((tgtAmt + srcAmt) * 100) / 100;
                            delete newSplits[sourceUserId];
                        }
                    }

                    // SplitShares
                    let newSplitShares = tx.splitShares;
                    if (tx.splitShares && typeof tx.splitShares === 'object' && sourceUserId in tx.splitShares) {
                        changed = true;
                        newSplitShares = { ...tx.splitShares };
                        const srcShare = Number(newSplitShares[sourceUserId]) || 0;
                        const tgtShare = Number(newSplitShares[targetUserId]) || 0;
                        newSplitShares[targetUserId] = tgtShare + srcShare;
                        delete newSplitShares[sourceUserId];
                    }

                    if (changed) {
                        updatedTransactions.push({
                            ...tx,
                            collectorId: newCollectorId,
                            payerId: newPayerId,
                            payers: newPayers,
                            splits: newSplits,
                            splitShares: newSplitShares,
                            updatedAt: now
                        });
                    } else {
                        updatedTransactions.push(tx);
                    }
                }
            });

            return {
                ...state,
                users: updatedUsers,
                groups: updatedGroups,
                transactions: updatedTransactions,
                currentUserId: updatedCurrentUserId,
                deletedIds: {
                    ...state.deletedIds,
                    members: updatedDeletedMembers,
                    settlements: updatedDeletedSettlements
                }
            };
        }
        case DELETE_USER: {
            const now = new Date().toISOString();
            const userId = action.payload;
            return {
                ...state,
                users: state.users.filter(u => u.id !== userId),
                // Remove user from groups and update group timestamp
                groups: (state.groups || []).map(g => ({
                    ...g,
                    members: g.members.filter(mId => mId !== userId),
                    updatedAt: now
                })),
                deletedIds: {
                    ...state.deletedIds,
                    members: { ...(state.deletedIds?.members || {}), [userId]: now }
                },
                currentUserId: state.currentUserId === userId
                    ? (state.users.find(u => u.id !== userId)?.id || '')
                    : state.currentUserId
            };
        }
        case ADD_GROUP: {
            const now = new Date().toISOString();
            const newGroup = {
                ...action.payload,
                createdAt: action.payload.createdAt || now,
                updatedAt: action.payload.updatedAt || now
            };
            return {
                ...state,
                groups: [...(state.groups || []), newGroup]
            };
        }
        case UPDATE_GROUP: {
            const now = new Date().toISOString();
            return {
                ...state,
                groups: (state.groups || []).map(g =>
                    g.id === action.payload.id ? { ...g, ...action.payload, updatedAt: now } : g
                )
            };
        }
        case DELETE_GROUP: {
            const now = new Date().toISOString();
            const groupIdToDelete = action.payload;
            return {
                ...state,
                selectedGroupId: state.selectedGroupId === groupIdToDelete ? null : state.selectedGroupId,
                groups: (state.groups || []).filter(g => g.id !== groupIdToDelete),
                deletedIds: {
                    ...state.deletedIds,
                    groups: { ...(state.deletedIds?.groups || {}), [groupIdToDelete]: now }
                },
                // Reassign transactions of deleted group to non-group
                transactions: (state.transactions || []).map(t =>
                    t.groupId === groupIdToDelete ? { ...t, groupId: null, updatedAt: now } : t
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
                            ...t,
                            ...action.payload,
                            createdAt: t.createdAt || now,
                            updatedAt: now
                        }
                        : t
                )
            };
        }
        case DELETE_TRANSACTION: {
            const now = new Date().toISOString();
            const txId = action.payload;
            const existingTx = (state.transactions || []).find(t => t.id === txId);
            const isSettlement = existingTx?.type === 'SETTLEMENT';
            return {
                ...state,
                transactions: state.transactions.filter(t => t.id !== txId),
                deletedIds: {
                    ...state.deletedIds,
                    expenses: isSettlement
                        ? (state.deletedIds?.expenses || {})
                        : { ...(state.deletedIds?.expenses || {}), [txId]: now },
                    settlements: isSettlement
                        ? { ...(state.deletedIds?.settlements || {}), [txId]: now }
                        : (state.deletedIds?.settlements || {})
                }
            };
        }
        case SET_CURRENCY:
            return {
                ...state,
                currency: action.payload
            };
        case MERGE_SYNCED_DATA: {
            const payload = action.payload || {};
            const resolvedGroups = payload.groups || state.groups;
            const targetGroupId = payload.selectedGroupId !== undefined ? payload.selectedGroupId : state.selectedGroupId;
            const validSelectedGroupId = (
                targetGroupId === 'non-group' ||
                (Array.isArray(resolvedGroups) && resolvedGroups.some(g => g.id === targetGroupId))
            ) ? targetGroupId : null;

            const newState = {
                ...state,
                users: payload.users || state.users,
                groups: resolvedGroups,
                transactions: payload.transactions || state.transactions,
                deletedIds: payload.deletedIds || state.deletedIds,
                currency: payload.currency || state.currency,
                currentUserId: payload.currentUserId || state.currentUserId,
                selectedGroupId: validSelectedGroupId
            };
            delete newState.expenses;
            delete newState.settlements;
            return newState;
        }
        case MERGE_GROUP_SYNC_DATA: {
            return mergeGroupSyncPayload(state, action.payload, action.myMemberId);
        }
        case SET_GROUP_MEMBER_IDENTITY: {
            const { groupId, memberId } = action.payload;
            const now = new Date().toISOString();
            return {
                ...state,
                groups: (state.groups || []).map(g =>
                    g.id === groupId ? { ...g, myMemberId: memberId, updatedAt: now } : g
                )
            };
        }
        case SET_GROUP_SYNC_CONFIG: {
            const { groupId, isShared, syncSecret } = action.payload;
            const now = new Date().toISOString();
            return {
                ...state,
                groups: (state.groups || []).map(g =>
                    g.id === groupId ? { ...g, isShared: !!isShared, syncSecret: syncSecret || g.syncSecret || null, updatedAt: now } : g
                )
            };
        }
        case IMPORT_DATA: {
            const now = new Date().toISOString();
            const importedUsers = (Array.isArray(action.payload.users) && action.payload.users.length > 0
                ? action.payload.users
                : (state.users && state.users.length > 0 ? state.users : defaultUsers)
            ).map(u => ({
                ...u,
                updatedAt: u.updatedAt || u.createdAt || now
            }));
            const importedGroups = (Array.isArray(action.payload.groups) ? action.payload.groups : []).map(g => ({
                ...g,
                updatedAt: g.updatedAt || g.createdAt || now
            }));
            const importedTransactions = (Array.isArray(action.payload.transactions) ? action.payload.transactions : []).map(t => ({
                ...t,
                updatedAt: t.updatedAt || t.createdAt || now
            }));
            const importedDeletedIds = {
                groups: {},
                members: {},
                expenses: {},
                settlements: {},
                ...(action.payload.deletedIds || {})
            };

            const targetGroupId = action.payload.selectedGroupId !== undefined ? action.payload.selectedGroupId : state.selectedGroupId;
            const validSelectedGroupId = (
                targetGroupId === 'non-group' ||
                importedGroups.some(g => g.id === targetGroupId)
            ) ? targetGroupId : null;

            // Construct new clean state - purge legacy expenses/settlements to prevent ghost records
            const newState = {
                users: importedUsers,
                groups: importedGroups,
                transactions: importedTransactions,
                deletedIds: importedDeletedIds,
                currency: action.payload.currency || state.currency || 'INR',
                currentUserId: action.payload.currentUserId || (importedUsers[0]?.id || 'u_you'),
                selectedGroupId: validSelectedGroupId
            };

            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('expense_manager_data', JSON.stringify(newState));
                }
            } catch (e) {
                console.error('Failed saving imported data to localStorage:', e);
            }

            return newState;
        }
        default:
            return state;
    }
}
