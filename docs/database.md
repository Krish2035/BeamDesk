# Database Schema & Entity Documentation

BeamDesk uses PostgreSQL managed via Prisma ORM for persistent data, and Redis for volatile realtime state and rate-limiting.

## Entity Relationship Summary

- **User**: Registered account holders who can manage devices, request sessions, or host remote sessions.
- **RefreshToken**: Stores cryptographic hash tokens for rotating session authentication.
- **Device**: Physical or virtual machine registered to a user with an indexed, human-readable 9-digit `publicDeviceId` (e.g. `489 123 789`).
- **SavedDevice**: Address book bookmarking frequently accessed target devices with custom nicknames.
- **Session**: Permanent audit record of a remote assistance session between a requester and a target device.
- **SessionParticipant**: Tracks joined and left timestamps for both Host and Requester roles.
- **Permission**: Explicit per-session security grants (`allowMouse`, `allowKeyboard`, `allowAudio`, `allowClipboard`, `allowFileTransfer`).
- **AuditLog**: Immutable security event logs (logins, session requests, grants, revocations, and IP addresses).

## PostgreSQL Schema Overview

```sql
CREATE TABLE "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

CREATE TABLE "Device" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "publicDeviceId" TEXT UNIQUE NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "lastSeenAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

CREATE TABLE "Session" (
    "id" TEXT PRIMARY KEY,
    "requesterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "targetDeviceId" TEXT NOT NULL REFERENCES "Device"("id") ON DELETE CASCADE,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP,
    "endedAt" TIMESTAMP,
    "endReason" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
