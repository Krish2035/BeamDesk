package io.beamdesk.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
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

    private static ScreenCaptureService instance;

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private HandlerThread backgroundThread;
    private Handler backgroundHandler;
    private String sessionId;
    private long lastFrameTime = 0;
    private volatile String latestBase64Frame = null;

    public static ScreenCaptureService getInstance() {
        return instance;
    }

    public static boolean isServiceRunning() {
        return instance != null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();
        backgroundThread = new HandlerThread("ScreenCaptureThread");
        backgroundThread.start();
        backgroundHandler = new Handler(backgroundThread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String sid = intent.getStringExtra("sessionId");
            if (sid != null) {
                this.sessionId = sid;
            }

            int resultCode = intent.getIntExtra("resultCode", -1);
            Intent data = intent.getParcelableExtra("data");

            if (resultCode != -1 && data != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
                } else {
                    startForeground(NOTIFICATION_ID, buildNotification());
                }
                startCapture(resultCode, data);
            } else if (latestBase64Frame != null && sessionId != null) {
                sendCurrentFrameNow();
            }
        }
        return START_STICKY;
    }

    private final Runnable frameHeartbeatRunnable = new Runnable() {
        @Override
        public void run() {
            try {
                String targetSid = sessionId != null ? sessionId : SignalingClient.getInstance().getCurrentSessionId();
                if (targetSid != null && latestBase64Frame != null) {
                    SignalingClient.getInstance().sendFrame(targetSid, latestBase64Frame);
                }
            } catch (Throwable t) {
                Log.e(TAG, "Error in frame heartbeat", t);
            }
            if (backgroundHandler != null) {
                backgroundHandler.postDelayed(this, 500); // 2 FPS idle keepalive for static screens
            }
        }
    };

    public void setSessionId(String sid) {
        this.sessionId = sid;
    }

    public void sendCurrentFrameNow() {
        if (backgroundHandler != null) {
            backgroundHandler.post(() -> {
                try {
                    String targetSid = sessionId != null ? sessionId : SignalingClient.getInstance().getCurrentSessionId();
                    if (targetSid != null && latestBase64Frame != null) {
                        SignalingClient.getInstance().sendFrame(targetSid, latestBase64Frame);
                    }
                } catch (Throwable t) {
                    Log.e(TAG, "Error sending frame on-demand", t);
                }
            });
        }
    }

    private void startCapture(int resultCode, Intent data) {
        MediaProjectionManager manager =
                (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (manager != null) {
            mediaProjection = manager.getMediaProjection(resultCode, data);
            if (mediaProjection != null) {
                Log.i(TAG, "MediaProjection initialized successfully. Capturing Android Screen.");

                // Mandatory callback in Android 14+ (API 34) before calling createVirtualDisplay()
                mediaProjection.registerCallback(new MediaProjection.Callback() {
                    @Override
                    public void onStop() {
                        super.onStop();
                        Log.i(TAG, "MediaProjection stopped by system");
                        stopSelf();
                    }
                }, backgroundHandler);

                DisplayMetrics metrics = getResources().getDisplayMetrics();
                int screenWidth = metrics.widthPixels;
                int screenHeight = metrics.heightPixels;
                int density = metrics.densityDpi;

                final int captureWidth = 540;
                final int rawHeight = (int) (540.0 * screenHeight / screenWidth);
                final int captureHeight = (rawHeight / 2) * 2; // ensure even number

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
                    // Max 22 FPS to guarantee ultra low-latency without congestion
                    if (now - lastFrameTime < 45) {
                        Image img = reader.acquireLatestImage();
                        if (img != null) img.close();
                        return;
                    }
                    lastFrameTime = now;

                    Image image = null;
                    Bitmap bitmap = null;
                    Bitmap cleanBitmap = null;
                    ByteArrayOutputStream baos = null;
                    try {
                        image = reader.acquireLatestImage();
                        if (image == null) return;

                        Image.Plane[] planes = image.getPlanes();
                        if (planes == null || planes.length == 0) return;

                        ByteBuffer buffer = planes[0].getBuffer();
                        int pixelStride = planes[0].getPixelStride();
                        int rowStride = planes[0].getRowStride();
                        int rowPadding = rowStride - pixelStride * captureWidth;

                        bitmap = Bitmap.createBitmap(
                                captureWidth + rowPadding / pixelStride,
                                captureHeight,
                                Bitmap.Config.ARGB_8888
                        );
                        bitmap.copyPixelsFromBuffer(buffer);

                        cleanBitmap = (rowPadding == 0)
                                ? bitmap
                                : Bitmap.createBitmap(bitmap, 0, 0, captureWidth, captureHeight);

                        baos = new ByteArrayOutputStream();
                        cleanBitmap.compress(Bitmap.CompressFormat.JPEG, 65, baos);
                        byte[] jpegBytes = baos.toByteArray();
                        String base64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP);
                        latestBase64Frame = base64;

                        String targetSid = sessionId != null ? sessionId : SignalingClient.getInstance().getCurrentSessionId();
                        if (targetSid != null) {
                            SignalingClient.getInstance().sendFrame(targetSid, base64);
                        }
                    } catch (Throwable t) {
                        Log.e(TAG, "Error encoding screen frame", t);
                    } finally {
                        if (image != null) {
                            image.close();
                        }
                        if (bitmap != null && bitmap != cleanBitmap) {
                            bitmap.recycle();
                        }
                        if (cleanBitmap != null) {
                            cleanBitmap.recycle();
                        }
                        if (baos != null) {
                            try { baos.close(); } catch (Exception ignored) {}
                        }
                    }
                }, backgroundHandler);

                // Start idle keepalive sender for static screens
                backgroundHandler.postDelayed(frameHeartbeatRunnable, 500);
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
        instance = null;
        if (backgroundHandler != null) {
            backgroundHandler.removeCallbacks(frameHeartbeatRunnable);
        }
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
