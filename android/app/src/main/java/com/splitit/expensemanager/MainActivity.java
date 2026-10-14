package com.splitit.expensemanager;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

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

        @JavascriptInterface
        public boolean isNativeAndroid() {
            return true;
        }

        @JavascriptInterface
        public boolean exportJson(final String jsonContent, final String rawFileName) {
            final String fileName = (rawFileName != null && !rawFileName.trim().isEmpty())
                    ? rawFileName.trim().replaceAll("[\\\\/:*?\"<>|]", "_")
                    : ("splitit-backup-" + System.currentTimeMillis() + ".json");

            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        // 1. Write to cache directory for FileProvider sharing
                        File cacheDir = getCacheDir();
                        File exportFile = new File(cacheDir, fileName);
                        try (FileOutputStream fos = new FileOutputStream(exportFile)) {
                            fos.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                        }

                        // 2. Save directly to public Downloads directory via MediaStore on Android 10+ (Q)
                        boolean savedToDownloads = false;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            try {
                                ContentValues values = new ContentValues();
                                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                                values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                                if (uri != null) {
                                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                                        if (os != null) {
                                            os.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                                            savedToDownloads = true;
                                        }
                                    }
                                }
                            } catch (Exception ex) {
                                Log.w(TAG, "MediaStore Downloads insert fallback", ex);
                            }
                        }

                        // 3. Open Android native Share sheet / Save to files option
                        Uri contentUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", exportFile);
                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        shareIntent.setType("application/json");
                        shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                        shareIntent.putExtra(Intent.EXTRA_SUBJECT, fileName);
                        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                        Intent chooser = Intent.createChooser(shareIntent, "Save or Share SplitIt Backup");
                        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(chooser);

                        String toastText = savedToDownloads
                                ? "Saved to Downloads & ready to share: " + fileName
                                : "Backup ready to save or share: " + fileName;
                        Toast.makeText(MainActivity.this, toastText, Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Log.e(TAG, "Error exporting JSON backup in Android bridge", e);
                        Toast.makeText(MainActivity.this, "Export error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    }
                }
            });
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
                AndroidPrintBridge bridge = new AndroidPrintBridge();
                webView.addJavascriptInterface(bridge, "AndroidPrint");
                webView.addJavascriptInterface(bridge, "AndroidBridge");
                Log.d(TAG, "AndroidPrint & AndroidBridge JavascriptInterfaces registered on WebView");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error attaching Android bridge to WebView", e);
        }
    }
}
