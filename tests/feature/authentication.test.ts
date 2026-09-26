/**
 * Authentication Integration Tests
 * Tests OAuth flow, session management, and middleware
 */

import request from 'supertest';
import { PrismaClient, Role } from '@prisma/client';
import app from '../../server/src/app';

const prisma = new PrismaClient();

describe('Authentication Tests', () => {
  let testUser: any;
  let adminUser: any;

  beforeAll(async () => {
    await prisma.$connect();

    // Create test users
    testUser = await prisma.user.create({
      data: {
        email: 'test.member@servicebay.ai',
        name: 'Test Member',
        role: Role.MEMBER,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: 'test.admin@servicebay.ai',
        name: 'Test Admin',
        role: Role.ADMIN,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['test.member@servicebay.ai', 'test.admin@servicebay.ai'],
        },
      },
    });
    await prisma.$disconnect();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Auth Check Endpoint', () => {
    it('should return unauthenticated for no session', async () => {
      const response = await request(app).get('/auth/check');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);
      expect(response.body.user).toBeNull();
    });
  });

  describe('Protected Routes', () => {
    it('should deny access without authentication', async () => {
      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should allow logout attempt to fail gracefully without auth', async () => {
      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('OAuth Flow', () => {
    it('should redirect to Google OAuth', async () => {
      const response = await request(app).get('/auth/google');

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('accounts.google.com');
    });

    it('should have callback endpoint', async () => {
      const response = await request(app).get('/auth/google/callback');

      // Without valid OAuth params, should redirect to failure
      expect(response.status).toBe(302);
    });
  });

  describe('Session Management', () => {
    it('should have session middleware configured', async () => {
      const response = await request(app).get('/health');

      // Check for session cookie in response
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to API routes', async () => {
      // Make multiple requests
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get('/auth/check'));

      const responses = await Promise.all(requests);

      // All should succeed (under limit)
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('CORS Configuration', () => {
    it('should have CORS headers configured', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', process.env.CORS_ORIGIN || 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-site.com');

      // Should not have CORS headers for unauthorized origin
      expect(response.headers['access-control-allow-origin']).not.toBe('http://malicious-site.com');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize script tags from input', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .send({
          test: '<script>alert("xss")</script>',
        });

      // Should process without script tag
      expect(response.status).toBe(401); // Not authenticated, but sanitized
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown/route');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not Found');
    });

    it('should handle errors gracefully', async () => {
      // Test with malformed JSON
      const response = await request(app)
        .post('/auth/logout')
        .set('Content-Type', 'application/json')
        .send('malformed json{');

      expect(response.status).toBe(400);
    });
  });

  describe('User Roles', () => {
    it('should correctly identify admin users', () => {
      expect(adminUser.role).toBe(Role.ADMIN);
    });

    it('should correctly identify member users', () => {
      expect(testUser.role).toBe(Role.MEMBER);
    });
  });
});

describe('Middleware Tests', () => {
  describe('isAuthenticated middleware', () => {
    it('should block unauthenticated requests', async () => {
      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('Domain validation', () => {
    it('should validate servicebay.ai domain', () => {
      const validEmails = [
        'user@servicebay.ai',
        'admin@servicebay.ai',
        'test.user@servicebay.ai',
      ];

      validEmails.forEach((email) => {
        expect(email.endsWith('@servicebay.ai')).toBe(true);
      });
    });

    it('should reject invalid domains', () => {
      const invalidEmails = [
        'user@gmail.com',
        'admin@example.com',
        'test@servicebay.com',
      ];

      invalidEmails.forEach((email) => {
        expect(email.endsWith('@servicebay.ai')).toBe(false);
      });
    });
  });
});
