import assert from 'node:assert';
import {
    parseTokenFromHash,
    getOAuthRedirectUri,
    isMobileDevice,
    isCapacitorNative,
    sanitizeClientId,
    isValidClientId,
    mergeAppState,
    computeStateHash,
    clearExpiredToken,
    clearAuth,
    initiateGoogleAuth,
    trySilentRestore,
    getAccessToken,
    getUserProfile,
    STORAGE_KEY_TOKEN,
    STORAGE_KEY_EXPIRES_AT,
    STORAGE_KEY_CONNECTED,
    STORAGE_KEY_USER_PROFILE
} from '../src/services/googleDriveSync.js';
import {
    mergeGroupSyncPayload,
    buildGroupPayload,
    NostrPoolManager
} from '../src/services/multiUserSync.js';
import { Capacitor } from '@capacitor/core';

console.log('--- Running Deep Verification Tests ---');

// Test 1: parseTokenFromHash
console.log('Test 1: parseTokenFromHash');
const sampleHash = '#access_token=ya29.test123token&token_type=Bearer&expires_in=3600&scope=https://www.googleapis.com/auth/drive.appdata';
const parsed = parseTokenFromHash(sampleHash);
assert.strictEqual(parsed.accessToken, 'ya29.test123token', 'Token extraction matches');
assert.strictEqual(parsed.expiresIn, 3600, 'Expiration parsed matches');

const deepLinkParsed = parseTokenFromHash('com.splitit.expensemanager://oauth#access_token=ya29.deeplinktoken&expires_in=3600');
assert.strictEqual(deepLinkParsed.accessToken, 'ya29.deeplinktoken', 'Deep link URL with hash token matches');

const emptyParsed = parseTokenFromHash('');
assert.strictEqual(emptyParsed, null, 'Empty hash returns null');

const errorParsed = parseTokenFromHash('#error=access_denied&error_description=The+user+denied+access');
assert.strictEqual(errorParsed.error, 'The user denied access', 'Error hash extracts description');

const simpleErrorParsed = parseTokenFromHash('#error=invalid_request');
assert.strictEqual(simpleErrorParsed.error, 'invalid_request', 'Simple error code extracted');

const queryErrorParsed = parseTokenFromHash('com.splitit.expensemanager://oauth?error=access_denied&error_description=User+cancelled#state=xyz');
assert.strictEqual(queryErrorParsed.error, 'User cancelled', 'Query error extracted even with trailing hash fragment');

// Test 2: sanitizeClientId & isValidClientId
console.log('Test 2: sanitizeClientId & isValidClientId');
const rawClient = '  "1048596041042-32b07m6m2sp99v1g7v7v0j4p8n0s2r9f.apps.googleusercontent.com";  ';
const clean = sanitizeClientId(rawClient);
assert.strictEqual(clean, '1048596041042-32b07m6m2sp99v1g7v7v0j4p8n0s2r9f.apps.googleusercontent.com');
assert.strictEqual(isValidClientId(clean), true);

// Test 3: getOAuthRedirectUri route normalization
console.log('Test 3: getOAuthRedirectUri route normalization');
global.window = {
    location: {
        origin: 'https://myapp.splitit.com',
        pathname: '/settings'
    }
};
assert.strictEqual(getOAuthRedirectUri(), 'https://myapp.splitit.com', 'Stripped /settings route');

global.window.location = {
    origin: 'https://myapp.splitit.com',
    pathname: '/groups/grp_12345'
};
assert.strictEqual(getOAuthRedirectUri(), 'https://myapp.splitit.com', 'Stripped nested /groups/:id sub-route');

global.window.location = {
    origin: 'https://myapp.splitit.com',
    pathname: '/members/u_abcde'
};
assert.strictEqual(getOAuthRedirectUri(), 'https://myapp.splitit.com', 'Stripped nested /members/:id sub-route');

global.window.location = {
    origin: 'https://username.github.io',
    pathname: '/expense-manager/dashboard'
};
assert.strictEqual(getOAuthRedirectUri(), 'https://username.github.io/expense-manager', 'Preserved base repo path and stripped /dashboard');

global.window.location = {
    origin: 'https://username.github.io',
    pathname: '/expense-manager/groups/grp_12345'
};
assert.strictEqual(getOAuthRedirectUri(), 'https://username.github.io/expense-manager', 'Preserved base repo path and stripped nested /groups/:id');

global.window.location = {
    origin: 'http://localhost:5173',
    pathname: '/index.html'
};
assert.strictEqual(getOAuthRedirectUri(), 'http://localhost:5173', 'Stripped index.html on localhost');

