import * as React from 'react'

interface OrganizationInvitationEmailProps {
  organizationName: string
  inviterName?: string
  inviterEmail: string
  magicLink: string
  roleName: string
  roleDescription?: string | null
}

export const OrganizationInvitationEmail: React.FC<OrganizationInvitationEmailProps> = ({
  organizationName,
  inviterName,
  inviterEmail,
  magicLink,
  roleName,
  roleDescription,
}) => (
  <html>
    <head>
      <style>
        {`
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 32px;
            margin: 20px 0;
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
            color: #ffffff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            margin: 24px 0;
          }
          .button:hover {
            background-color: #1d4ed8;
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
        `}
      </style>
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>You've been invited to {organizationName}</h1>
        </div>

        <p>
          {inviterName || inviterEmail} has invited you to join <strong>{organizationName}</strong> with the role of:
        </p>

        <div className="role-badge">
          {roleName}
        </div>

        {roleDescription && (
          <p style={{ color: '#6b7280', fontSize: '14px' }}>{roleDescription}</p>
        )}

        <p style={{ marginTop: '24px' }}>
          Click the button below to access your new organization:
        </p>

        <a href={magicLink} className="button">
          Access {organizationName}
        </a>

        <div className="footer">
          <p>
            Or copy and paste this link into your browser:
          </p>
          <p className="link">
            {magicLink}
          </p>
          <p style={{ marginTop: '24px' }}>
            This link will expire in 7 days.
          </p>
        </div>
      </div>
    </body>
  </html>
)

export default OrganizationInvitationEmail
