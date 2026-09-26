/**
 * Email Utility Functions
 * Provides email normalization and validation utilities
 */

/**
 * Normalize email address to lowercase for case-insensitive comparisons
 *
 * Per RFC 5321, email local parts are technically case-sensitive, but in practice
 * all major email providers (Gmail, Outlook, etc.) treat them as case-insensitive.
 * This function ensures consistent email handling across the application.
 *
 * @param email - The email address to normalize
 * @returns The normalized email address (lowercase)
 *
 * @example
 * normalizeEmail('User@Example.Com') // returns 'user@example.com'
 * normalizeEmail('ADMIN@servicebay.ai') // returns 'admin@servicebay.ai'
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new Error('Invalid email: email must be a non-empty string');
  }

  // Trim whitespace and convert to lowercase
  return email.trim().toLowerCase();
}

/**
 * Validate if email belongs to allowed domain
 *
 * @param email - The email address to validate
 * @param domain - The allowed domain (default: '@servicebay.ai')
 * @returns True if email belongs to the allowed domain
 *
 * @example
 * isValidDomain('user@servicebay.ai') // returns true
 * isValidDomain('user@gmail.com') // returns false
 */
export function isValidDomain(email: string, domain: string = '@servicebay.ai'): boolean {
  const normalizedEmail = normalizeEmail(email);
  return normalizedEmail.endsWith(domain);
}

/**
 * Compare two email addresses in a case-insensitive manner
 *
 * @param email1 - First email address
 * @param email2 - Second email address
 * @returns True if emails match (case-insensitive)
 *
 * @example
 * emailsMatch('User@Example.Com', 'user@example.com') // returns true
 * emailsMatch('admin@servicebay.ai', 'ADMIN@servicebay.ai') // returns true
 */
export function emailsMatch(email1: string, email2: string): boolean {
  return normalizeEmail(email1) === normalizeEmail(email2);
}
