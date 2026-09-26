/**
 * Chat Routes
 * REST API routes for conversation management
 */

import { Router } from 'express';
import { isAuthenticated } from '@/auth/middleware';
import * as chatController from './controller';

const router = Router();

/**
 * GET /api/conversations
 * List conversations for authenticated user
 */
router.get('/', isAuthenticated, chatController.listConversations);

/**
 * POST /api/conversations/dm
 * Create a DM conversation
 */
router.post('/dm', isAuthenticated, chatController.createDm);

/**
 * POST /api/conversations/group
 * Create a group conversation
 */
router.post('/group', isAuthenticated, chatController.createGroup);

/**
 * GET /api/conversations/notifications
 * Get all unread notifications for authenticated user
 */
router.get('/notifications', isAuthenticated, chatController.getNotifications);

/**
 * PUT /api/conversations/notifications/:notificationId/read
 * Mark a notification as read
 */
router.put('/notifications/:notificationId/read', isAuthenticated, chatController.markNotificationRead);

/**
 * GET /api/conversations/unread-count
 * Get total unread count for authenticated user
 */
router.get('/unread-count', isAuthenticated, chatController.getUnreadCount);

/**
 * GET /api/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/:id/messages', isAuthenticated, chatController.getMessages);

/**
 * GET /api/conversations/:id/search
 * Search messages in a conversation (includes thread replies)
 */
router.get('/:id/search', isAuthenticated, chatController.searchMessages);

/**
 * POST /api/conversations/:id/messages
 * Send a message to a conversation
 */
router.post('/:id/messages', isAuthenticated, chatController.sendMessage);

/**
 * GET /api/conversations/:id/members
 * Get members of a conversation (for mentions autocomplete)
 */
router.get('/:id/members', isAuthenticated, chatController.getMembers);

/**
 * POST /api/conversations/:id/members
 * Add member to group conversation
 */
router.post('/:id/members', isAuthenticated, chatController.addMember);

/**
 * DELETE /api/conversations/:id/members/:userId
 * Remove member from group conversation
 */
router.delete('/:id/members/:userId', isAuthenticated, chatController.removeMember);

export default router;
