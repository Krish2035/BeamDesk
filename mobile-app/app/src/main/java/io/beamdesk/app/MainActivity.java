package io.beamdesk.app;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import java.util.Random;

public class MainActivity extends AppCompatActivity implements SignalingClient.SignalingCallback {
    private static final int REQUEST_SCREEN_CAPTURE = 1001;
    private static final String PREF_NAME = "beamdesk_prefs";
    private static final String KEY_DEVICE_CODE = "device_code";

    private TextView tvDeviceCode;
    private TextView tvStatusBadge;
    private Button btnAccessibility;
    private Button btnStartCast;

    private String deviceCode;
    private String pendingSessionId;
    private MediaProjectionManager projectionManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        tvDeviceCode = findViewById(R.id.tvDeviceCode);
        tvStatusBadge = findViewById(R.id.tvStatusBadge);
        btnAccessibility = findViewById(R.id.btnAccessibility);
        btnStartCast = findViewById(R.id.btnStartCast);

        projectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);

        deviceCode = getOrCreateDeviceCode();
        tvDeviceCode.setText(formatCode(deviceCode));

        // Connect signaling client to Render backend
        SignalingClient.getInstance().setCallback(this);
        SignalingClient.getInstance().connect("https://beamdesk-backend.onrender.com", deviceCode);

        // Accessibility service button
        btnAccessibility.setOnClickListener(v -> {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            startActivity(intent);
            Toast.makeText(this, "Enable 'BeamDesk' in Installed Apps to allow remote laptop clicks", Toast.LENGTH_LONG).show();
        });

        // Start screen cast button
        btnStartCast.setOnClickListener(v -> requestScreenCapture());
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateAccessibilityState();
    }

    private void updateAccessibilityState() {
        if (BeamDeskAccessibilityService.isServiceRunning()) {
            btnAccessibility.setText("✓ Remote Touch Active (Accessibility Enabled)");
            btnAccessibility.setEnabled(false);
        } else {
            btnAccessibility.setText("Enable Remote Touch (Accessibility)");
            btnAccessibility.setEnabled(true);
        }
    }

    private void requestScreenCapture() {
        if (projectionManager != null) {
            startActivityForResult(projectionManager.createScreenCaptureIntent(), REQUEST_SCREEN_CAPTURE);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_SCREEN_CAPTURE && resultCode == RESULT_OK && data != null) {
            Intent serviceIntent = new Intent(this, ScreenCaptureService.class);
            serviceIntent.putExtra("resultCode", resultCode);
            serviceIntent.putExtra("data", data);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }

            btnStartCast.setText("Screen Sharing Active");
            btnStartCast.setBackgroundColor(getResources().getColor(R.color.status_green));

            if (pendingSessionId != null) {
                SignalingClient.getInstance().acceptSession(pendingSessionId);
                pendingSessionId = null;
            }
        }
    }

    private String getOrCreateDeviceCode() {
        SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
        String code = prefs.getString(KEY_DEVICE_CODE, null);
        if (code == null) {
            Random random = new Random();
            int part1 = 100 + random.nextInt(900);
            int part2 = 100 + random.nextInt(900);
            int part3 = 100 + random.nextInt(900);
            code = String.format("%03d%03d%03d", part1, part2, part3);
            prefs.edit().putString(KEY_DEVICE_CODE, code).apply();
        }
        return code;
    }

    private String formatCode(String raw) {
        if (raw == null || raw.length() != 9) return raw != null ? raw : "";
        return raw.substring(0, 3) + " " + raw.substring(3, 6) + " " + raw.substring(6, 9);
    }

    // --- Signaling Callbacks ---
    @Override
    public void onConnected(String deviceCode) {
        tvStatusBadge.setText("ONLINE");
    }

    @Override
    public void onSessionRequested(String sessionId, String requesterName) {
        this.pendingSessionId = sessionId;

        new AlertDialog.Builder(this)
                .setTitle("Incoming Remote Connection")
                .setMessage("Laptop '" + requesterName + "' is requesting remote access to view and control this phone.\n\nAllow connection?")
                .setPositiveButton("Accept & Share", (dialog, which) -> requestScreenCapture())
                .setNegativeButton("Decline", (dialog, which) -> {
                    pendingSessionId = null;
                })
                .setCancelable(false)
                .show();
    }

    @Override
    public void onDisconnected() {
        tvStatusBadge.setText("RECONNECTING...");
    }
}
