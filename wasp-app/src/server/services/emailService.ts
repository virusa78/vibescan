import sendgrid from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

const fromAddress = process.env.MAIL_FROM_ADDRESS || 'no-reply@example.com';
const fromName = process.env.MAIL_FROM_NAME;
const replyTo = process.env.MAIL_REPLY_TO;

export type EmailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export async function sendEmail(opts: EmailOptions) {
  const provider = process.env.MAIL_PROVIDER || 'smtp';

  if (provider === 'sendgrid' && process.env.SENDGRID_API_KEY) {
    sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
      to: opts.to,
      from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
      subject: opts.subject,
      text: opts.text ?? opts.html ?? '',
      html: opts.html,
      replyTo,
    } as Parameters<typeof sendgrid.send>[0];
    return sendgrid.send(msg);
  }

  // Fallback to SMTP via nodemailer
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) throw new Error('SMTP_HOST is not configured');

  const transportOptions: SMTPTransport.Options = {
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  const transporter = nodemailer.createTransport(transportOptions);
  const mailOptions = {
    from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    replyTo,
  };

  return transporter.sendMail(mailOptions);
}

export async function sendTestEmail(to: string) {
  return sendEmail({
    to,
    subject: 'VibeScan test email',
    text: 'This is a test email from VibeScan. If you received this, email sending is configured.',
    html: '<p>This is a test email from VibeScan. If you received this, email sending is configured.</p>',
  });
}