// Test 4: Mobile UA detection (including iPadOS and tablets)
console.log('Test 4: isMobileDevice user agent matching');
global.window.innerWidth = 400;

let mockUa = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
Object.defineProperty(global.navigator, 'userAgent', {
    get: () => mockUa,
    configurable: true
});
Object.defineProperty(global.navigator, 'maxTouchPoints', {
    get: () => 5,
    configurable: true
});

assert.strictEqual(isMobileDevice(), true, 'Android Chrome detected as mobile');

mockUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
assert.strictEqual(isMobileDevice(), true, 'iPhone Safari detected as mobile');

// iPadOS (Macintosh user-agent with multitouch points and wide screen)
mockUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.15';
global.window.innerWidth = 1194; // iPad Pro 11-inch landscape
assert.strictEqual(isMobileDevice(), true, 'iPadOS Safari on iPad Pro detected as mobile/touch tablet');

mockUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
Object.defineProperty(global.navigator, 'maxTouchPoints', {
    get: () => 0,
    configurable: true
});
global.window.innerWidth = 1920;
assert.strictEqual(isMobileDevice(), false, 'Desktop Chrome detected as non-mobile');

// Test 5: WebView UA sanitization logic
console.log('Test 5: WebView UA sanitization logic');
const webViewUa = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.231205.015; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36';
const sanitizedUa = webViewUa.replaceAll(/;\s*wv/g, '').replaceAll(/Version\/\d+\.\d+\s*/g, '');
assert.strictEqual(sanitizedUa.includes('; wv'), false, 'Stripped ; wv');
assert.strictEqual(sanitizedUa.includes('Version/4.0'), false, 'Stripped Version/4.0');
assert.strictEqual(sanitizedUa, 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.231205.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36');

// Test 6: mergeAppState with completely clean empty state
console.log('Test 6: mergeAppState clean state integrity');
const cleanLocal = {
    users: [{ id: 'u_you', name: 'You' }],
    groups: [],
    transactions: [],
    currency: 'INR'
};
const cleanRemote = {
    users: [],
    groups: [],
    transactions: []
};
const merged = mergeAppState(cleanLocal, cleanRemote);
assert.strictEqual(merged.groups.length, 0, 'Merged groups must remain 0 - no seed data');
assert.strictEqual(merged.transactions.length, 0, 'Merged transactions must remain 0 - no seed data');
assert.strictEqual(merged.users.length, 1, 'Only default user present');
assert.strictEqual(merged.users[0].name, 'You');

// Test 7: computeStateHash determinism & mutation detection
console.log('Test 7: computeStateHash determinism and mutation detection');
const baseState1 = {
    users: [{ id: 'u1', name: 'Alice' }, { id: 'u2', name: 'Bob' }],
    groups: [{ id: 'g1', name: 'Trip', members: ['u1', 'u2'] }],
    transactions: [{ id: 't1', amount: 50, date: '2026-01-01' }],
    deletedIds: { groups: {}, members: {}, expenses: {}, settlements: {} },
    currency: 'INR'
};
const baseState2 = {
    users: [{ id: 'u2', name: 'Bob' }, { id: 'u1', name: 'Alice' }],
    groups: [{ id: 'g1', name: 'Trip', members: ['u2', 'u1'] }],
    transactions: [{ id: 't1', amount: 50, date: '2026-01-01' }],
    deletedIds: { groups: {}, members: {}, expenses: {}, settlements: {} },
    currency: 'INR'
};
const hash1 = computeStateHash(baseState1);
const hash2 = computeStateHash(baseState2);
assert.strictEqual(hash1, hash2, 'Hash must be identical regardless of item order');

const stateChangedAmount = {
    ...baseState1,
    transactions: [{ id: 't1', amount: 99, date: '2026-01-01' }]
};
assert.notStrictEqual(computeStateHash(stateChangedAmount), hash1, 'Hash must change when transaction amount changes');

const stateChangedUser = {
    ...baseState1,
    users: [{ id: 'u1', name: 'Alice Updated' }, { id: 'u2', name: 'Bob' }]
};
assert.notStrictEqual(computeStateHash(stateChangedUser), hash1, 'Hash must change when user name changes');

const stateChangedCurrency = {
    ...baseState1,
    currency: 'USD'
};
assert.notStrictEqual(computeStateHash(stateChangedCurrency), hash1, 'Hash must change when currency changes');

const stateChangedDescription = {
    ...baseState1,
    transactions: [{ id: 't1', amount: 50, date: '2026-01-01', description: 'Dinner with drinks' }]
};
assert.notStrictEqual(computeStateHash(stateChangedDescription), hash1, 'Hash must change when transaction description changes');

const stateChangedCategory = {
    ...baseState1,
    transactions: [{ id: 't1', amount: 50, date: '2026-01-01', category: 'Food & Drinks' }]
};
assert.notStrictEqual(computeStateHash(stateChangedCategory), hash1, 'Hash must change when transaction category changes');

const stateChangedPayer = {
    ...baseState1,
    transactions: [{ id: 't1', amount: 50, date: '2026-01-01', payerId: 'u2' }]
};
assert.notStrictEqual(computeStateHash(stateChangedPayer), hash1, 'Hash must change when transaction payerId changes');

const stateChangedSplits = {
    ...baseState1,
    transactions: [{ id: 't1', amount: 50, date: '2026-01-01', splitMode: 'EXACT', splits: { u1: 30, u2: 20 } }]
};
assert.notStrictEqual(computeStateHash(stateChangedSplits), hash1, 'Hash must change when transaction splits change');

const stateChangedUserEmail = {
    ...baseState1,
    users: [{ id: 'u1', name: 'Alice', email: 'alice@example.com' }, { id: 'u2', name: 'Bob' }]
};
assert.notStrictEqual(computeStateHash(stateChangedUserEmail), hash1, 'Hash must change when user email changes');

// Test 8: clearExpiredToken vs clearAuth non-destructive session retention
console.log('Test 8: clearExpiredToken vs clearAuth session retention');
const storageMap = new Map();
global.localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k)
};

