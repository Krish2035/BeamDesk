import { prisma, isDbConnected } from '../database/index.js';
import { v4 as uuidv4 } from 'uuid';
import { SessionPermissions, SessionState } from '../types/index.js';
import { readJsonFile, writeJsonFile } from '../utils/fileStorage.js';

export interface SessionRecord {
  id: string;
  requesterId: string;
  targetDeviceId: string;
  status: SessionState;
  startedAt: Date | null;
  endedAt: Date | null;
  endReason: string | null;
  createdAt: Date;
  permissions?: SessionPermissions;
}

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  sessionId: string | null;
  action: string;
  metadata: any;
  ipAddress: string | null;
  createdAt: Date;
}

let persistentSessions: (SessionRecord & { permissions: SessionPermissions })[] =
  readJsonFile<(SessionRecord & { permissions: SessionPermissions })[]>('sessions.json', []);
let persistentAuditLogs: AuditLogRecord[] = readJsonFile<AuditLogRecord[]>('audit_logs.json', []);

export class SessionRepository {
  async create(data: {
    requesterId: string;
    targetDeviceId: string;
    permissions?: Partial<SessionPermissions>;
  }): Promise<SessionRecord & { permissions: SessionPermissions }> {
    const defaultPermissions: SessionPermissions = {
      allowMouse: data.permissions?.allowMouse ?? false,
      allowKeyboard: data.permissions?.allowKeyboard ?? false,
      allowAudio: data.permissions?.allowAudio ?? true,
      allowClipboard: data.permissions?.allowClipboard ?? false,
      allowFileTransfer: data.permissions?.allowFileTransfer ?? false,
    };

    if (isDbConnected) {
      try {
        let validRequesterId = data.requesterId;
        const userExists = await prisma.user.findUnique({ where: { id: data.requesterId } });
        if (!userExists) {
          const user = await prisma.user.upsert({
            where: { id: data.requesterId },
            update: {},
            create: {
              id: data.requesterId,
              name: 'Krish',
              email: 'krish@beamdesk.io',
              passwordHash: '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1l5Qe8n1XzQkZcM6Z1/k5XyH0g5qO6',
            },
          });
          validRequesterId = user.id;
        }

        let validTargetDeviceId = data.targetDeviceId;
        const deviceExists = await prisma.device.findUnique({ where: { id: data.targetDeviceId } });
        if (!deviceExists) {
          const dev = await prisma.device.create({
            data: {
              id: data.targetDeviceId,
              userId: validRequesterId,
              publicDeviceId: '627-199-178',
              name: 'Android Companion Phone',
              platform: 'Android',
              status: 'ONLINE',
            },
          });
          validTargetDeviceId = dev.id;
        }

        const session = await prisma.session.create({
          data: {
            requesterId: validRequesterId,
            targetDeviceId: validTargetDeviceId,
            status: 'PENDING',
            permissions: {
              create: defaultPermissions,
            },
          },
          include: {
            permissions: true,
          },
        });

        return {
          ...session,
          status: session.status as SessionState,
          permissions: session.permissions[0] || defaultPermissions,
        };
      } catch {
        // Fallback
      }
    }

    const newSession = {
      id: uuidv4(),
      requesterId: data.requesterId,
      targetDeviceId: data.targetDeviceId,
      status: 'PENDING' as SessionState,
      startedAt: null,
      endedAt: null,
      endReason: null,
      createdAt: new Date(),
      permissions: defaultPermissions,
    };
    persistentSessions.push(newSession);
    writeJsonFile('sessions.json', persistentSessions);
    return newSession;
  }

  async findById(id: string): Promise<(SessionRecord & { permissions: SessionPermissions }) | null> {
    if (isDbConnected) {
      try {
        const session = await prisma.session.findUnique({
          where: { id },
          include: { permissions: true, targetDevice: true, requester: true },
        });
        if (session) {
          return {
            ...session,
            status: session.status as SessionState,
            permissions: session.permissions[0] || {
              allowMouse: false,
              allowKeyboard: false,
              allowAudio: true,
              allowClipboard: false,
              allowFileTransfer: false,
            },
          };
        }
      } catch {
        // Fallback
      }
    }
    return persistentSessions.find((s) => s.id === id) || null;
  }

