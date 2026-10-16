package com.splitit.expensemanager;

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

    private GoogleSignInClient getGoogleSignInClient() {
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestScopes(new Scope(DRIVE_SCOPE))
                .build();
        return GoogleSignIn.getClient(getContext(), gso);
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

        Intent data = result.getData();
        if (result.getResultCode() == Activity.RESULT_CANCELED && data == null) {
            call.reject("Google sign-in cancelled by user");
            return;
        }

        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account == null || account.getAccount() == null) {
                call.reject("Google sign-in account unavailable");
                return;
            }

            execute(() -> fetchTokenAndResolve(call, account));
        } catch (ApiException e) {
            Log.e(TAG, "Google sign-in failed with status: " + e.getStatusCode(), e);
            call.reject("Google sign-in failed (" + e.getStatusCode() + "): " + e.getMessage());
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
            if (account != null && account.getAccount() != null) {
                execute(() -> fetchTokenAndResolve(call, account));
                return;
            }
        }
        call.reject("Authorization consent not completed");
    }

    private void fetchTokenAndResolve(PluginCall call, GoogleSignInAccount account) {
        try {
            String tokenScope = "oauth2:" + DRIVE_SCOPE;
            String token = GoogleAuthUtil.getToken(getContext(), account.getAccount(), tokenScope);

            JSObject ret = new JSObject();
            ret.put("accessToken", token);
            ret.put("email", account.getEmail());
            ret.put("name", account.getDisplayName());
            ret.put("id", account.getId());
            ret.put("expiresIn", 3600);
            call.resolve(ret);
        } catch (UserRecoverableAuthException e) {
            Intent recoverIntent = e.getIntent();
            if (recoverIntent != null) {
                startActivityForResult(call, recoverIntent, "handleRecoverableResult");
            } else {
                call.reject("Google auth recoverable error: " + e.getMessage());
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
            if (account != null && account.getAccount() != null && GoogleSignIn.hasPermissions(account, driveScope)) {
                execute(() -> fetchTokenAndResolve(call, account));
                return;
            }

            GoogleSignInClient client = getGoogleSignInClient();
            client.silentSignIn().addOnCompleteListener(task -> {
                try {
                    GoogleSignInAccount silentAccount = task.getResult(ApiException.class);
                    if (silentAccount != null && silentAccount.getAccount() != null) {
                        execute(() -> fetchTokenAndResolve(call, silentAccount));
                    } else {
                        call.reject("Silent sign-in account unavailable");
                    }
                } catch (Exception e) {
                    call.reject("Silent sign-in failed: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            call.reject("Silent sign-in check failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        try {
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
