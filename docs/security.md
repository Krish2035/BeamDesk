# Security, Privacy & Control Architecture

BeamDesk is built with explicit consent and privacy at its core.

## Security Principles

1. **Explicit Interactive Consent**:
   - Unattended access is disabled by default.
   - Every incoming connection displays a full modal dialog on the target host showing the requester's name, device information, and requested permissions.
   - Remote screen capture **cannot start** without the host explicitly selecting their screen/window through the browser's native `navigator.mediaDevices.getDisplayMedia` dialog.

2. **Immediate Revocation**:
   - The host device maintains a persistent, floating "Revoke Access / End Session" toolbar that overrides remote input at all times.
   - Remote input can be toggled on/off on the fly by the host.

3. **Cryptographic Authentication**:
   - Passwords hashed with `bcryptjs` (salt rounds: 10).
   - Short-lived JWT access tokens (15m) and cryptographically random rotating refresh tokens (7d) stored in the database.
   - Protected routes enforce Bearer token validation and rate limiting.

4. **WebRTC End-to-End Encryption**:
   - All media streams and data channels are encrypted using DTLS-SRTP.
   - Signaling channels are secured via TLS/WSS.

5. **Audit Trail**:
   - Every session request, start, disconnect, and permission adjustment creates an immutable `AuditLog` entry in the database.