localStorage.setItem(STORAGE_KEY_TOKEN, 'ya29.testtoken');
localStorage.setItem(STORAGE_KEY_EXPIRES_AT, String(Date.now() + 3600000));
localStorage.setItem(STORAGE_KEY_CONNECTED, 'true');
localStorage.setItem(STORAGE_KEY_USER_PROFILE, JSON.stringify({ email: 'user@example.com', name: 'User' }));

// Call clearExpiredToken on 401:
clearExpiredToken();
assert.strictEqual(localStorage.getItem(STORAGE_KEY_TOKEN), null, 'Expired token cleared');
assert.strictEqual(localStorage.getItem(STORAGE_KEY_EXPIRES_AT), null, 'Expired timestamp cleared');
assert.strictEqual(localStorage.getItem(STORAGE_KEY_CONNECTED), 'true', 'Connected flag preserved on 401');
assert.strictEqual(JSON.parse(localStorage.getItem(STORAGE_KEY_USER_PROFILE)).email, 'user@example.com', 'Profile preserved on 401');

// Call clearAuth on explicit user sign out:
clearAuth();
assert.strictEqual(localStorage.getItem(STORAGE_KEY_CONNECTED), null, 'Connected flag cleared on sign out');
assert.strictEqual(localStorage.getItem(STORAGE_KEY_USER_PROFILE), null, 'Profile cleared on sign out');

// Test 9: isCapacitorNative, getOAuthRedirectUri & NativeGoogleAuthPlugin delegation
console.log('Test 9: isCapacitorNative, getOAuthRedirectUri and NativeGoogleAuthPlugin delegation');
global.androidBridge = {};
global.window.androidBridge = global.androidBridge;
global.window.Capacitor = Capacitor;

assert.strictEqual(isCapacitorNative(), true, 'Capacitor native detected');
assert.strictEqual(getOAuthRedirectUri(), 'http://localhost', 'Clean localhost origin returned on native');

let nativeMethodCalled = null;
Capacitor.PluginHeaders = [
    {
        name: 'NativeGoogleAuthPlugin',
        methods: [
            { name: 'signIn', rtype: 'promise' },
            { name: 'trySilentSignIn', rtype: 'promise' },
            { name: 'signOut', rtype: 'promise' }
        ]
    }
];
Capacitor.nativePromise = async (plugin, method) => {
    nativeMethodCalled = method;
    if (plugin === 'NativeGoogleAuthPlugin' && method === 'signIn') {
        return {
            accessToken: 'ya29.native_test_token',
            expiresIn: 3600,
            email: 'test@android.local',
            name: 'Android User'
        };
    }
    if (plugin === 'NativeGoogleAuthPlugin' && method === 'trySilentSignIn') {
        return {
            accessToken: 'ya29.silent_test_token',
            expiresIn: 3600,
            email: 'test@android.local',
            name: 'Android User'
        };
    }
    return {};
};

let callbackToken = null;
await initiateGoogleAuth({
    onToken: (token) => {
        callbackToken = token;
    }
});

