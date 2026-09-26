# BeamDesk Backend

High-performance, secure WebRTC signaling gateway and REST API service for BeamDesk.

## Features
- **Real-time WebRTC Signaling**: Socket.IO-based SDP offer/answer exchange, ICE candidate relays, incoming connection requests, and consent verification.
- **Device Management & Presence**: 9-digit human-readable device identifiers (`XXX-XXX-XXX`) with real-time heartbeat and Redis presence tracking.
- **Security & Consent**: JWT authentication with rotating refresh tokens, Bcrypt password hashing, rate limiting, and immutable audit logs.
- **Relational Integrity**: PostgreSQL models via Prisma ORM for User, Device, Session, SessionParticipant, Permission, RefreshToken, and AuditLog.

## Environment Variables
See [.env.example](file:///f:/krish/Anydesk-Clone/backend/.env.example) for required configuration.

## Available Scripts
- `npm run dev`: Start development server with live reload on port 4000.
- `npm run build`: Compile TypeScript into production JavaScript.
- `npm start`: Run compiled production server.
- `npm test`: Run Vitest unit tests.
- `npm run prisma:generate`: Re-generate Prisma Client.
- `npm run prisma:migrate`: Apply database migrations.
