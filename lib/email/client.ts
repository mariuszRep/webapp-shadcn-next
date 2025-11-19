import { Resend } from 'resend'

/**
 * Resend email client for sending transactional emails
 * Requires RESEND_API_KEY environment variable
 */
export function createEmailClient() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn('RESEND_API_KEY not found - emails will not be sent')
    return null
  }

  return new Resend(apiKey)
}
