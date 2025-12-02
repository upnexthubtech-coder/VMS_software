const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter;

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false'
    }
  });

  console.log('Mailer: using SMTP transport');
} else {
  console.warn('Mailer: No SMTP credentials, using jsonTransport');
  transporter = nodemailer.createTransport({ jsonTransport: true });
}

transporter.verify((error) => {
  if (error) console.error('SMTP Verification Failed:', error);
  else console.log('Mail transporter ready');
});

async function sendMail(to, subject, htmlContent, attachments = []) {
  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html: htmlContent,
    attachments
  });
}

module.exports = sendMail;
