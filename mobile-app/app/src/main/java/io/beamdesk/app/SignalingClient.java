package io.beamdesk.app;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;

import java.net.URI;

import io.socket.client.IO;
import io.socket.client.Socket;

public class SignalingClient {
    private static final String TAG = "BeamDeskSignaling";
    private static SignalingClient instance;
    private Socket socket;
    private String serverUrl = "https://beamdesk-backend.onrender.com"; // Render backend
    private String deviceCode = "";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private String currentSessionId;
    private SignalingCallback callback;

    public String getCurrentSessionId() {
        return currentSessionId;
    }

    public void setCurrentSessionId(String currentSessionId) {
        this.currentSessionId = currentSessionId;
    }

    public interface SignalingCallback {
        void onConnected(String deviceCode);
        void onSessionRequested(String sessionId, String requesterName);
        void onDisconnected();
    }

    public static synchronized SignalingClient getInstance() {
        if (instance == null) {
            instance = new SignalingClient();
        }
        return instance;
    }

    public void setCallback(SignalingCallback callback) {
        this.callback = callback;
    }

    public void connect(String serverUrl, String deviceCode) {
        this.serverUrl = serverUrl;
        this.deviceCode = deviceCode;

        try {
            IO.Options options = new IO.Options();
            options.reconnection = true;
            options.reconnectionAttempts = 999;
            options.reconnectionDelay = 1500;
            options.timeout = 20000;
            options.transports = new String[]{"websocket", "polling"};

            socket = IO.socket(URI.create(serverUrl), options);

            socket.on(Socket.EVENT_CONNECT, args -> {
                Log.i(TAG, "Connected to BeamDesk Backend Socket: " + socket.id());
                registerDevice();
            });

            socket.on(Socket.EVENT_DISCONNECT, args -> {
                Log.w(TAG, "Disconnected from BeamDesk Backend");
                stopHeartbeat();
                if (callback != null) {
                    mainHandler.post(() -> callback.onDisconnected());
                }
            });

            // Incoming session request from remote laptop (support both colon and underscore formats)
            io.socket.emitter.Emitter.Listener requestListener = args -> {
                try {
                    JSONObject data = (JSONObject) args[0];
                    String sessionId = data.getString("sessionId");
                    this.currentSessionId = sessionId;
                    String requesterName = data.optString("requesterName", "Remote Laptop");
                    Log.i(TAG, "Incoming remote request from " + requesterName + " (Session: " + sessionId + ")");
                    if (callback != null) {
                        mainHandler.post(() -> callback.onSessionRequested(sessionId, requesterName));
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error parsing incoming session request", e);
                }
            };
            socket.on("session:request:incoming", requestListener);
            socket.on("session:request_incoming", requestListener);

            // Remote Mouse Click & Touch Injection
            socket.on("control:mouse", args -> {
                try {
                    JSONObject data = (JSONObject) args[0];
                    String action = data.optString("action", "click");
                    double x = data.optDouble("x", 0.5);
                    double y = data.optDouble("y", 0.5);

                    BeamDeskAccessibilityService a11y = BeamDeskAccessibilityService.getInstance();
                    if (a11y != null) {
                        if ("click".equals(action) || "mousedown".equals(action)) {
                            a11y.performTap((float) x, (float) y);
                        } else if ("drag".equals(action)) {
                            a11y.performSwipe((float) x, (float) y, (float) x, (float) Math.max(0, y - 0.1), 200);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error handling control:mouse", e);
                }
            });

            // Remote Mobile Navigation Bar (Back, Home, Recents)
            socket.on("control:mobile-nav", args -> {
                try {
                    JSONObject data = (JSONObject) args[0];
                    String action = data.getString("action");
                    BeamDeskAccessibilityService a11y = BeamDeskAccessibilityService.getInstance();
                    if (a11y != null) {
                        if ("back".equals(action)) {
                            a11y.performBack();
                        } else if ("home".equals(action)) {
                            a11y.performHome();
                        } else if ("recents".equals(action)) {
                            a11y.performRecents();
                        } else if ("notifications".equals(action)) {
                            a11y.performNotifications();
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error handling control:mobile-nav", e);
                }
            });

            // Immediate frame refresh requested by viewer
            socket.on("stream:request_frame", args -> {
                Log.i(TAG, "Viewer requested immediate screen frame");
                ScreenCaptureService service = ScreenCaptureService.getInstance();
                if (service != null) {
                    service.sendCurrentFrameNow();
                }
            });

            socket.connect();
        } catch (Exception e) {
            Log.e(TAG, "Error initializing socket connection", e);
        }
    }

    private final Runnable heartbeatRunnable = new Runnable() {
        @Override
        public void run() {
            if (socket != null && socket.connected()) {
                try {
                    JSONObject hb = new JSONObject();
                    hb.put("deviceId", deviceCode);
                    socket.emit("device:heartbeat", hb);
                } catch (Exception ignored) {}
                mainHandler.postDelayed(this, 20000);
            }
        }
    };

    private void startHeartbeat() {
        stopHeartbeat();
        mainHandler.postDelayed(heartbeatRunnable, 20000);
    }

    private void stopHeartbeat() {
        mainHandler.removeCallbacks(heartbeatRunnable);
    }

    private void registerDevice() {
        if (socket == null || !socket.connected()) return;
        try {
            JSONObject payload = new JSONObject();
            payload.put("deviceId", deviceCode);
            payload.put("name", "Android Companion Phone");
            payload.put("platform", "Android");
            socket.emit("device:register", payload);
            Log.i(TAG, "Device registered with code: " + deviceCode);

            startHeartbeat();

            if (callback != null) {
                mainHandler.post(() -> callback.onConnected(deviceCode));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error emitting device:register", e);
        }
    }

    public void acceptSession(String sessionId) {
        this.currentSessionId = sessionId;
        if (socket == null || !socket.connected()) return;
        try {
            JSONObject joinPayload = new JSONObject();
            joinPayload.put("sessionId", sessionId);
            socket.emit("session:join", joinPayload);

            JSONObject payload = new JSONObject();
            payload.put("sessionId", sessionId);
            payload.put("isDesktopHost", false);

            JSONObject perms = new JSONObject();
            perms.put("allowMouse", true);
            perms.put("allowKeyboard", true);
            perms.put("allowAudio", true);
            payload.put("approvedPermissions", perms);

            socket.emit("session:accept", payload);
            Log.i(TAG, "Session accepted: " + sessionId);

            // Burst-send frames so the laptop receives one as soon as capture has a frame ready
            ScreenCaptureService service = ScreenCaptureService.getInstance();
            if (service != null) {
                service.sendFrameBurst(sessionId);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending session:accept", e);
        }
    }

    public void sendFrame(String sessionId, String base64Frame) {
        if (socket == null || !socket.connected() || sessionId == null || base64Frame == null) return;
        try {
            JSONObject payload = new JSONObject();
            payload.put("sessionId", sessionId);
            payload.put("frame", "data:image/jpeg;base64," + base64Frame);
            socket.emit("stream:frame", payload);
        } catch (Exception e) {
            Log.e(TAG, "Error sending screen frame", e);
        }
    }
}
