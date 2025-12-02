// Test harness for mailer - will use SMTP settings in .env if present
require('dotenv').config();
const sendMail = require('../config/mailer');

(async function() {
  try {
    console.log('Sending test email (check logs for transport type)');
    const to = process.env.TEST_MAIL_TO || 'test@example.com';
    const subject = 'VMS — Test Email';
    const html = `<p>This is a test email from the Visitor Management System — transport test.</p><p>If you see this, mailer is configured.</p>`;

    const result = await sendMail(to, subject, html);
    console.log('Test send result:', result);
  } catch (err) {
    console.error('Test email failed:', err);
    process.exitCode = 1;
  }
})();
