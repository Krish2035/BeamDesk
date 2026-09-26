# BeamDesk System Architecture

BeamDesk is a modern, ultra-low latency, secure remote-desktop web application designed for browser-to-browser screen sharing, diagnostics, and remote assistance, with forward compatibility for a native desktop agent.

## High-Level Topology

```mermaid
graph TD
    subgraph Browser A [Requester / Viewer Browser]
        UI_A[React UI & Viewer]
        Zustand_A[Zustand State Store]
        Peer_A[WebRTC RTCPeerConnection]
        Data_A[RTCDataChannel]
        Socket_A[Socket.IO Client]
    end

    subgraph Browser B [Host / Remote Device Browser]
        UI_B[React UI & Permissions Modal]
        ScreenCap_B[getDisplayMedia Screen Stream]
        Peer_B[WebRTC RTCPeerConnection]
        Data_B[RTCDataChannel]
        Socket_B[Socket.IO Client]
    end

    subgraph Backend Services [Node.js + TypeScript]
        Express[Express REST API]
        Signaling[Socket.IO Signaling Gateway]
        AuthSvc[Auth & JWT Service]
        DeviceSvc[Device Registry & Presence]
        SessionSvc[Session Manager]
    end

    subgraph Data Tier
        Postgres[(PostgreSQL Database)]
        Redis[(Redis Cache & Pub/Sub)]
    end

    subgraph NAT Traversal
        STUN[Google STUN Servers]
        TURN[Coturn Relay Server]
    end

    UI_A --> Socket_A
    UI_B --> Socket_B
    Socket_A <-->|Signaling & Presence| Signaling
    Socket_B <-->|Signaling & Presence| Signaling

    Signaling <--> Redis
    Express <--> Postgres
    Express <--> Redis

    Peer_A <-->|ICE Gathering| STUN
    Peer_B <-->|ICE Gathering| STUN
    Peer_A -.->|Fallback Relay| TURN
    Peer_B -.->|Fallback Relay| TURN

    Peer_A <==|Encrypted SRTP Video Stream| Peer_B
    Data_A <==|Bidirectional Control & Chat| Data_B
```

## Key Components

1. **Frontend (`frontend/`)**:
   - Single Page Application built with React 19, TypeScript, Vite, Tailwind CSS.
   - Clean, modern, desktop-first UI with accessible widgets, dark text, clean white cards, vibrant blue actions (`#0c87eb`), and crisp green online badges (`#10b981`).
   - WebRTC RTCPeerConnection lifecycle manager with adaptive quality, stats tracking, ICE candidate queueing, and automatic reconnection.
   - Screen capture using `navigator.mediaDevices.getDisplayMedia` with permission consent safeguards.
   - Low-latency `RTCDataChannel` for simulated remote cursor events and in-session chat.

2. **Backend (`backend/`)**:
   - Express server handling REST endpoints for authentication, device registration, saved devices, audit logs, and session history.
   - Socket.IO server handling stateful device presence, ping/pong heartbeats, connection negotiations (request -> accept/reject), and WebRTC SDP/ICE candidate exchange.
   - Redis layer for device presence caching, rate limiting, and ephemeral session state, with resilient in-memory fallback.
   - Prisma ORM managing relational schemas in PostgreSQL.

3. **Infrastructure (`infrastructure/`)**:
   - Containerized Docker Compose environment orchestrating PostgreSQL, Redis, Coturn STUN/TURN, Backend, and Nginx.
