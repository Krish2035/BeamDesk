import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { userRepository, UserRecord } from '../repositories/user.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { AuthTokens, UserPayload } from '../types/index.js';
import { RegisterInput, LoginInput } from '../validators/auth.validator.js';
import { AppError } from '../utils/errors.js';

export class AuthService {
  async register(input: RegisterInput, ipAddress?: string): Promise<{ user: UserPayload; tokens: AuthTokens }> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError('An account with this email address already exists', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    const tokens = await this.generateTokens(user);

    await sessionRepository.createAuditLog({
      userId: user.id,
      action: 'USER_REGISTERED',
      metadata: { email: user.email },
      ipAddress,
    });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      tokens,
    };
  }

  async login(input: LoginInput, ipAddress?: string): Promise<{ user: UserPayload; tokens: AuthTokens }> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    const tokens = await this.generateTokens(user);

    await sessionRepository.createAuditLog({
      userId: user.id,
      action: 'USER_LOGIN',
      metadata: { email: user.email },
      ipAddress,
    });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenRecord = await userRepository.findRefreshToken(refreshToken);
    if (!tokenRecord || tokenRecord.revoked || new Date() > tokenRecord.expiresAt) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await userRepository.findById(tokenRecord.userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Revoke old token and rotate
    await userRepository.revokeRefreshToken(refreshToken);
    return this.generateTokens(user);
  }

  private async generateTokens(user: UserRecord): Promise<AuthTokens> {
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    const accessToken = jwt.sign(payload, config.JWT_ACCESS_SECRET, {
      expiresIn: config.ACCESS_TOKEN_EXPIRY as any,
    });

    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await userRepository.saveRefreshToken(user.id, refreshToken, expiresAt);

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
