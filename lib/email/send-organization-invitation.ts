import { createEmailClient } from './client'

interface SendOrganizationInvitationParams {
  to: string
  organizationName: string
  inviterName?: string
  inviterEmail: string
  magicLink: string
  roleName: string
  roleDescription?: string | null
}

/**
 * Generate HTML email for organization invitation
 */
function generateInvitationHTML(params: SendOrganizationInvitationParams): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 20px;
        background-color: #f9fafb;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 32px;
      }
      .header {
        margin-bottom: 24px;
      }
      h1 {
        color: #111827;
        font-size: 24px;
        font-weight: 600;
        margin: 0 0 16px 0;
      }
      .role-badge {
        display: inline-block;
        background-color: #f3f4f6;
        color: #374151;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        margin: 8px 0;
      }
      .button {
        display: inline-block;
        background-color: #2563eb;
        color: #ffffff !important;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-weight: 500;
        margin: 24px 0;
      }
      .footer {
        margin-top: 32px;
        padding-top: 24px;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 14px;
      }
      .link {
        color: #2563eb;
        word-break: break-all;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>You've been invited to ${params.organizationName}</h1>
      </div>

      <p>
        ${params.inviterName || params.inviterEmail} has invited you to join <strong>${params.organizationName}</strong> with the role of:
      </p>

      <div class="role-badge">
        ${params.roleName}
      </div>

      ${params.roleDescription ? `<p style="color: #6b7280; font-size: 14px;">${params.roleDescription}</p>` : ''}

      <p style="margin-top: 24px;">
        Click the button below to access your new organization:
      </p>

      <a href="${params.magicLink}" class="button">
        Access ${params.organizationName}
      </a>

      <div class="footer">
        <p>
          Or copy and paste this link into your browser:
        </p>
        <p class="link">
          ${params.magicLink}
        </p>
        <p style="margin-top: 24px;">
          This link will expire in 7 days.
        </p>
      </div>
    </div>
  </body>
</html>
  `.trim()
}

/**
 * Send an organization invitation email with a magic link
 * Returns true if email was sent successfully, false otherwise
 */
export async function sendOrganizationInvitationEmail(
  params: SendOrganizationInvitationParams
): Promise<boolean> {
  const resend = createEmailClient()

  if (!resend) {
    console.warn('Email client not configured - skipping email send')
    return false
  }

  try {
    const html = generateInvitationHTML(params)

    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
      to: params.to,
      subject: `You've been invited to ${params.organizationName}`,
      html,
    })

    if (error) {
      console.error('Failed to send invitation email:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending invitation email:', error)
    return false
  }
}