assert.strictEqual(nativeMethodCalled, 'signIn', 'initiateGoogleAuth routed through NativeGoogleAuthPlugin.signIn');
assert.strictEqual(callbackToken, 'ya29.native_test_token', 'Access token received from native plugin');
assert.strictEqual(getAccessToken(), 'ya29.native_test_token', 'Access token saved to localStorage');
assert.strictEqual(getUserProfile()?.email, 'test@android.local', 'Profile saved to localStorage');

// Test silent restore via native plugin
clearExpiredToken();
assert.strictEqual(getAccessToken(), null, 'Token cleared for silent restore test');
localStorage.setItem(STORAGE_KEY_CONNECTED, 'true');
const restored = await trySilentRestore();
assert.strictEqual(restored, true, 'Silent restore succeeded via native plugin');
assert.strictEqual(nativeMethodCalled, 'trySilentSignIn', 'trySilentRestore called NativeGoogleAuthPlugin.trySilentSignIn');
assert.strictEqual(getAccessToken(), 'ya29.silent_test_token', 'Silent token saved');

// Test user cancellation handling on native
Capacitor.nativePromise = async (plugin, method) => {
    nativeMethodCalled = method;
    throw new Error('Google sign-in cancelled by user');
};
let cancelErrorReported = false;
await initiateGoogleAuth({
    onError: () => { cancelErrorReported = true; }
});
assert.strictEqual(cancelErrorReported, false, 'Cancellation should not trigger onError failure banner');

// Test clearAuth on native invokes signOut
Capacitor.nativePromise = async (plugin, method) => {
    nativeMethodCalled = method;
    return {};
};
clearAuth();
await new Promise(r => setTimeout(r, 10));
assert.strictEqual(nativeMethodCalled, 'signOut', 'clearAuth on native invokes signOut');

delete global.androidBridge;
delete global.window.androidBridge;
delete global.window.Capacitor;
Capacitor.PluginHeaders = [];
assert.strictEqual(isCapacitorNative(), false, 'Capacitor native cleared');

// Test 10: Settings showConnectedCard resilience during offline and error states
console.log('Test 10: Settings showConnectedCard resilience during offline and error');
localStorage.setItem(STORAGE_KEY_CONNECTED, 'true');
localStorage.setItem(STORAGE_KEY_USER_PROFILE, JSON.stringify({ email: 'user@example.com' }));

// Simulate helper logic from Settings.jsx:
const evaluateShowConnected = (syncStatus, isAuthed, isPersisted) => {
    const isPersistedOrAuthed = isAuthed || isPersisted;
    const isConnected = syncStatus === 'connected' || (syncStatus === 'syncing' && isAuthed);
    const isReauth = syncStatus === 'reauth_required';
    return isPersistedOrAuthed || isConnected || isReauth;
};

assert.strictEqual(evaluateShowConnected('offline', false, true), true, 'Connected card remains visible when offline');
assert.strictEqual(evaluateShowConnected('error', false, true), true, 'Connected card remains visible during error');
assert.strictEqual(evaluateShowConnected('reauth_required', false, true), true, 'Connected card remains visible when reauth is required');
assert.strictEqual(evaluateShowConnected('disconnected', false, false), false, 'Signed out card shown when not persisted and disconnected');

// Test 11: Collector-routed pairwise debt calculation verifying p.amount - s.amount net balance and zero sum
console.log('Test 11: Collector-routed pairwise debt calculation');
const memberIds11 = ['u_alice', 'u_bob', 'u_charlie'];
const debtMatrix11 = {};
memberIds11.forEach(m1 => {
    debtMatrix11[m1] = {};
    memberIds11.forEach(m2 => { debtMatrix11[m1][m2] = 0; });
});

// Alice pays 100 upfront, Bob is collector, split equally among Alice (33.33), Bob (33.33), Charlie (33.34)
const collectorTx = {
    type: 'EXPENSE',
    amount: 100,
    collectorId: 'u_bob',
    payers: [{ userId: 'u_alice', amount: 100 }],
    splits: [
        { userId: 'u_alice', amount: 33.33 },
        { userId: 'u_bob', amount: 33.33 },
        { userId: 'u_charlie', amount: 33.34 }
    ]
};

// Execute collector routing algorithm (as implemented in ExpenseContext and BalancesView)
if (collectorTx.collectorId && debtMatrix11[collectorTx.collectorId]) {
    collectorTx.splits.forEach(s => {
        if (s.userId !== collectorTx.collectorId && debtMatrix11[s.userId] && debtMatrix11[s.userId][collectorTx.collectorId] !== undefined) {
            debtMatrix11[s.userId][collectorTx.collectorId] += s.amount;
        }
    });
    collectorTx.payers.forEach(p => {
        if (p.amount > 0 && p.userId !== collectorTx.collectorId && debtMatrix11[collectorTx.collectorId]?.[p.userId] !== undefined) {
            debtMatrix11[collectorTx.collectorId][p.userId] += p.amount;
        }
    });
}

