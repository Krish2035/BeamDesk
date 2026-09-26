package io.beamdesk.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

public class BeamDeskAccessibilityService extends AccessibilityService {
    private static final String TAG = "BeamDeskA11y";
    private static BeamDeskAccessibilityService instance;

    public static BeamDeskAccessibilityService getInstance() {
        return instance;
    }

    public static boolean isServiceRunning() {
        return instance != null;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        Log.i(TAG, "BeamDesk Accessibility Service Connected - Remote Touch Active");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Unused for passive injection
    }

    @Override
    public void onInterrupt() {
        Log.w(TAG, "BeamDesk Accessibility Service Interrupted");
        instance = null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
    }

    // Physical Touch Tap Injection from remote Laptop
    public boolean performTap(float xRatio, float yRatio) {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        float x = Math.max(0, Math.min(1, xRatio)) * metrics.widthPixels;
        float y = Math.max(0, Math.min(1, yRatio)) * metrics.heightPixels;

        Path clickPath = new Path();
        clickPath.moveTo(x, y);

        GestureDescription.StrokeDescription stroke =
                new GestureDescription.StrokeDescription(clickPath, 0, 50);

        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);

        return dispatchGesture(builder.build(), null, null);
    }

    // Physical Touch Swipe / Drag Injection
    public boolean performSwipe(float x1Ratio, float y1Ratio, float x2Ratio, float y2Ratio, int durationMs) {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        float x1 = Math.max(0, Math.min(1, x1Ratio)) * metrics.widthPixels;
        float y1 = Math.max(0, Math.min(1, y1Ratio)) * metrics.heightPixels;
        float x2 = Math.max(0, Math.min(1, x2Ratio)) * metrics.widthPixels;
        float y2 = Math.max(0, Math.min(1, y2Ratio)) * metrics.heightPixels;

        Path swipePath = new Path();
        swipePath.moveTo(x1, y1);
        swipePath.lineTo(x2, y2);

        GestureDescription.StrokeDescription stroke =
                new GestureDescription.StrokeDescription(swipePath, 0, Math.max(50, durationMs));

        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);

        return dispatchGesture(builder.build(), null, null);
    }

    // Navigation Keys
    public boolean performBack() {
        return performGlobalAction(GLOBAL_ACTION_BACK);
    }

    public boolean performHome() {
        return performGlobalAction(GLOBAL_ACTION_HOME);
    }

    public boolean performRecents() {
        return performGlobalAction(GLOBAL_ACTION_RECENTS);
    }

    public boolean performNotifications() {
        return performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
    }
}
