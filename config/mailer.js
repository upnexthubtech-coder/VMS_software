const nodemailer = require('nodemailer');
require('dotenv').config();

// Use explicit SMTP configuration when set, otherwise fall back to Gmail settings
const useSmtp = !!process.env.SMTP_HOST && !!process.env.SMTP_USER;

let transporter;
if (useSmtp) {
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';

  const options = {
    host: process.env.SMTP_HOST,
    ...(port ? { port } : {}),
    ...(typeof secure === 'boolean' ? { secure } : {}),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false'
    }
  };

  console.log('Mailer: using SMTP transport', { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT, secure });
  transporter = nodemailer.createTransport(options);

} else if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });
  console.log('Mailer: using Gmail service');

} else {
  // No mailer config found — use jsonTransport to avoid crashes during development
  console.warn('Mailer: no SMTP or Gmail credentials found — using jsonTransport fallback (development only)');
  transporter = nodemailer.createTransport({ jsonTransport: true });
}

// Verify connection configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('Mail transporter verification failed:', error);
  } else {
    console.log('Mail transporter ready');
  }
});

async function sendMail(to, subject, htmlContent, attachments = []) {
  const mailOptions = {
    from: process.env.MAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@vms',
    to,
    subject,
    html: htmlContent,
    // attachments is an array of { filename, path } objects for nodemailer
    ...(attachments && attachments.length ? { attachments } : {}),
  };

  return transporter.sendMail(mailOptions);
}

module.exports = sendMail;