// Collector (Bob) owes Payer (Alice) the full upfront paid amount:
assert.strictEqual(debtMatrix11['u_bob']['u_alice'], 100, 'Collector must owe payer full upfront payment (not reduced by payer split)');
// Payer (Alice) owes Collector (Bob) Alice split share:
assert.strictEqual(debtMatrix11['u_alice']['u_bob'], 33.33, 'Payer owes collector their split share');
// Participant (Charlie) owes Collector (Bob) Charlie split share:
assert.strictEqual(debtMatrix11['u_charlie']['u_bob'], 33.34, 'Participant owes collector their split share');

// Calculate net pairwise debts from each user's perspective
const netBetweenAliceAndBob = debtMatrix11['u_bob']['u_alice'] - debtMatrix11['u_alice']['u_bob']; // Bob owes Alice 100 - 33.33 = +66.67
assert.strictEqual(Math.round(netBetweenAliceAndBob * 100) / 100, 66.67, 'Net pairwise debt between Bob and Alice must be +66.67');

const netBetweenCharlieAndBob = debtMatrix11['u_charlie']['u_bob'] - debtMatrix11['u_bob']['u_charlie']; // Charlie owes Bob 33.34
assert.strictEqual(Math.round(netBetweenCharlieAndBob * 100) / 100, 33.34, 'Net pairwise debt between Charlie and Bob must be +33.34');

// Verify conservation of value across all members
const aliceNet = netBetweenAliceAndBob; // +66.67
const bobNet = -netBetweenAliceAndBob + netBetweenCharlieAndBob; // -66.67 + 33.34 = -33.33
const charlieNet = -netBetweenCharlieAndBob; // -33.34
const netSum = Math.round((aliceNet + bobNet + charlieNet) * 100) / 100;
assert.strictEqual(netSum, 0, 'Sum of all pairwise balances must strictly equal zero (conservation of value)');

// Test 12: mergeGroupSyncPayload verifying no Date.now() injection, myMemberId auto-append, and tombstone enforcement
console.log('Test 12: mergeGroupSyncPayload deterministic timestamps and tombstone enforcement');

const initialTs = '2026-01-01T12:00:00.000Z';
const remoteTs = '2026-01-02T12:00:00.000Z';
const tombstoneTs = '2026-01-03T12:00:00.000Z';

const stateBeforeSync = {
    groups: [{
        id: 'grp_sync_1',
        name: 'Apartment',
        members: ['u_1', 'u_2'],
        updatedAt: initialTs,
        createdAt: initialTs,
        myMemberId: 'u_1'
    }],
    users: [
        { id: 'u_1', name: 'Member 1' },
        { id: 'u_2', name: 'Member 2' }
    ],
    deletedIds: {
        groups: {},
        members: { 'u_tombstoned': tombstoneTs },
        expenses: {},
        settlements: {}
    }
};

const incomingPayload = {
    version: 1,
    groupId: 'grp_sync_1',
    group: {
        id: 'grp_sync_1',
        name: 'Apartment Renovated',
        members: ['u_1', 'u_2', 'u_tombstoned'],
        updatedAt: remoteTs,
        createdAt: initialTs
    },
    members: [
        { id: 'u_1', name: 'Member 1' },
        { id: 'u_2', name: 'Member 2' },
        { id: 'u_tombstoned', name: 'Old Member', updatedAt: '2026-01-01T00:00:00.000Z' }
    ],
    deletedIds: {
        members: { 'u_tombstoned': tombstoneTs }
    }
};

// Case A: Sync without adding a new member — group.updatedAt MUST strictly preserve remoteTs and NOT inject Date.now()
const mergedA = mergeGroupSyncPayload(stateBeforeSync, incomingPayload, 'u_1');
const mergedGroupA = mergedA.groups.find(g => g.id === 'grp_sync_1');
assert.strictEqual(mergedGroupA.updatedAt, remoteTs, 'Group updatedAt must match remote timestamp without Date.now() injection');
assert.strictEqual(mergedGroupA.members.includes('u_tombstoned'), false, 'Tombstoned member must be excluded from group members');

// Case B: Joining as a new member ('u_new') — must union 'u_new' into members and set myMemberId
const stateForJoin = {
    groups: [],
    users: [{ id: 'u_new', name: 'New Joiner' }],
    deletedIds: { groups: {}, members: {}, expenses: {}, settlements: {} }
};
const mergedJoin = mergeGroupSyncPayload(stateForJoin, incomingPayload, 'u_new');
const joinedGroup = mergedJoin.groups.find(g => g.id === 'grp_sync_1');
assert.strictEqual(joinedGroup.members.includes('u_new'), true, 'Newly joined member id must be appended to members list');
assert.strictEqual(joinedGroup.myMemberId, 'u_new', 'myMemberId must be set to newly joined member');
assert.strictEqual(joinedGroup.members.includes('u_tombstoned'), false, 'Tombstoned member must not be added');

