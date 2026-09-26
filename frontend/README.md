# BeamDesk Frontend

Next-generation remote desktop client built with React 19, TypeScript, Vite, Tailwind CSS, Zustand, and WebRTC.

## Key Features
- **Modern Clean UI**: Slate background, crisp white cards, brand blue action buttons (`#0c87eb`), and emerald status badges.
- **WebRTC Screen Sharing**: Full 60 FPS remote screen streaming via `navigator.mediaDevices.getDisplayMedia` with sub-frame latency.
- **Interactive Approval Modal**: Explicit consent modal requesting permissions for Mouse, Keyboard, System Audio, and Clipboard.
- **Low-Latency Remote Controls**: Visual remote cursor simulator communicating over an ordered `RTCDataChannel`.
- **In-Session Chat Drawer**: Integrated real-time text messaging between viewer and host.
- **Connection Diagnostics**: Live HUD displaying round-trip latency (ms), frame rate (FPS), resolution, and ICE connection state.

## Available Scripts
- `npm run dev`: Start Vite development server at `http://localhost:5173`.
- `npm run build`: Compile and bundle production assets with TypeScript checks.
- `npm test`: Run Vitest unit tests.
- `npm run preview`: Preview the production bundle locally.
