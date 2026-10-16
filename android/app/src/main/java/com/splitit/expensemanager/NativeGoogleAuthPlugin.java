package com.splitit.expensemanager;

import android.accounts.Account;
import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.UserRecoverableAuthException;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "NativeGoogleAuthPlugin")
public class NativeGoogleAuthPlugin extends Plugin {
    private static final String TAG = "NativeGoogleAuth";
    private static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

    private GoogleSignInAccount lastAccount = null;

    private GoogleSignInClient getGoogleSignInClient() {
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestScopes(new Scope(DRIVE_SCOPE))
                .build();
        return GoogleSignIn.getClient(getContext(), gso);
    }

    private Account getAccountSafely(GoogleSignInAccount account) {
        if (account == null) return null;
        Account act = account.getAccount();
        if (act == null && account.getEmail() != null && !account.getEmail().trim().isEmpty()) {
            act = new Account(account.getEmail().trim(), "com.google");
        }
        return act;
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        try {
            GoogleSignInClient client = getGoogleSignInClient();
            Intent signInIntent = client.getSignInIntent();
            startActivityForResult(call, signInIntent, "handleSignInResult");
        } catch (Exception e) {
            Log.e(TAG, "Error launching Google sign-in", e);
            call.reject("Failed to launch Google sign-in: " + e.getMessage());
        }
    }

    @ActivityCallback
    public void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            call.reject("Google sign-in cancelled by user");
            return;
        }

        Intent data = result.getData();
        if (data == null) {
            call.reject("Google sign-in cancelled by user");
            return;
        }

        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            Account act = getAccountSafely(account);
            if (account == null || act == null) {
                call.reject("Google sign-in account unavailable");
                return;
            }

            lastAccount = account;
            execute(() -> fetchTokenAndResolve(call, account, true));
        } catch (ApiException e) {
            int statusCode = e.getStatusCode();
            if (statusCode == 12501 || statusCode == 16) {
                call.reject("Google sign-in cancelled by user");
            } else {
                Log.e(TAG, "Google sign-in failed with status: " + statusCode, e);
                call.reject("Google sign-in failed (" + statusCode + "): " + e.getMessage());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling sign-in result", e);
            call.reject("Sign-in result processing error: " + e.getMessage());
        }
    }

    @ActivityCallback
    public void handleRecoverableResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK) {
            GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(getContext());
            if (account == null) {
                account = lastAccount;
            }
            if (account != null && getAccountSafely(account) != null) {
                final GoogleSignInAccount finalAccount = account;
                execute(() -> fetchTokenAndResolve(call, finalAccount, false));
                return;
            }
        }
        call.reject("Authorization consent not completed");
    }

    private void fetchTokenAndResolve(PluginCall call, GoogleSignInAccount account, boolean allowRecovery) {
        try {
            Account act = getAccountSafely(account);
            if (act == null) {
                call.reject("Google sign-in account or email unavailable");
                return;
            }

            String tokenScope = "oauth2:" + DRIVE_SCOPE;
            String token = GoogleAuthUtil.getToken(getContext(), act, tokenScope);

            JSObject ret = new JSObject();
            ret.put("accessToken", token);
            ret.put("email", account.getEmail());
            ret.put("name", account.getDisplayName());
            ret.put("id", account.getId());
            ret.put("expiresIn", 3600);
            call.resolve(ret);
        } catch (UserRecoverableAuthException e) {
            if (allowRecovery) {
                Intent recoverIntent = e.getIntent();
                if (recoverIntent != null) {
                    if (getActivity() != null) {
                        getActivity().runOnUiThread(() -> startActivityForResult(call, recoverIntent, "handleRecoverableResult"));
                    } else {
                        startActivityForResult(call, recoverIntent, "handleRecoverableResult");
                    }
                } else {
                    call.reject("Google auth recoverable error: " + e.getMessage());
                }
            } else {
                call.reject("Recoverable authentication required: " + e.getMessage());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error obtaining Google auth token", e);
            call.reject("Failed to obtain access token: " + e.getMessage());
        }
    }

    @PluginMethod
    public void trySilentSignIn(PluginCall call) {
        try {
            Scope driveScope = new Scope(DRIVE_SCOPE);
            GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(getContext());
            if (account != null && getAccountSafely(account) != null && GoogleSignIn.hasPermissions(account, driveScope)) {
                lastAccount = account;
                execute(() -> fetchTokenAndResolve(call, account, false));
                return;
            }

            GoogleSignInClient client = getGoogleSignInClient();
            client.silentSignIn().addOnCompleteListener(task -> {
                if (task.isSuccessful()) {
                    GoogleSignInAccount silentAccount = task.getResult();
                    if (silentAccount != null && getAccountSafely(silentAccount) != null) {
                        lastAccount = silentAccount;
                        execute(() -> fetchTokenAndResolve(call, silentAccount, false));
                        return;
                    }
                }
                call.reject("Silent sign-in unavailable or requires user interaction");
            });
        } catch (Exception e) {
            call.reject("Silent sign-in check failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        try {
            lastAccount = null;
            GoogleSignInClient client = getGoogleSignInClient();
            client.signOut().addOnCompleteListener(task -> call.resolve());
        } catch (Exception e) {
            Log.e(TAG, "Error during Google sign-out", e);
            call.reject("Failed to sign out: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearToken(PluginCall call) {
        String token = call.getString("token");
        if (token != null && !token.isEmpty()) {
            execute(() -> {
                try {
                    GoogleAuthUtil.clearToken(getContext(), token);
                    call.resolve();
                } catch (Exception e) {
                    call.resolve();
                }
            });
        } else {
            call.resolve();
        }
    }
}