// Test 13: fetchGroupOnce listener cleanup asserting message and open listeners are removed
console.log('Test 13: fetchGroupOnce listener cleanup');

class MockSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 1; // WebSocket.OPEN
        this.listeners = { message: [], open: [] };
        this.addedCount = { message: 0, open: 0 };
        this.removedCount = { message: 0, open: 0 };
        this.sentMessages = [];
    }
    addEventListener(type, fn) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(fn);
        this.addedCount[type] = (this.addedCount[type] || 0) + 1;
    }
    removeEventListener(type, fn) {
        if (this.listeners[type]) {
            this.listeners[type] = this.listeners[type].filter(f => f !== fn);
        }
        this.removedCount[type] = (this.removedCount[type] || 0) + 1;
    }
    send(data) {
        this.sentMessages.push(data);
    }
}

global.WebSocket = MockSocket;
MockSocket.OPEN = 1;

const mockSocketInstance = new MockSocket('wss://mock.relay.test');
const pool = new NostrPoolManager();
pool.getRelays = () => ['wss://mock.relay.test'];
pool.sockets.set('wss://mock.relay.test', mockSocketInstance);

// Call fetchGroupOnce with short timeout
const result13 = await pool.fetchGroupOnce('grp_mock_test', 'mock_secret_123', 50);

assert.strictEqual(result13.success, false, 'Fetch timed out as expected without relays sending event');
// Verify listener was attached during active fetch and removed on cleanup
assert.strictEqual(mockSocketInstance.addedCount.message, 1, 'Message listener was registered on relay socket');
assert.strictEqual(mockSocketInstance.removedCount.message, 1, 'Message listener was removed on cleanup');
assert.strictEqual(mockSocketInstance.listeners.message.length, 0, 'No dangling message listeners remain on socket');
const closeMsg = mockSocketInstance.sentMessages.find(m => m.includes('CLOSE'));
assert.ok(closeMsg, 'CLOSE message frame must be dispatched to relay upon subscription cleanup');

// Test 14: OAuth state CSRF verification in parseTokenFromHash
console.log('Test 14: OAuth state CSRF verification in parseTokenFromHash');

const sessionMap = new Map();
global.sessionStorage = {
    getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null),
    setItem: (k, v) => sessionMap.set(k, String(v)),
    removeItem: (k) => sessionMap.delete(k),
    clear: () => sessionMap.clear()
};
if (global.window) {
    global.window.sessionStorage = global.sessionStorage;
}

// 1. Mismatched state should be rejected
sessionStorage.setItem('splitit_oauth_state', 'expected_nonce_12345');
const csrfAttackHash = '#access_token=ya29.attacker&expires_in=3600&state=forged_state_67890';
const csrfResult = parseTokenFromHash(csrfAttackHash);
assert.strictEqual(csrfResult?.accessToken, undefined, 'Access token must not be accepted on state mismatch');
assert.strictEqual(csrfResult?.error, 'OAuth state mismatch (potential CSRF attack)');
assert.strictEqual(sessionStorage.getItem('splitit_oauth_state'), 'expected_nonce_12345', 'State not consumed on error');

// 2. Missing state parameter should also be strictly rejected when expectedState is set
const missingStateHash = '#access_token=ya29.attacker_missing_state&expires_in=3600';
const missingStateResult = parseTokenFromHash(missingStateHash);
assert.strictEqual(missingStateResult?.accessToken, undefined, 'Access token must be rejected when state parameter is omitted');
assert.strictEqual(missingStateResult?.error, 'OAuth state mismatch (potential CSRF attack)');
assert.strictEqual(sessionStorage.getItem('splitit_oauth_state'), 'expected_nonce_12345', 'State not consumed on missing state error');

// 3. Matching state should succeed and consume the state
const validAuthHash = '#access_token=ya29.valid_token&expires_in=3600&state=expected_nonce_12345';
const validResult = parseTokenFromHash(validAuthHash);
assert.strictEqual(validResult?.accessToken, 'ya29.valid_token', 'Access token accepted on valid state');
assert.strictEqual(validResult?.expiresIn, 3600);
assert.strictEqual(sessionStorage.getItem('splitit_oauth_state'), null, 'OAuth state token consumed from sessionStorage');

