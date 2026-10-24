package io.github.tumune2119.munesplits;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup.MarginLayoutParams;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app updates (see AppUpdaterPlugin). Local plugins are registered before the bridge starts.
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        keepClearOfKeyboard();
    }

    /**
     * Android 15+ draws apps edge-to-edge, and Capacitor's margins (adjustMarginsForEdgeToEdge) only
     * cover the status and navigation bars, so the keyboard used to cover bottom sheets and fields.
     * Same margins, but the bottom one grows to the keyboard's height while it's open.
     */
    private void keepClearOfKeyboard() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return; // older Android resizes for the keyboard itself
        View webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            MarginLayoutParams mlp = (MarginLayoutParams) v.getLayoutParams();
            mlp.leftMargin = bars.left;
            mlp.topMargin = bars.top;
            mlp.rightMargin = bars.right;
            mlp.bottomMargin = Math.max(bars.bottom, ime.bottom);
            v.setLayoutParams(mlp);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
