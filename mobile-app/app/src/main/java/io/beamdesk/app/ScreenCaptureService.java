package io.beamdesk.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class ScreenCaptureService extends Service {
    private static final String TAG = "BeamDeskScreenService";
    private static final String CHANNEL_ID = "beamdesk_screen_cast";
    private static final int NOTIFICATION_ID = 4040;

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            int resultCode = intent.getIntExtra("resultCode", -1);
            Intent data = intent.getParcelableExtra("data");

            if (resultCode != -1 && data != null) {
                startForeground(NOTIFICATION_ID, buildNotification());
                startCapture(resultCode, data);
            }
        }
        return START_NOT_STICKY;
    }

    private void startCapture(int resultCode, Intent data) {
        MediaProjectionManager manager =
                (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (manager != null) {
            mediaProjection = manager.getMediaProjection(resultCode, data);
            if (mediaProjection != null) {
                Log.i(TAG, "MediaProjection initialized successfully. Capturing Android Screen.");
                DisplayMetrics metrics = getResources().getDisplayMetrics();
                int width = metrics.widthPixels;
                int height = metrics.heightPixels;
                int density = metrics.densityDpi;

                // Virtual display setup
                virtualDisplay = mediaProjection.createVirtualDisplay(
                        "BeamDeskDisplay",
                        width,
                        height,
                        density,
                        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                        null,
                        null,
                        null
                );
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "BeamDesk Screen Sharing",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active remote desktop session state");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("BeamDesk Remote Session Active")
                .setContentText("Sharing real phone screen and touch controls with laptop")
                .setSmallIcon(android.R.drawable.ic_menu_share)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }
        Log.i(TAG, "ScreenCaptureService destroyed");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
