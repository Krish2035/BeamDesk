# Setup & Development Guide

## Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- (Optional) Docker & Docker Compose for containerized PostgreSQL, Redis, and Coturn.

## Local Development (Quickstart)

### 1. Install Dependencies
```bash
# In project root:
npm install

# In backend:
cd backend
npm install
npx prisma generate --schema=src/prisma/schema.prisma

# In frontend:
cd ../frontend
npm install
```

### 2. Environment Variables
Copy `.env.example` in both folders:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Start Backend
```bash
cd backend
npm run dev
# Starts on http://localhost:4000
```

### 4. Start Frontend
```bash
cd frontend
npm run dev
# Starts on http://localhost:5173
```

## Running with Docker Compose
To launch the full production environment including Coturn STUN/TURN:
```bash
cd infrastructure
docker-compose up --build
```
Access the application at `http://localhost`.
