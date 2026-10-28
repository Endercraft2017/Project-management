/**
 * User Management Service
 * Business logic for user operations
 */

import { prisma } from '@/database/client';
import { Role } from '@prisma/client';
import { ListUsersQuery, UpdateUserInput, UpdateRoleInput } from './validators';
import { getTenantContext, validateSchemaName } from '@/tenancy/context';
import { getControlPool } from '@/platform/store';
import { randomUUID } from 'node:crypto';

export class UserService {
  /**
   * List users with filtering, sorting, and pagination
   */
  async listUsers(query: ListUsersQuery) {
    const { page, limit, role, isActive, search, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (role !== undefined) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Execute queries in parallel
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          name: true,
          picture: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID with stats
   */
  async getUserById(userId: string, includeStats = false) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return null;
    }

    if (includeStats) {
      const stats = await this.getUserStats(userId);
      return { ...user, stats };
    }

    return user;
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string) {
    const [tasksAssigned, tasksCreated, conversations, messagesSent] = await Promise.all([
      prisma.task.count({
        where: { assignedToId: userId },
      }),
      prisma.task.count({
        where: { createdById: userId },
      }),
      prisma.conversationMember.count({
        where: { userId },
      }),
      prisma.message.count({
        where: { senderId: userId },
      }),
    ]);

    // Calculate completed tasks (100% progress)
    const tasksCompleted = await prisma.task.count({
      where: {
        assignedToId: userId,
        progress: 100,
      },
    });

    // Calculate average task progress
    const tasks = await prisma.task.findMany({
      where: { assignedToId: userId },
      select: { progress: true },
    });

    const avgTaskProgress =
      tasks.length > 0
        ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)
        : 0;

    return {
      tasksAssigned,
      tasksCreated,
      tasksCompleted,
      avgTaskProgress,
      conversations,
      messagesSent,
    };
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, data: UpdateUserInput) {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, data: UpdateRoleInput, actorId: string) {
    return this.changeAccountState(userId, { role: data.role }, actorId);
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string, actorId: string) {
    return this.changeAccountState(userId, { isActive: false }, actorId);
  }

  /**
   * Activate user
   */
  async activateUser(userId: string, actorId: string) {
    return this.changeAccountState(userId, { isActive: true }, actorId);
  }

  private async changeAccountState(userId: string, patch: { role?: Role; isActive?: boolean }, actorId: string) {
    const tenant = getTenantContext();
    const schema = validateSchemaName(tenant.schemaName);
    const client = await getControlPool().connect();
    const problem = (status: number, message: string) => Object.assign(new Error(message), { status });
    let result: any;
    try {
      await client.query('BEGIN');
      // Invitations, tenant changes and reactivation share this lock so seats
      // cannot be consumed through an alternate legacy route concurrently.
      const catalog = await client.query('SELECT status,owner_user_id,seat_limit FROM ez_control.tenants WHERE id=$1 FOR UPDATE', [tenant.id]);
      const workspace = catalog.rows[0];
      if (!workspace || workspace.status !== 'ACTIVE') throw problem(403, 'Workspace is not active');
      const actor = await client.query(`SELECT id FROM "${schema}".users WHERE id=$1 AND role='ADMIN' AND "isActive"=true FOR UPDATE`, [actorId]);
      if (!actor.rows.length) throw problem(403, 'Workspace administrator required');
      const target = await client.query(`SELECT id,role,"isActive","passwordHash" FROM "${schema}".users WHERE id=$1 FOR UPDATE`, [userId]);
      const current = target.rows[0];
      if (!current) throw problem(404, 'User not found');
      if (current.id === workspace.owner_user_id && (patch.isActive === false || (patch.role && patch.role !== Role.ADMIN))) {
        throw problem(409, 'Transfer workspace ownership before removing or demoting its owner');
      }
      if (patch.isActive === true && !current.isActive) {
        if (!current.passwordHash) throw problem(409, 'Create a new invitation to activate an account without a password');
        const seats = await client.query(`SELECT count(*) AS count FROM "${schema}".users WHERE "isActive"=true`);
        if (Number(seats.rows[0].count) >= Number(workspace.seat_limit)) throw problem(409, 'Workspace member allowance reached');
      }
      const changed = (patch.role !== undefined && patch.role !== current.role) ||
        (patch.isActive !== undefined && patch.isActive !== current.isActive);
      const updated = await client.query(`UPDATE "${schema}".users SET role=$2,"isActive"=$3,
        "sessionVersion"="sessionVersion"+$4,"updatedAt"=now() WHERE id=$1
        RETURNING id,email,name,picture,role,"isActive","updatedAt"`,
        [userId, patch.role ?? current.role, patch.isActive ?? current.isActive, changed ? 1 : 0]);
      if (changed) {
        await client.query(`DELETE FROM ez_control.tenant_sessions WHERE sess->>'tenantId'=$1 AND sess->'passport'->>'user'=$2`, [tenant.id, userId]);
        await client.query(`INSERT INTO ez_control.audit(id,tenant_id,action,detail) VALUES($1,$2,'tenant.user_changed',$3)`,
          [randomUUID(), tenant.id, JSON.stringify({ actorId, userId, fields: Object.keys(patch), role: patch.role, isActive: patch.isActive })]);
      }
      await client.query('COMMIT');
      result = { user: updated.rows[0], changed };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    if (result.changed) {
      const { disconnectUserSockets } = await import('@/chat/socket-server');
      await disconnectUserSockets(tenant.id, userId).catch(() => console.error('User socket revocation unavailable'));
    }
    return result.user;
  }
}

export const userService = new UserService();
