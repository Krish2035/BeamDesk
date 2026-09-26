# WebRTC & Signaling Flow

This document details the step-by-step negotiation sequence between the Viewer (Requester) and Host (Target Device).

## Signaling Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Requester as Viewer (Client)
    participant Signaling as Socket.IO Signaling Server
    participant Redis as Redis / DB Presence
    actor Host as Target Device (Host)

    Host->>Signaling: device:register (deviceId, token)
    Signaling->>Redis: Set device:status = ONLINE
    Signaling-->>Host: device:registered (acknowledged)

    Requester->>Signaling: session:request (targetDeviceId, permissionsRequested)
    Signaling->>Redis: Check targetDeviceId status
    alt Device is Offline or Invalid
        Signaling-->>Requester: system:error ("Device is offline or invalid")
    else Device is Online
        Signaling->>Host: session:request_incoming (sessionId, requesterName, permissions)
        Host-->>Host: Display Incoming Request Modal
        
        alt Host Rejects
            Host->>Signaling: session:reject (sessionId, reason)
            Signaling->>Requester: session:rejected (sessionId, reason)
        else Host Accepts
            Host->>Host: Trigger getDisplayMedia (Screen selection)
            Host->>Signaling: session:accept (sessionId, permissionsApproved)
            Signaling->>Requester: session:accepted (sessionId, permissionsApproved)

            Requester->>Requester: Create RTCPeerConnection & DataChannel
            Requester->>Requester: Create SDP Offer
            Requester->>Signaling: webrtc:offer (sessionId, sdpOffer)
            Signaling->>Host: webrtc:offer (sessionId, sdpOffer)

            Host->>Host: Set Remote Description (Offer)
            Host->>Host: Attach MediaStream (Screen tracks)
            Host->>Host: Create SDP Answer
            Host->>Signaling: webrtc:answer (sessionId, sdpAnswer)
            Signaling->>Requester: webrtc:answer (sessionId, sdpAnswer)
            Requester->>Requester: Set Remote Description (Answer)

            Note over Requester,Host: Exchange ICE Candidates via Signaling Server
            Requester->>Signaling: webrtc:ice_candidate (candidate)
            Signaling->>Host: webrtc:ice_candidate (candidate)
            Host->>Signaling: webrtc:ice_candidate (candidate)
            Signaling->>Requester: webrtc:ice_candidate (candidate)

            Note over Requester,Host: Direct P2P SRTP Media & DataChannel Established
            Requester->>Host: RTCDataChannel (Mouse/Keyboard events, Chat)
            Host->>Requester: SRTP Video/Audio Stream
        end
    end
```

## Control Message Formats (RTCDataChannel)

Data channel label: `beamdesk-control` (ordered, reliable).

### Mouse Event
```json
{
  "type": "control:mouse",
  "data": {
    "action": "mousemove",
    "x": 0.4523,
    "y": 0.6120,
    "button": 0
  }
}
```

### Keyboard Event
```json
{
  "type": "control:keyboard",
  "data": {
    "action": "keydown",
    "key": "Enter",
    "code": "Enter",
    "altKey": false,
    "ctrlKey": false,
    "shiftKey": false,
    "metaKey": false
  }
}
```

### Chat Message
```json
{
  "type": "session:chat",
  "data": {
    "senderId": "user-uuid",
    "senderName": "Alex",
    "text": "Can you see the settings dialog?",
    "timestamp": 1727271900000
  }
}
```
