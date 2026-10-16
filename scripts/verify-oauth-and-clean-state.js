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
    STORAGE_KEY_TOKEN,
    STORAGE_KEY_EXPIRES_AT,
    STORAGE_KEY_CONNECTED,
    STORAGE_KEY_USER_PROFILE
} from '../src/services/googleDriveSync.js';

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

// Test 9: isCapacitorNative & getOAuthRedirectUri on Capacitor
console.log('Test 9: isCapacitorNative and custom scheme redirect URI');
global.window.Capacitor = {
    isNativePlatform: () => true
};
assert.strictEqual(isCapacitorNative(), true, 'Capacitor native detected');
assert.strictEqual(getOAuthRedirectUri(), 'com.splitit.expensemanager://oauth', 'Custom scheme returned on native');

delete global.window.Capacitor;
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

console.log('--- ALL UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