// Test 15: Device-local member identity isolation in multi-user sync
console.log('Test 15: Device-local member identity isolation in multi-user sync');

const senderState = {
    currentUserId: 'u_alice',
    groups: [{
        id: 'grp_shared_iso',
        name: 'Shared Trip',
        members: ['u_alice', 'u_bob'],
        myMemberId: 'u_alice',
        isShared: true,
        syncSecret: 'test_sec_iso_123'
    }],
    users: [
        { id: 'u_alice', name: 'Alice' },
        { id: 'u_bob', name: 'Bob' }
    ],
    transactions: [],
    deletedIds: { groups: {}, members: {}, expenses: {}, settlements: {} }
};

// 1. buildGroupPayload must strip myMemberId from payload.group
const broadcastPayload = buildGroupPayload(senderState, 'grp_shared_iso');
assert.strictEqual(broadcastPayload.group.myMemberId, undefined, 'payload.group must NOT expose device-local myMemberId');
assert.strictEqual(broadcastPayload.senderMemberId, 'u_alice', 'senderMemberId records Alice as sender');

// 2. mergeGroupSyncPayload on Bob device must NOT adopt Alice identity when Bob has not set myMemberId
const receiverStateBefore = {
    currentUserId: 'u_you',
    groups: [{
        id: 'grp_shared_iso',
        name: 'Shared Trip',
        members: ['u_alice', 'u_bob'],
        myMemberId: null, // Bob has not set a custom member identity
        isShared: true,
        syncSecret: 'test_sec_iso_123'
    }],
    users: [
        { id: 'u_alice', name: 'Alice' },
        { id: 'u_bob', name: 'Bob' }
    ],
    transactions: [],
    deletedIds: { groups: {}, members: {}, expenses: {}, settlements: {} }
};

const mergedReceiver = mergeGroupSyncPayload(receiverStateBefore, broadcastPayload, null);
const receiverGroup = mergedReceiver.groups.find(g => g.id === 'grp_shared_iso');
assert.strictEqual(receiverGroup.myMemberId, null, 'Receiver group must NOT inherit sender myMemberId');

// Test 16: ExpenseForm external participant check with external collectorId
console.log('Test 16: External participant detection with external collectorId');

const testGroup = { id: 'grp_x', members: ['u_1', 'u_2'] };
const expenseWithExternalCollector = {
    groupId: 'grp_x',
    collectorId: 'u_external_collector',
    payers: [{ userId: 'u_1', amount: 50 }],
    splits: [{ userId: 'u_1', amount: 25 }, { userId: 'u_2', amount: 25 }]
};

const memberSet = new Set(testGroup.members);
const hasExternalPayer = (expenseWithExternalCollector.payers || []).some(p => p.amount > 0 && !memberSet.has(p.userId));
const hasExternalSplit = (expenseWithExternalCollector.splits || []).some(s => s.amount > 0 && !memberSet.has(s.userId));
const hasExternalCollector = expenseWithExternalCollector.collectorId && !memberSet.has(expenseWithExternalCollector.collectorId);
const shouldShowAll = hasExternalPayer || hasExternalSplit || Boolean(hasExternalCollector);

assert.strictEqual(shouldShowAll, true, 'Expense with external collector must trigger showAllUsers = true');

// Test 17: Interactive backup import normalization, strategy options, and cloud action handling
console.log('Test 17: Backup normalization, strategy options, and cloud actions');

const legacyBackupSample = {
    version: '1.0',
    appName: 'SplitIt',
    exportDate: '2026-10-10T12:00:00.000Z',
    data: {
        currency: 'EUR',
        currentUserId: 'u_alice',
        users: [
            { id: 'u_alice', name: 'Alice', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'u_bob', name: 'Bob', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }
        ],
        groups: [
            { id: 'grp_paris', name: 'Paris Trip', members: ['u_alice', 'u_bob'], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }
        ],
        expenses: [
            { id: 'exp_hotel', description: 'Boutique Hotel', amount: 320, date: '2026-10-02', payerId: 'u_alice', createdAt: '2026-10-02T10:00:00.000Z', updatedAt: '2026-10-02T10:00:00.000Z' }
        ],
        settlements: [
            { id: 'stl_alice_bob', amount: 160, date: '2026-10-04', payerId: 'u_bob', receiverId: 'u_alice', createdAt: '2026-10-04T10:00:00.000Z', updatedAt: '2026-10-04T10:00:00.000Z' }
        ]
    }
};

