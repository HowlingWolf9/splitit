package com.splitit.expensemanager;

import android.content.Context;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "SplitItPrint";

    @CapacitorPlugin(name = "AndroidPrintPlugin")
    public static class AndroidPrintPlugin extends Plugin {
        @PluginMethod
        public void print(PluginCall call) {
            final String rawName = call.getString("name", "SplitIt_Statement");
            final String jobName = (rawName != null && !rawName.trim().isEmpty())
                    ? rawName.trim().replaceAll("[\\\\/:*?\"<>|]", "_")
                    : "SplitIt_Statement";

            if (getActivity() == null) {
                call.reject("Activity unavailable for printing");
                return;
            }

            getActivity().runOnUiThread(() -> {
                try {
                    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                    PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);

                    if (webView == null || printManager == null) {
                        call.reject("WebView or PrintManager unavailable");
                        return;
                    }

                    PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);
                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                    builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR);
                    builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);

                    printManager.print(jobName, printAdapter, builder.build());
                    call.resolve();
                } catch (Exception e) {
                    Log.e(TAG, "Error executing print plugin call", e);
                    call.reject("Print failed: " + e.getMessage());
                }
            });
        }
    }

    public class AndroidPrintBridge {
        @JavascriptInterface
        public boolean print(final String documentTitle) {
            final String jobName = (documentTitle != null && !documentTitle.trim().isEmpty())
                    ? documentTitle.trim().replaceAll("[\\\\/:*?\"<>|]", "_")
                    : "SplitIt_Statement";

            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                        if (webView == null) {
                            Log.e(TAG, "Cannot print: WebView is null");
                            return;
                        }

                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        if (printManager == null) {
                            Log.e(TAG, "Cannot print: PrintManager is null");
                            return;
                        }

                        PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);
                        PrintAttributes.Builder builder = new PrintAttributes.Builder();
                        builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR);
                        builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);

                        printManager.print(jobName, printAdapter, builder.build());
                        Log.d(TAG, "Native Android PrintManager job started: " + jobName);
                    } catch (Exception e) {
                        Log.e(TAG, "Error invoking native PrintManager", e);
                    }
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean isPrintingSupported() {
            return true;
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register local Capacitor plugin before super.onCreate initializes the bridge
        registerPlugin(AndroidPrintPlugin.class);
        super.onCreate(savedInstanceState);

        registerPrintBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        registerPrintBridge();
    }

    private void registerPrintBridge() {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.addJavascriptInterface(new AndroidPrintBridge(), "AndroidPrint");
                Log.d(TAG, "AndroidPrint JavascriptInterface registered on WebView");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error attaching AndroidPrint bridge to WebView", e);
        }
    }
}