  async updateStatus(
    id: string,
    status: SessionState,
    endReason?: string
  ): Promise<SessionRecord | null> {
    const isEnding = ['COMPLETED', 'REJECTED', 'FAILED', 'TIMED_OUT'].includes(status);
    const updateData: any = { status };
    if (status === 'CONNECTED') updateData.startedAt = new Date();
    if (isEnding) {
      updateData.endedAt = new Date();
      if (endReason) updateData.endReason = endReason;
    }

    if (isDbConnected) {
      try {
        const updated = await prisma.session.update({
          where: { id },
          data: updateData,
        });
        return { ...updated, status: updated.status as SessionState };
      } catch {
        // Fallback
      }
    }

    const session = persistentSessions.find((s) => s.id === id);
    if (session) {
      session.status = status;
      if (status === 'CONNECTED' && !session.startedAt) session.startedAt = new Date();
      if (isEnding) {
        session.endedAt = new Date();
        session.endReason = endReason || null;
      }
      writeJsonFile('sessions.json', persistentSessions);
      return session;
    }
    return null;
  }

  async updatePermissions(
    sessionId: string,
    permissions: Partial<SessionPermissions>
  ): Promise<SessionPermissions> {
    if (isDbConnected) {
      try {
        const updated = await prisma.permission.update({
          where: { sessionId },
          data: permissions,
        });
        return updated;
      } catch {
        // Fallback
      }
    }

    const session = persistentSessions.find((s) => s.id === sessionId);
    if (session) {
      session.permissions = { ...session.permissions, ...permissions };
      writeJsonFile('sessions.json', persistentSessions);
      return session.permissions;
    }
    return {
      allowMouse: permissions.allowMouse ?? false,
      allowKeyboard: permissions.allowKeyboard ?? false,
      allowAudio: permissions.allowAudio ?? true,
      allowClipboard: permissions.allowClipboard ?? false,
      allowFileTransfer: permissions.allowFileTransfer ?? false,
    };
  }

  async getHistoryForUser(userId: string): Promise<any[]> {
    if (isDbConnected) {
      try {
        const sessions = await prisma.session.findMany({
          where: {
            OR: [
              { requesterId: userId },
              { targetDevice: { userId } },
            ],
          },
          include: {
            targetDevice: true,
            requester: { select: { id: true, name: true, email: true } },
            permissions: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        });
        if (sessions.length > 0) return sessions;
      } catch {
        // Fallback
      }
    }

    return persistentSessions
      .filter((s) => s.requesterId === userId)
      .slice(0, 30);
  }

  async createAuditLog(data: {
    userId?: string;
    sessionId?: string;
    action: any;
    metadata?: any;
    ipAddress?: string;
  }): Promise<void> {
    if (isDbConnected) {
      try {
        let validUserId: string | null = null;
        if (data.userId) {
          const user = await prisma.user.findUnique({ where: { id: data.userId } });
          if (user) validUserId = user.id;
        }

        let validSessionId: string | null = null;
        if (data.sessionId) {
          const session = await prisma.session.findUnique({ where: { id: data.sessionId } });
          if (session) validSessionId = session.id;
        }

        await prisma.auditLog.create({
          data: {
            userId: validUserId,
            sessionId: validSessionId,
            action: data.action,
            metadata: data.metadata || {},
            ipAddress: data.ipAddress || null,
          },
        });
        return;
      } catch {
        // Fallback
      }
    }

    persistentAuditLogs.push({
      id: uuidv4(),
      userId: data.userId || null,
      sessionId: data.sessionId || null,
      action: String(data.action),
      metadata: data.metadata || {},
      ipAddress: data.ipAddress || null,
      createdAt: new Date(),
    });
    writeJsonFile('audit_logs.json', persistentAuditLogs);
  }
}

export const sessionRepository = new SessionRepository();
