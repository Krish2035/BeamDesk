# BeamDesk - Professional WebRTC Remote Desktop System

**BeamDesk** is an original, ultra-low latency, secure remote-desktop web application designed for browser-to-browser screen sharing, diagnostic assistance, and device management.

> [!NOTE]
> BeamDesk is an original product inspired by modern remote-support workflows. It features an original visual brand identity, modern light-theme aesthetics, and strict interactive consent safeguards.

---

## Architecture & Folder Structure

The project strictly isolates concerns into two main application folders:

```text
Anydesk-Clone/
│
├── frontend/                     # React 19, Vite, TypeScript, Tailwind CSS, Zustand, WebRTC
│   ├── public/
│   ├── src/
│   │   ├── api/                  # REST API client with automatic token refresh
│   │   ├── components/           # Navbar, IncomingRequestModal, RemoteCursor, ChatDrawer
│   │   ├── constants/            # Socket events, storage keys, defaults
│   │   ├── pages/                # Landing, SignUp, SignIn, Dashboard, Connect, Session, Settings
│   │   ├── routes/               # React Router routes and protected auth guards
│   │   ├── services/             # WebRTC PeerConnection engine & Socket.IO signaling service
│   │   ├── store/                # Zustand auth & session state stores
│   │   ├── styles/               # Tailwind CSS & custom animations
│   │   ├── types/                # Strongly-typed TypeScript interfaces
│   │   ├── utils/                # ID formatters, platform detection
│   │   ├── validations/          # Zod authentication & connection schemas
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                      # Node.js, Express, Socket.IO, PostgreSQL (Prisma), Redis
│   ├── src/
│   │   ├── config/               # Zod-validated environment config
│   │   ├── constants/            # Socket event names & system limits
│   │   ├── controllers/          # Auth, Device, and Session REST controllers
│   │   ├── database/             # Prisma client connection manager
│   │   ├── middleware/           # JWT auth, rate limiter, error handling
│   │   ├── prisma/               # schema.prisma models (User, Device, Session, etc.)
│   │   ├── repositories/         # User, Device, Session repositories with resilient fallback
│   │   ├── routes/               # Express API routes (/api/auth, /api/devices, /api/sessions)
│   │   ├── services/             # AuthService, DeviceService, SessionService, RedisService
│   │   ├── types/                # Backend data models & signaling payloads
│   │   ├── utils/                # Winston structured logger, ID generator
│   │   ├── validators/           # Zod request body schemas
│   │   ├── websocket/            # WebRTC Socket.IO signaling gateway
│   │   ├── webrtc/               # STUN/TURN ICE server configuration
│   │   ├── app.ts                # Express application setup
│   │   └── server.ts             # HTTP & Socket.IO server entrypoint
│   ├── tests/                    # Vitest unit tests
│   ├── package.json
│   └── tsconfig.json
│
├── infrastructure/               # Containerization & NAT traversal
│   ├── docker/                   # Backend & Frontend Dockerfiles
│   ├── nginx/                    # Nginx reverse proxy configuration
│   ├── coturn/                   # Coturn STUN/TURN server configuration
│   └── docker-compose.yml        # Multi-container orchestration
│
└── docs/                         # In-depth technical documentation
    ├── architecture.md           # Architecture overview & mermaid topology
    ├── webrtc-flow.md            # WebRTC offer/answer & data channel sequence
    ├── database.md               # PostgreSQL schema & entity relationships
    ├── api.md                    # REST API endpoints reference
    ├── security.md               # Security, consent, and audit safeguards
    └── setup.md                  # Development and production setup guide
```

---

## WebRTC & Signaling Flow

1. **Authentication & Device Registration**: Upon login, each workstation receives a 9-digit human-readable identifier (e.g., `489-123-789`).
2. **Device Presence**: Devices broadcast heartbeat pings via Socket.IO to Redis presence cache.
3. **Session Request**: Requester submits a target 9-digit device ID.
4. **Consent Prompt**: Target device (Host) displays an **Incoming Request Modal** detailing requester identity and asking for granular permissions (Mouse, Keyboard, Audio, Clipboard).
5. **Interactive Approval**: When the host clicks **Accept**, the browser prompts the user to select which screen or window to stream via `navigator.mediaDevices.getDisplayMedia`.
6. **P2P Negotiation**: Signaling server exchanges SDP Offer, SDP Answer, and ICE candidates between peers.
7. **Direct Transmission**:
   - Encrypted video stream transmitted via WebRTC DTLS-SRTP.
   - Low-latency mouse, keyboard, and chat events transmitted via `RTCDataChannel`.
8. **Session Termination & Audit**: Either user can safely end the session at any time. Session duration, timestamps, and participants are recorded in PostgreSQL.

---

## Native Desktop Agent Architecture (Future Phase)

While the browser Screen Capture API allows instant zero-install screen sharing, browser security sandboxes intentionally prevent web applications from injecting synthetic mouse and keyboard events directly into the operating system.

For full unattended OS-level screen capture and remote control across arbitrary desktop software, a native companion agent can be built using **Rust** or **C++**:
- **Display Capture**: Windows Desktop Duplication API (DXGI) / Linux PipeWire / macOS ScreenCaptureKit.
- **Input Injection**: Windows `SendInput` API / Linux `uinput` (evdev) / macOS `CGEventCreateMouseEvent`.
- **Signaling Integration**: Connects as a native Socket.IO client using the identical BeamDesk signaling protocol and STUN/TURN servers.
- **User Notice**: Renders an always-on-top native overlay banner allowing the host user to instantly terminate the session with a hardware hotkey (e.g. `Ctrl+Alt+Shift+Escape`).

---

## Quickstart

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Run Backend
```bash
cd backend
npm install
npm run dev
# Running on http://localhost:4000
```

### Run Frontend
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```
