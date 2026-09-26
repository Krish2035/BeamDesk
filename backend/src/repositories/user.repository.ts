import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma, isDbConnected } from '../database/index.js';
import { readJsonFile, writeJsonFile } from '../utils/fileStorage.js';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  token: string;
  userId: string;
  revoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);

const initialDefaultUsers: UserRecord[] = [
  {
    id: 'user-krish-001',
    name: 'Krish',
    email: 'krish@beamdesk.io',
    passwordHash: defaultPasswordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-demo-002',
    name: 'Demo User',
    email: 'demo@beamdesk.io',
    passwordHash: defaultPasswordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-alex-003',
    name: 'Alex Rivera',
    email: 'alex@beamdesk.io',
    passwordHash: defaultPasswordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Load persisted users or seed defaults
let persistentUsers: UserRecord[] = readJsonFile<UserRecord[]>('users.json', initialDefaultUsers);

// Ensure default accounts always exist in persisted users
for (const defaultUser of initialDefaultUsers) {
  const exists = persistentUsers.some((u) => u.email.toLowerCase() === defaultUser.email.toLowerCase());
  if (!exists) {
    persistentUsers.push(defaultUser);
  }
}
writeJsonFile('users.json', persistentUsers);

let persistentRefreshTokens: RefreshTokenRecord[] = readJsonFile<RefreshTokenRecord[]>('refresh_tokens.json', []);

export class UserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.toLowerCase().trim();
    if (isDbConnected) {
      try {
        const user = await prisma.user.findUnique({ where: { email: normalized } });
        if (user) return user;
      } catch {
        // Fallback
      }
    }
    const fallback = persistentUsers.find((u) => u.email.toLowerCase() === normalized);
    return fallback || null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (isDbConnected) {
      try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (user) return user;
      } catch {
        // Fallback
      }
    }
    return persistentUsers.find((u) => u.id === id) || null;
  }

  async create(data: { name: string; email: string; passwordHash: string }): Promise<UserRecord> {
    const normalized = data.email.toLowerCase().trim();
    if (isDbConnected) {
      try {
        return await prisma.user.create({
          data: {
            name: data.name,
            email: normalized,
            passwordHash: data.passwordHash,
          },
        });
      } catch {
        // Fallback to local storage below
      }
    }

    const newUser: UserRecord = {
      id: uuidv4(),
      name: data.name,
      email: normalized,
      passwordHash: data.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    persistentUsers.push(newUser);
    writeJsonFile('users.json', persistentUsers);
    return newUser;
  }

  async saveRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    if (isDbConnected) {
      try {
        await prisma.refreshToken.create({
          data: {
            userId,
            token,
            expiresAt,
          },
        });
        return;
      } catch {
        // Fallback to local storage below
      }
    }

    persistentRefreshTokens.push({
      id: uuidv4(),
      userId,
      token,
      revoked: false,
      expiresAt,
      createdAt: new Date(),
    });
    writeJsonFile('refresh_tokens.json', persistentRefreshTokens);
  }

  async findRefreshToken(token: string): Promise<RefreshTokenRecord | null> {
    if (isDbConnected) {
      try {
        const record = await prisma.refreshToken.findUnique({ where: { token } });
        if (record) return record;
      } catch {
        // Fallback
      }
    }
    return (
      persistentRefreshTokens.find(
        (r) => r.token === token && !r.revoked && new Date(r.expiresAt) > new Date()
      ) || null
    );
  }

  async revokeRefreshToken(token: string): Promise<void> {
    if (isDbConnected) {
      try {
        await prisma.refreshToken.updateMany({
          where: { token },
          data: { revoked: true },
        });
        return;
      } catch {
        // Fallback
      }
    }

    const rec = persistentRefreshTokens.find((r) => r.token === token);
    if (rec) {
      rec.revoked = true;
      writeJsonFile('refresh_tokens.json', persistentRefreshTokens);
    }
  }
}

export const userRepository = new UserRepository();
