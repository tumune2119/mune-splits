package io.github.tumune2119.munesplits;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app updates for the sideloaded APK: downloads a new release from GitHub and hands it to
 * Android's package installer. Android itself then asks the user to confirm the update, and only
 * installs it over this app if it is signed with the same key.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    /** Only release files from this project's GitHub repository are ever downloaded. */
    private static final String ALLOWED_PREFIX = "https://github.com/tumune2119/mune-splits/releases/download/";

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", installsAllowed());
        call.resolve(result);
    }

    /** Opens Android's "Install unknown apps" switch for MUNE Splits. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Context context = getContext();
        Intent intent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.getPackageName()))
                : new Intent(Settings.ACTION_SECURITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith(ALLOWED_PREFIX) || !url.endsWith(".apk")) {
            call.reject("Not a MUNE Splits release.");
            return;
        }
        if (!installsAllowed()) {
            call.reject("INSTALL_NOT_ALLOWED");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("Couldn't create the download folder.");
                File apk = new File(dir, "MUNE-Splits-update.apk");
                download(url, apk);
                install(apk);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Download failed.");
            }
        }).start();
    }

    private boolean installsAllowed() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void download(String url, File target) throws Exception {
        HttpURLConnection conn = null;
        // GitHub redirects release downloads to its file servers; follow a few hops.
        for (int hop = 0; hop < 5; hop++) {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("Accept", "application/octet-stream");
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                String next = conn.getHeaderField("Location");
                conn.disconnect();
                if (next == null || !next.startsWith("https://")) throw new Exception("Download was redirected somewhere unexpected.");
                url = next;
                continue;
            }
            if (code != 200) throw new Exception("Download failed (HTTP " + code + ").");
            break;
        }
        long total = conn.getContentLengthLong();
        long loaded = 0;
        long lastReport = 0;
        try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(target)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
                loaded += n;
                long now = System.currentTimeMillis();
                if (now - lastReport > 150) {
                    lastReport = now;
                    JSObject progress = new JSObject();
                    progress.put("loaded", loaded);
                    progress.put("total", total);
                    notifyListeners("progress", progress);
                }
            }
        } finally {
            conn.disconnect();
        }
        if (loaded < 1024 * 1024) throw new Exception("The download looks incomplete. Please try again.");
        JSObject done = new JSObject();
        done.put("loaded", loaded);
        done.put("total", loaded);
        notifyListeners("progress", done);
    }

    private void install(File apk) {
        Context context = getContext();
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }
}
