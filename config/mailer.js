const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  }
});

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
    from: process.env.GMAIL_USER,
    to,
    subject,
    html: htmlContent,
    // attachments is an array of { filename, path } objects for nodemailer
    ...(attachments && attachments.length ? { attachments } : {}),
  };

  return transporter.sendMail(mailOptions);
}

module.exports = sendMail;
