# REST API Reference

All REST endpoints are prefixed with `/api`. Protected routes require an `Authorization: Bearer <token>` header.

## Authentication Endpoints

### `POST /api/auth/register`
Create a new user account.
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123!"
}
```

### `POST /api/auth/login`
Authenticate user credentials.
```json
{
  "email": "jane@example.com",
  "password": "Password123!"
}
```

### `POST /api/auth/refresh`
Refresh expired access tokens using the refresh token.
```json
{
  "refreshToken": "uuid-refresh-token"
}
```

### `GET /api/auth/me`
Retrieve currently authenticated user profile.

---

## Device Endpoints

### `POST /api/devices/register`
Register a new device for the authenticated user or retrieve existing registration.
```json
{
  "name": "Jane's MacBook Pro",
  "platform": "macOS"
}
```

### `GET /api/devices/my`
List all devices registered by the authenticated user.

### `GET /api/devices/lookup/:publicDeviceId`
Look up a target device by its 9-digit public ID (`XXX-XXX-XXX`). Returns online status, name, and platform.

---

## Session Endpoints

### `GET /api/sessions/history`
Retrieve past session history and audit logs for the current user.

### `GET /api/sessions/:id`
Retrieve detailed status and metadata of an individual session.
