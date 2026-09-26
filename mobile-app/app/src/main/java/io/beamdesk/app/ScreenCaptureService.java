package io.beamdesk.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

public class ScreenCaptureService extends Service {
    private static final String TAG = "BeamDeskScreenService";
    private static final String CHANNEL_ID = "beamdesk_screen_cast";
    private static final int NOTIFICATION_ID = 4040;

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private HandlerThread backgroundThread;
    private Handler backgroundHandler;
    private String sessionId;
    private long lastFrameTime = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        backgroundThread = new HandlerThread("ScreenCaptureThread");
        backgroundThread.start();
        backgroundHandler = new Handler(backgroundThread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            int resultCode = intent.getIntExtra("resultCode", -1);
            Intent data = intent.getParcelableExtra("data");
            String sid = intent.getStringExtra("sessionId");
            if (sid != null) {
                this.sessionId = sid;
            }

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
                int screenWidth = metrics.widthPixels;
                int screenHeight = metrics.heightPixels;
                int density = metrics.densityDpi;

                final int captureWidth = 540;
                final int captureHeight = (int) (540.0 * screenHeight / screenWidth);

                imageReader = ImageReader.newInstance(captureWidth, captureHeight, PixelFormat.RGBA_8888, 2);

                virtualDisplay = mediaProjection.createVirtualDisplay(
                        "BeamDeskDisplay",
                        captureWidth,
                        captureHeight,
                        density,
                        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                        imageReader.getSurface(),
                        null,
                        backgroundHandler
                );

                imageReader.setOnImageAvailableListener(reader -> {
                    long now = System.currentTimeMillis();
                    // 20 FPS (every 50ms) to ensure smooth 60fps feel without network congestion
                    if (now - lastFrameTime < 50) {
                        Image img = reader.acquireLatestImage();
                        if (img != null) img.close();
                        return;
                    }
                    lastFrameTime = now;

                    Image image = null;
                    try {
                        image = reader.acquireLatestImage();
                        if (image == null) return;

                        Image.Plane[] planes = image.getPlanes();
                        ByteBuffer buffer = planes[0].getBuffer();
                        int pixelStride = planes[0].getPixelStride();
                        int rowStride = planes[0].getRowStride();
                        int rowPadding = rowStride - pixelStride * captureWidth;

                        Bitmap bitmap = Bitmap.createBitmap(
                                captureWidth + rowPadding / pixelStride,
                                captureHeight,
                                Bitmap.Config.ARGB_8888
                        );
                        bitmap.copyPixelsFromBuffer(buffer);

                        Bitmap cleanBitmap = (rowPadding == 0)
                                ? bitmap
                                : Bitmap.createBitmap(bitmap, 0, 0, captureWidth, captureHeight);

                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        cleanBitmap.compress(Bitmap.CompressFormat.JPEG, 60, baos);
                        byte[] jpegBytes = baos.toByteArray();
                        String base64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP);

                        String targetSid = sessionId != null ? sessionId : SignalingClient.getInstance().getCurrentSessionId();
                        if (targetSid != null) {
                            SignalingClient.getInstance().sendFrame(targetSid, base64);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error encoding screen frame", e);
                    } finally {
                        if (image != null) {
                            image.close();
                        }
                    }
                }, backgroundHandler);
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
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }
        if (backgroundThread != null) {
            backgroundThread.quitSafely();
            backgroundThread = null;
        }
        Log.i(TAG, "ScreenCaptureService destroyed");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