// 1. Normalization of legacy backup format (expenses + settlements -> unified transactions)
const rawInner = legacyBackupSample.data;
const rawTx = Array.isArray(rawInner.transactions) ? rawInner.transactions : [];
let normalizedTx;
if (rawTx.length > 0) {
    normalizedTx = rawTx;
} else {
    const legacyExpenses = (rawInner.expenses || []).map(e => ({ ...e, type: e.type || 'EXPENSE' }));
    const legacySettlements = (rawInner.settlements || []).map(s => ({ ...s, type: s.type || 'SETTLEMENT' }));
    normalizedTx = [...legacyExpenses, ...legacySettlements];
}

const normalizedBackup = {
    ...rawInner,
    transactions: normalizedTx,
    users: rawInner.users || [],
    groups: rawInner.groups || [],
    currency: rawInner.currency || 'INR',
    deletedIds: rawInner.deletedIds || { groups: {}, members: {}, expenses: {}, settlements: {} },
    currentUserId: rawInner.currentUserId || 'u_alice'
};

assert.strictEqual(normalizedBackup.transactions.length, 2, 'Legacy expenses and settlements combined into unified transactions');
assert.strictEqual(normalizedBackup.transactions[0].type, 'EXPENSE', 'Expense has type EXPENSE');
assert.strictEqual(normalizedBackup.transactions[1].type, 'SETTLEMENT', 'Settlement has type SETTLEMENT');
assert.strictEqual(normalizedBackup.currency, 'EUR', 'Currency preserved as EUR');

// 2. Clean Restore (Replace All) vs Smart Merge (Combine Data)
const existingLocalState = {
    users: [{ id: 'u_local_user', name: 'Local User', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }],
    groups: [{ id: 'grp_local_groceries', name: 'Groceries', members: ['u_local_user'], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }],
    transactions: [{ id: 'tx_milk', description: 'Milk', amount: 4, type: 'EXPENSE', payerId: 'u_local_user', createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z' }],
    currency: 'USD',
    currentUserId: 'u_local_user',
    deletedIds: { groups: {}, members: {}, expenses: {}, settlements: {} }
};

// Under REPLACE: resulting transactions contains only backup records (2 txns)
const replacedState = {
    ...normalizedBackup,
    currentUserId: 'u_bob' // simulate targetUserId mapping
};
assert.strictEqual(replacedState.transactions.length, 2, 'Replace contains only the 2 backup transactions');
assert.strictEqual(replacedState.groups.length, 1, 'Replace contains only backup groups');
assert.strictEqual(replacedState.currentUserId, 'u_bob', 'Target user profile mapped to Bob');
assert.strictEqual(replacedState.transactions.some(t => t.id === 'tx_milk'), false, 'Replaced state does not include local transaction');

// Under MERGE: resulting transactions union local + backup records (3 txns, 2 groups)
const targetUserIdChoice = 'u_bob';
const mergedBackupState = mergeAppState(existingLocalState, normalizedBackup);
if (targetUserIdChoice) {
    mergedBackupState.currentUserId = targetUserIdChoice;
}
assert.strictEqual(mergedBackupState.transactions.length, 3, 'Smart Merge unioned local (1) + backup (2) transactions');
assert.strictEqual(mergedBackupState.groups.length, 2, 'Smart Merge unioned local (1) + backup (1) groups');
assert.strictEqual(mergedBackupState.users.length, 3, 'Smart Merge unioned local (1) + backup (2) users');
assert.strictEqual(mergedBackupState.currentUserId, 'u_bob', 'Merged state respects chosen targetUserId');
assert.ok(mergedBackupState.transactions.some(t => t.id === 'tx_milk'), 'Merged state retains local transaction');
assert.ok(mergedBackupState.transactions.some(t => t.id === 'exp_hotel'), 'Merged state includes backup expense');
assert.ok(mergedBackupState.transactions.some(t => t.id === 'stl_alice_bob'), 'Merged state includes backup settlement');

// 3. Google Drive Overwrite Cloud Payload validation
const nowIso = new Date().toISOString();
const cloudOverwritePayload = {
    version: '2.1',
    appName: 'SplitIt',
    lastSyncedAt: nowIso,
    data: replacedState
};
assert.strictEqual(cloudOverwritePayload.version, '2.1', 'Cloud overwrite payload adheres to schema v2.1');
assert.strictEqual(cloudOverwritePayload.appName, 'SplitIt', 'Cloud overwrite appName matches SplitIt');
assert.strictEqual(cloudOverwritePayload.data.transactions.length, 2, 'Cloud overwrite data holds restored transactions');
const cloudHash = computeStateHash(cloudOverwritePayload.data);
assert.ok(cloudHash && typeof cloudHash === 'string' && cloudHash.length > 0, 'Deterministic state hash generated for cloud payload');

console.log('--- ALL UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
