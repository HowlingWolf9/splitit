import assert from 'node:assert';
import {
    initialState,
    expenseReducer,
    ADD_USER,
    UPDATE_USER,
    MERGE_USERS
} from '../src/store/expenseReducer.js';
import { computeStateHash } from '../src/services/googleDriveSync.js';

console.log('--- Running User Editing & Merging Verification Tests ---');

// Test 1: UPDATE_USER name and email assignment & timestamp updates
console.log('Test 1: UPDATE_USER name and email assignment');
{
    const initial = {
        ...initialState,
        users: [
            { id: 'u_1', name: 'Alex', email: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
            { id: 'u_2', name: 'Bob', email: 'bob@example.com', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
        ]
    };

    const hashBefore = computeStateHash(initial);

    // Update u_1 name and assign email
    const stateUpdated = expenseReducer(initial, {
        type: UPDATE_USER,
        payload: { id: 'u_1', name: 'Alex Johnson', email: ' alex.j@example.com ' }
    });

    const user1 = stateUpdated.users.find(u => u.id === 'u_1');
    assert.strictEqual(user1.name, 'Alex Johnson', 'User name updated');
    assert.strictEqual(user1.email, 'alex.j@example.com', 'User email trimmed and assigned');
    assert.notStrictEqual(user1.updatedAt, '2026-01-01T00:00:00.000Z', 'updatedAt timestamp refreshed');

    const hashAfter = computeStateHash(stateUpdated);
    assert.notStrictEqual(hashBefore, hashAfter, 'State hash changed after updating email and name');

    // Clear email
    const stateEmailCleared = expenseReducer(stateUpdated, {
        type: UPDATE_USER,
        payload: { id: 'u_1', email: '' }
    });
    const user1Cleared = stateEmailCleared.users.find(u => u.id === 'u_1');
    assert.strictEqual(user1Cleared.email, null, 'Empty email string normalized to null');
    assert.strictEqual(user1Cleared.name, 'Alex Johnson', 'Preserves name when not provided in updates');
}

// Test 2: ADD_USER optional email support
console.log('Test 2: ADD_USER optional email support');
{
    const stateWithEmail = expenseReducer(initialState, {
        type: ADD_USER,
        payload: { id: 'u_charlie', name: 'Charlie', email: ' charlie@test.com ' }
    });
    const charlie = stateWithEmail.users.find(u => u.id === 'u_charlie');
    assert.strictEqual(charlie.email, 'charlie@test.com', 'Email trimmed and stored on add');

    const stateNoEmail = expenseReducer(initialState, {
        type: ADD_USER,
        payload: { id: 'u_dan', name: 'Dan' }
    });
    const dan = stateNoEmail.users.find(u => u.id === 'u_dan');
    assert.strictEqual(dan.email, null, 'Missing email defaults to null');
}

// Test 3: MERGE_USERS single-payer and multi-payer expense remapping & consolidation
console.log('Test 3: MERGE_USERS single-payer & multi-payer expense consolidation');
{
    const baseState = {
        ...initialState,
        users: [
            { id: 'u_source', name: 'Alex (Old)', email: 'alex@old.com' },
            { id: 'u_target', name: 'Alex Johnson', email: 'alex@company.com' },
            { id: 'u_charlie', name: 'Charlie' }
        ],
        transactions: [
            // Expense 1: Only source paid
            {
                id: 'exp_1',
                type: 'EXPENSE',
                amount: 100,
                collectorId: 'u_source',
                payerId: 'u_source',
                payers: [{ userId: 'u_source', amount: 100 }],
                splits: [{ userId: 'u_source', amount: 50 }, { userId: 'u_charlie', amount: 50 }]
            },
            // Expense 2: Both source and target paid (multi-payer)
            {
                id: 'exp_2',
                type: 'EXPENSE',
                amount: 120,
                payers: [
                    { userId: 'u_source', amount: 40 },
                    { userId: 'u_target', amount: 60 },
                    { userId: 'u_charlie', amount: 20 }
                ],
                splits: [
                    { userId: 'u_source', amount: 40 },
                    { userId: 'u_target', amount: 40 },
                    { userId: 'u_charlie', amount: 40 }
                ]
            }
        ]
    };

    const merged = expenseReducer(baseState, {
        type: MERGE_USERS,
        payload: {
            sourceUserId: 'u_source',
            targetUserId: 'u_target',
            options: { name: 'Alex Consolidated', email: 'alex@company.com' }
        }
    });

    const exp1 = merged.transactions.find(t => t.id === 'exp_1');
    assert.strictEqual(exp1.collectorId, 'u_target', 'Collector remapped to target');
    assert.strictEqual(exp1.payerId, 'u_target', 'PayerId remapped to target');
    assert.strictEqual(exp1.payers.length, 1, 'Single payer retained');
    assert.strictEqual(exp1.payers[0].userId, 'u_target', 'Payer userId remapped');
    assert.strictEqual(exp1.payers[0].amount, 100, 'Payer amount preserved');

    const exp2 = merged.transactions.find(t => t.id === 'exp_2');
    assert.strictEqual(exp2.payers.length, 2, 'Payers consolidated from 3 to 2');
    const targetPayer = exp2.payers.find(p => p.userId === 'u_target');
    assert.strictEqual(targetPayer.amount, 100, 'Target and source payer amounts consolidated: 40 + 60 = 100');
    const charliePayer = exp2.payers.find(p => p.userId === 'u_charlie');
    assert.strictEqual(charliePayer.amount, 20, 'Third-party payer amount untouched');

    // Check splits consolidation
    assert.strictEqual(exp2.splits.length, 2, 'Splits consolidated from 3 to 2');
    const targetSplit = exp2.splits.find(s => s.userId === 'u_target');
    assert.strictEqual(targetSplit.amount, 80, 'Target and source split amounts consolidated: 40 + 40 = 80');
}

// Test 4: MERGE_USERS splitShares combining
console.log('Test 4: MERGE_USERS splitShares combining');
{
    const stateShares = {
        ...initialState,
        users: [
            { id: 'u_src', name: 'User A' },
            { id: 'u_tgt', name: 'User B' },
            { id: 'u_ext', name: 'User C' }
        ],
        transactions: [
            {
                id: 'exp_shares',
                type: 'EXPENSE',
                amount: 90,
                payers: [{ userId: 'u_ext', amount: 90 }],
                splits: [
                    { userId: 'u_src', amount: 30, shares: 1 },
                    { userId: 'u_tgt', amount: 30, shares: 1 },
                    { userId: 'u_ext', amount: 30, shares: 1 }
                ],
                splitShares: {
                    u_src: 1,
                    u_tgt: 2,
                    u_ext: 3
                }
            }
        ]
    };

    const merged = expenseReducer(stateShares, {
        type: MERGE_USERS,
        payload: { sourceUserId: 'u_src', targetUserId: 'u_tgt' }
    });

    const tx = merged.transactions.find(t => t.id === 'exp_shares');
    assert.strictEqual(tx.splitShares.u_src, undefined, 'Source key deleted from splitShares');
    assert.strictEqual(tx.splitShares.u_tgt, 3, 'Target splitShares combined: 2 + 1 = 3');
    assert.strictEqual(tx.splitShares.u_ext, 3, 'External splitShares intact');
}

// Test 5: MERGE_USERS settlement remapping & redundant self-settlement retirement
console.log('Test 5: MERGE_USERS settlement remapping & self-settlement retirement');
{
    const stateSettlements = {
        ...initialState,
        users: [
            { id: 'u_src', name: 'Source' },
            { id: 'u_tgt', name: 'Target' },
            { id: 'u_third', name: 'Third Party' }
        ],
        transactions: [
            // Direct settlement between source and target -> should be retired!
            { id: 'stl_internal_1', type: 'SETTLEMENT', from: 'u_src', to: 'u_tgt', amount: 50 },
            // Direct settlement from target to source -> should be retired!
            { id: 'stl_internal_2', type: 'SETTLEMENT', from: 'u_tgt', to: 'u_src', amount: 25 },
            // Settlement between source and third party -> should be remapped!
            { id: 'stl_external', type: 'SETTLEMENT', from: 'u_third', to: 'u_src', amount: 70 }
        ]
    };

    const merged = expenseReducer(stateSettlements, {
        type: MERGE_USERS,
        payload: { sourceUserId: 'u_src', targetUserId: 'u_tgt' }
    });

    // Check transactions list
    const remainingTxIds = merged.transactions.map(t => t.id);
    assert.ok(!remainingTxIds.includes('stl_internal_1'), 'Internal settlement 1 retired');
    assert.ok(!remainingTxIds.includes('stl_internal_2'), 'Internal settlement 2 retired');
    assert.ok(remainingTxIds.includes('stl_external'), 'External settlement preserved');

    // Check tombstones in deletedIds.settlements
    assert.ok(merged.deletedIds.settlements['stl_internal_1'], 'Tombstone recorded for internal settlement 1');
    assert.ok(merged.deletedIds.settlements['stl_internal_2'], 'Tombstone recorded for internal settlement 2');
    assert.strictEqual(merged.deletedIds.settlements['stl_external'], undefined, 'No tombstone for active settlement');

    // Check remapped external settlement
    const externalStl = merged.transactions.find(t => t.id === 'stl_external');
    assert.strictEqual(externalStl.from, 'u_third', 'From untouched');
    assert.strictEqual(externalStl.to, 'u_tgt', 'To remapped from u_src to u_tgt');
}

// Test 6: MERGE_USERS group memberships deduplication & roles
console.log('Test 6: MERGE_USERS group memberships deduplication & roles');
{
    const stateGroups = {
        ...initialState,
        users: [
            { id: 'u_src', name: 'Source' },
            { id: 'u_tgt', name: 'Target' },
            { id: 'u_other', name: 'Other' }
        ],
        groups: [
            // Group with both source and target
            {
                id: 'grp_both',
                name: 'Trip Group',
                members: ['u_src', 'u_tgt', 'u_other'],
                defaultCollectorId: 'u_src',
                myMemberId: 'u_src',
                updatedAt: '2026-01-01T00:00:00.000Z'
            },
            // Group with only source
            {
                id: 'grp_source_only',
                name: 'Roommates',
                members: ['u_src', 'u_other'],
                defaultCollectorId: null,
                myMemberId: null,
                updatedAt: '2026-01-01T00:00:00.000Z'
            }
        ]
    };

    const merged = expenseReducer(stateGroups, {
        type: MERGE_USERS,
        payload: { sourceUserId: 'u_src', targetUserId: 'u_tgt' }
    });

    const grpBoth = merged.groups.find(g => g.id === 'grp_both');
    assert.strictEqual(grpBoth.members.filter(m => m === 'u_tgt').length, 1, 'Target member deduplicated (appears once)');
    assert.ok(!grpBoth.members.includes('u_src'), 'Source member removed from group');
    assert.strictEqual(grpBoth.defaultCollectorId, 'u_tgt', 'defaultCollectorId remapped to target');
    assert.strictEqual(grpBoth.myMemberId, 'u_tgt', 'myMemberId remapped to target');
    assert.notStrictEqual(grpBoth.updatedAt, '2026-01-01T00:00:00.000Z', 'Group updatedAt updated');

    const grpSourceOnly = merged.groups.find(g => g.id === 'grp_source_only');
    assert.ok(grpSourceOnly.members.includes('u_tgt'), 'Target member added to group where source was member');
    assert.ok(!grpSourceOnly.members.includes('u_src'), 'Source member removed');
}

// Test 7: MERGE_USERS currentUserId & tombstone verification
console.log('Test 7: MERGE_USERS currentUserId & tombstone verification');
{
    const stateCurrent = {
        ...initialState,
        currentUserId: 'u_src',
        users: [
            { id: 'u_src', name: 'My Old Profile', email: 'old@me.com' },
            { id: 'u_tgt', name: 'My New Profile', email: 'new@me.com' }
        ]
    };

    const merged = expenseReducer(stateCurrent, {
        type: MERGE_USERS,
        payload: {
            sourceUserId: 'u_src',
            targetUserId: 'u_tgt',
            options: { name: 'My Unified Profile', email: 'unified@me.com' }
        }
    });

    assert.strictEqual(merged.currentUserId, 'u_tgt', 'currentUserId remapped to target when source was active');
    assert.strictEqual(merged.users.length, 1, 'Source user removed from users list');
    assert.strictEqual(merged.users[0].name, 'My Unified Profile', 'Chosen name applied');
    assert.strictEqual(merged.users[0].email, 'unified@me.com', 'Chosen email applied');
    assert.ok(merged.deletedIds.members['u_src'], 'Source user tombstone recorded in deletedIds.members');
}

// Test 8: Edge Cases (Identity, Missing User, Same User)
console.log('Test 8: Edge Cases and Guards');
{
    const stateEdge = {
        ...initialState,
        users: [
            { id: 'u_a', name: 'Alice' }
        ]
    };

    // Merging user into themselves
    const sameUserResult = expenseReducer(stateEdge, {
        type: MERGE_USERS,
        payload: { sourceUserId: 'u_a', targetUserId: 'u_a' }
    });
    assert.strictEqual(sameUserResult, stateEdge, 'Same user merge is a no-op');

    // Missing source or target
    const missingUserResult = expenseReducer(stateEdge, {
        type: MERGE_USERS,
        payload: { sourceUserId: 'u_a', targetUserId: 'u_nonexistent' }
    });
    assert.strictEqual(missingUserResult, stateEdge, 'Missing user merge is a no-op');
}

// Test 9: MERGE_USERS with singular .share combining and participants deduplication
console.log('Test 9: MERGE_USERS with singular .share combining and participants deduplication');
{
    const stateSingularShare = {
        ...initialState,
        users: [
            { id: 'u_src', name: 'User 1' },
            { id: 'u_tgt', name: 'User 2' },
            { id: 'u_oth', name: 'User 3' }
        ],
        transactions: [
            {
                id: 'exp_singular',
                type: 'EXPENSE',
                amount: 100,
                participants: ['u_src', 'u_tgt', 'u_oth'],
                splits: [
                    { userId: 'u_src', amount: 40, share: 2 },
                    { userId: 'u_tgt', amount: 60, share: 3 }
                ]
            }
        ]
    };

    const merged = expenseReducer(stateSingularShare, {
        type: MERGE_USERS,
        payload: { sourceUserId: 'u_src', targetUserId: 'u_tgt' }
    });

    const tx = merged.transactions.find(t => t.id === 'exp_singular');
    assert.strictEqual(tx.splits.length, 1, 'Splits consolidated from 2 to 1');
    assert.strictEqual(tx.splits[0].userId, 'u_tgt', 'Target userId assigned');
    assert.strictEqual(tx.splits[0].amount, 100, 'Split amounts summed: 40 + 60 = 100');
    assert.strictEqual(tx.splits[0].shares, 5, 'Singular shares combined: 2 + 3 = 5');
    assert.strictEqual(tx.splits[0].share, undefined, 'Singular share property removed after normalization');
    assert.deepStrictEqual(tx.participants, ['u_tgt', 'u_oth'], 'Participants array deduplicated and source replaced');
}

// Test 10: MERGE_USERS with legacy splitDetails and alternative shares object
console.log('Test 10: MERGE_USERS with legacy splitDetails and alternative shares object');
{
    const stateLegacy = {
        ...initialState,
        users: [
            { id: 'u_src', name: 'Source Legacy' },
            { id: 'u_tgt', name: 'Target Legacy' }
        ],
        transactions: [
            {
                id: 'exp_legacy',
                type: 'EXPENSE',
                amount: 60,
                splitDetails: [
                    { userId: 'u_src', amount: 30, shares: 1 },
                    { userId: 'u_tgt', amount: 30, shares: 1 }
                ],
                shares: {
                    u_src: 2,
                    u_tgt: 4
                }
            }
        ]
    };

    const merged = expenseReducer(stateLegacy, {
        type: MERGE_USERS,
        payload: { sourceUserId: 'u_src', targetUserId: 'u_tgt' }
    });

    const tx = merged.transactions.find(t => t.id === 'exp_legacy');
    assert.strictEqual(tx.splitDetails.length, 1, 'splitDetails consolidated');
    assert.strictEqual(tx.splitDetails[0].amount, 60, 'splitDetails amounts combined');
    assert.strictEqual(tx.splitDetails[0].shares, 2, 'splitDetails shares combined');
    assert.strictEqual(tx.shares.u_src, undefined, 'Source removed from alternative shares');
    assert.strictEqual(tx.shares.u_tgt, 6, 'Alternative shares combined: 2 + 4 = 6');
}

// Test 11: MERGE_USERS object cleanliness (no undefined keys injected)
console.log('Test 11: MERGE_USERS object cleanliness');
{
    const stateClean = {
        ...initialState,
        users: [
            { id: 'u_src', name: 'Source' },
            { id: 'u_tgt', name: 'Target' }
        ],
        transactions: [
            {
                id: 'exp_plain',
                type: 'EXPENSE',
                amount: 50,
                payerId: 'u_src'
                // Deliberately no collectorId, splitShares, or payers
            },
            {
                id: 'stl_plain',
                type: 'SETTLEMENT',
                amount: 20,
                from: 'u_src',
                to: 'u_ext'
                // Deliberately no collectorId
            }
        ]
    };

    const merged = expenseReducer(stateClean, {
        type: MERGE_USERS,
        payload: { sourceUserId: 'u_src', targetUserId: 'u_tgt' }
    });

    const exp = merged.transactions.find(t => t.id === 'exp_plain');
    assert.strictEqual('collectorId' in exp, false, 'collectorId not injected onto expense when absent');
    assert.strictEqual('splitShares' in exp, false, 'splitShares not injected onto expense when absent');

    const stl = merged.transactions.find(t => t.id === 'stl_plain');
    assert.strictEqual('collectorId' in stl, false, 'collectorId not injected onto settlement when absent');
}

// Test 12: MERGE_USERS retaining source email when target email is null
console.log('Test 12: MERGE_USERS retaining source email when target email is null');
{
    const stateEmailRetain = {
        ...initialState,
        users: [
            { id: 'u_src', name: 'Source with Email', email: 'source@example.com' },
            { id: 'u_tgt', name: 'Target without Email', email: null }
        ]
    };

    // When options does not specify email (undefined)
    const mergedDefault = expenseReducer(stateEmailRetain, {
        type: MERGE_USERS,
        payload: { sourceUserId: 'u_src', targetUserId: 'u_tgt' }
    });
    const tgtUserDefault = mergedDefault.users.find(u => u.id === 'u_tgt');
    assert.strictEqual(tgtUserDefault.email, 'source@example.com', 'Preserved source email when target has no email');

    // When options explicitly keeps email
    const mergedExplicit = expenseReducer(stateEmailRetain, {
        type: MERGE_USERS,
        payload: {
            sourceUserId: 'u_src',
            targetUserId: 'u_tgt',
            options: { email: 'source@example.com' }
        }
    });
    const tgtUserExplicit = mergedExplicit.users.find(u => u.id === 'u_tgt');
    assert.strictEqual(tgtUserExplicit.email, 'source@example.com', 'Preserved source email when explicitly requested');
}

console.log('--- ALL USER EDITING & MERGING TESTS PASSED SUCCESSFULLY! ---');
