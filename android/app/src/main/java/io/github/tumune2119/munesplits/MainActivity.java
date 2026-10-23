package io.github.tumune2119.munesplits;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app updates (see AppUpdaterPlugin). Local plugins are registered before the bridge starts.
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
