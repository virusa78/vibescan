Email setup for VibeScan

1) Environment variables

Add these to wasp-app/.env.server (or CI secrets):

# Provider selection: smtp | sendgrid
MAIL_PROVIDER=smtp
MAIL_FROM_ADDRESS=no-reply@yourdomain.com
MAIL_FROM_NAME="VibeScan"
MAIL_REPLY_TO=support@yourdomain.com

# SMTP (for MAIL_PROVIDER=smtp)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=supersecret

# SendGrid (for MAIL_PROVIDER=sendgrid)
SENDGRID_API_KEY=SG.xxxxx

# Webhook secret for bounce/delivery events
MAIL_BOUNCE_HANDLER_SECRET=change-me

2) DNS records

- SPF: add TXT record for your sending domain (provider provides the exact value)
- DKIM: add DKIM records provided by provider
- DMARC: add _dmarc TXT: v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain.com; pct=100

3) Local / dev

- Use Mailtrap or Ethereal for development:
  - ETHEREAL_USER / ETHEREAL_PASS (if using nodemailer with ethereal)
  - Or set MAIL_PROVIDER=sendgrid and use SendGrid test credentials

4) Test endpoint

- POST /email/test { "to": "you@example.com" } will send a test email using the configured provider.

5) Security

- Store secrets in CI or secret manager; do not commit to git
- Use TLS and authenticated SMTP where possible

6) Next steps

- Wire webhook handlers for bounce and complaint events: /api/email/webhook
- Add UI in admin panel to send test emails and view delivery logs
