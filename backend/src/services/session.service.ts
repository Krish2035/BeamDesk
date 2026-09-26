import { sessionRepository } from '../repositories/session.repository.js';
import { deviceRepository } from '../repositories/device.repository.js';
import { redisService } from './redis.service.js';
import { SessionPermissions, SessionState } from '../types/index.js';
import { normalizeDeviceId } from '../utils/idGenerator.js';
import { AppError } from '../utils/errors.js';

export class SessionService {
  async initiateSession(
    requesterId: string,
    targetPublicDeviceId: string,
    permissions?: Partial<SessionPermissions>
  ) {
    const normalized = normalizeDeviceId(targetPublicDeviceId);
    const targetDevice = await deviceRepository.findByPublicId(normalized);

    if (!targetDevice) {
      throw new AppError(`Device with ID ${normalized} not found.`, 404);
    }

    const rawDigits = targetDevice.publicDeviceId.replace(/\D/g, '');
    const isOnline =
      (await redisService.isDeviceOnline(targetDevice.publicDeviceId)) ||
      (rawDigits.length > 0 ? await redisService.isDeviceOnline(rawDigits) : false) ||
      (await redisService.isDeviceOnline(normalized));

    const session = await sessionRepository.create({
      requesterId,
      targetDeviceId: targetDevice.id,
      permissions,
    });

    await sessionRepository.createAuditLog({
      userId: requesterId,
      sessionId: session.id,
      action: 'SESSION_REQUESTED',
      metadata: { targetDeviceId: targetDevice.id, publicDeviceId: targetDevice.publicDeviceId },
    });

    return {
      session,
      targetDevice,
    };
  }

  async getSession(sessionId: string) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) {
      throw new AppError('Session not found', 404);
    }
    return session;
  }

  async updateSessionStatus(sessionId: string, status: SessionState, endReason?: string, userId?: string) {
    const updated = await sessionRepository.updateStatus(sessionId, status, endReason);

    let auditAction = 'SESSION_UPDATED';
    if (status === 'CONNECTED') auditAction = 'SESSION_ACCEPTED';
    if (status === 'REJECTED') auditAction = 'SESSION_REJECTED';
    if (['COMPLETED', 'FAILED', 'TIMED_OUT'].includes(status)) auditAction = 'SESSION_ENDED';

    await sessionRepository.createAuditLog({
      userId,
      sessionId,
      action: auditAction as any,
      metadata: { status, endReason },
    });

    return updated;
  }

  async updatePermissions(sessionId: string, permissions: Partial<SessionPermissions>, userId?: string) {
    const updated = await sessionRepository.updatePermissions(sessionId, permissions);

    await sessionRepository.createAuditLog({
      userId,
      sessionId,
      action: 'PERMISSION_GRANTED',
      metadata: permissions,
    });

    return updated;
  }

  async getHistory(userId: string) {
    return sessionRepository.getHistoryForUser(userId);
  }
}

export const sessionService = new SessionService();
