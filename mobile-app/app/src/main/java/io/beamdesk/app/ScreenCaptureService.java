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
import android.graphics.Canvas;
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
import io.beamdesk.app.R;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.Arrays;

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

    // Zero-allocation reusable buffers to prevent OutOfMemoryError and GC pauses
    private Bitmap reusablePaddedBitmap = null;
    private Bitmap reusableCleanBitmap = null;
    private Canvas reusableCanvas = null;
    private final ByteArrayOutputStream reusableBaos = new ByteArrayOutputStream(64 * 1024);
    private byte[] reusableCopyBuffer = null;

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
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        startForeground(NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
                    } else {
                        startForeground(NOTIFICATION_ID, buildNotification());
                    }
                    startCapture(resultCode, data);
                } catch (Throwable t) {
                    Log.e(TAG, "Fatal error promoting service to foreground", t);
                    stopSelf();
                }
            } else if (latestBase64Frame != null && sessionId != null) {
                sendCurrentFrameNow();
            } else if (mediaProjection == null) {
                stopSelf();
            }
        } else if (mediaProjection == null) {
            stopSelf();
        }
        return START_NOT_STICKY; // MediaProjection token is single-use; never restart without intent
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
                backgroundHandler.postDelayed(this, 1000); // 1 FPS idle keepalive for static screens
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

    /**
     * Called after a session is accepted. Attempts to send the current frame immediately,
     * and retries every 300ms for up to 3 seconds to handle the race condition where
     * no frame has been captured yet at the moment of session acceptance.
     */
    public void sendFrameBurst(String targetSessionId) {
        if (targetSessionId != null) {
            this.sessionId = targetSessionId;
        }
        if (backgroundHandler == null) return;
        final int[] attempts = {0};
        final int maxAttempts = 10;
        Runnable burstRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    String sid = sessionId != null ? sessionId : SignalingClient.getInstance().getCurrentSessionId();
                    if (sid != null && latestBase64Frame != null) {
                        SignalingClient.getInstance().sendFrame(sid, latestBase64Frame);
                        Log.i(TAG, "Frame burst sent (attempt " + (attempts[0] + 1) + ")");
                    }
                } catch (Throwable t) {
                    Log.e(TAG, "Error in frame burst", t);
                }
                attempts[0]++;
                if (attempts[0] < maxAttempts && backgroundHandler != null) {
                    backgroundHandler.postDelayed(this, 300);
                }
            }
        };
        backgroundHandler.post(burstRunnable);
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

                final int captureWidth = 480;
                final int rawHeight = (int) (480.0 * screenHeight / screenWidth);
                final int captureHeight = (rawHeight / 2) * 2; // ensure even number

                imageReader = ImageReader.newInstance(captureWidth, captureHeight, PixelFormat.RGBA_8888, 3);

                // Register listener BEFORE createVirtualDisplay so initial frame is never dropped
                imageReader.setOnImageAvailableListener(reader -> {
                    long now = System.currentTimeMillis();
                    // 10 FPS maximum: optimal balance of smooth fluidity and zero network/heap congestion
                    if (now - lastFrameTime < 100) {
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
                        if (planes == null || planes.length == 0) return;

                        ByteBuffer buffer = planes[0].getBuffer();
                        buffer.rewind();

                        int pixelStride = planes[0].getPixelStride();
                        int rowStride = planes[0].getRowStride();
                        int rowPadding = rowStride - pixelStride * captureWidth;
                        int paddedWidth = captureWidth + (rowPadding / pixelStride);

                        // Reusable Bitmap allocation (allocated once, never recreated per frame)
                        if (reusablePaddedBitmap == null || reusablePaddedBitmap.getWidth() != paddedWidth || reusablePaddedBitmap.getHeight() != captureHeight) {
                            if (reusablePaddedBitmap != null) reusablePaddedBitmap.recycle();
                            reusablePaddedBitmap = Bitmap.createBitmap(paddedWidth, captureHeight, Bitmap.Config.ARGB_8888);
                        }

                        int requiredSize = reusablePaddedBitmap.getByteCount();
                        if (buffer.remaining() >= requiredSize) {
                            reusablePaddedBitmap.copyPixelsFromBuffer(buffer);
                        } else {
                            // On some hardware, the final row excludes padding bytes.
                            // Buffer Underflow Exception is prevented by filling a reusable byte buffer.
                            if (reusableCopyBuffer == null || reusableCopyBuffer.length != requiredSize) {
                                reusableCopyBuffer = new byte[requiredSize];
                            }
                            int available = buffer.remaining();
                            buffer.get(reusableCopyBuffer, 0, available);
                            Arrays.fill(reusableCopyBuffer, available, requiredSize, (byte) 0);
                            ByteBuffer fullBuffer = ByteBuffer.wrap(reusableCopyBuffer);
                            reusablePaddedBitmap.copyPixelsFromBuffer(fullBuffer);
                        }

                        Bitmap targetBitmap;
                        if (rowPadding == 0) {
                            targetBitmap = reusablePaddedBitmap;
                        } else {
                            if (reusableCleanBitmap == null || reusableCleanBitmap.getWidth() != captureWidth || reusableCleanBitmap.getHeight() != captureHeight) {
                                if (reusableCleanBitmap != null) reusableCleanBitmap.recycle();
                                reusableCleanBitmap = Bitmap.createBitmap(captureWidth, captureHeight, Bitmap.Config.ARGB_8888);
                                reusableCanvas = new Canvas(reusableCleanBitmap);
                            }
                            if (reusableCanvas != null) {
                                reusableCanvas.drawBitmap(reusablePaddedBitmap, 0, 0, null);
                            }
                            targetBitmap = reusableCleanBitmap;
                        }

                        // Reusable output stream prevents byte array churn
                        synchronized (reusableBaos) {
                            reusableBaos.reset();
                            targetBitmap.compress(Bitmap.CompressFormat.JPEG, 50, reusableBaos);
                            byte[] jpegBytes = reusableBaos.toByteArray();
                            String base64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP);
                            latestBase64Frame = base64;

                            String targetSid = sessionId != null ? sessionId : SignalingClient.getInstance().getCurrentSessionId();
                            if (targetSid != null) {
                                SignalingClient.getInstance().sendFrame(targetSid, base64);
                            }
                        }
                    } catch (Throwable t) {
                        Log.e(TAG, "Error encoding screen frame", t);
                    } finally {
                        if (image != null) {
                            image.close();
                        }
                    }
                }, backgroundHandler);

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

                // Start idle keepalive sender for static screens
                backgroundHandler.postDelayed(frameHeartbeatRunnable, 1000);

                // Trigger immediate burst transmission to any waiting session viewer
                String initialSid = sessionId != null ? sessionId : SignalingClient.getInstance().getCurrentSessionId();
                if (initialSid != null) {
                    sendFrameBurst(initialSid);
                }
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
                .setSmallIcon(R.drawable.ic_beamdesk)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
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
        if (reusablePaddedBitmap != null) {
            reusablePaddedBitmap.recycle();
            reusablePaddedBitmap = null;
        }
        if (reusableCleanBitmap != null) {
            reusableCleanBitmap.recycle();
            reusableCleanBitmap = null;
        }
        reusableCanvas = null;
        reusableCopyBuffer = null;
        if (backgroundThread != null) {
            backgroundThread.quitSafely();
            backgroundThread = null;
        }
        Log.i(TAG, "ScreenCaptureService destroyed cleanly");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
