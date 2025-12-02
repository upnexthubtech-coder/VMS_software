const nodemailer = require("nodemailer");
let sendgrid = null;
if (process.env.SENDGRID_API_KEY) {
  try {
    sendgrid = require('@sendgrid/mail');
    sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('Using SendGrid transport (SENDGRID_API_KEY present)');
  } catch (e) {
    console.warn('SendGrid SDK not installed or failed to load:', e.message || e);
    sendgrid = null;
  }
}

// Log SMTP Config on Server Start
console.log("=== SMTP CONFIG CHECK ===");
console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_PORT:", process.env.SMTP_PORT);
console.log("SMTP_SECURE:", process.env.SMTP_SECURE);
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("MAIL_FROM:", process.env.MAIL_FROM);
console.log("==========================");

// Configure transport with sensible defaults and timeouts
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const smtpSecure = (typeof process.env.SMTP_SECURE !== 'undefined')
  ? (String(process.env.SMTP_SECURE).toLowerCase() === 'true')
  : (smtpPort === 465); // port 465 -> secure by default

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_USER || 'vms.software.upnexthub@gmail.com',
    pass: process.env.SMTP_PASS || '',
  },
  // timeouts to fail fast when provider/host blocks connections
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT) || 10000,
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT) || 5000,
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT) || 10000,
  tls: {
    // prefer modern TLS; allow self-signed in non-production if explicitly configured
    minVersion: process.env.SMTP_TLS_MIN || 'TLSv1.2',
    rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
  }
});

// Check SMTP Connection on Server Start
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ SMTP Connection Failed:');
    console.error(error);

    // Provide actionable hints for common Gmail/connectivity issues
    if (error && error.code === 'ETIMEDOUT') {
      console.log('\nHint: Connection timed out when connecting to SMTP host.');
      console.log('- Check that your hosting provider allows outbound SMTP on port', smtpPort);
      console.log('- If you are using Gmail, ensure you are using an App Password (2FA required) or OAuth2; regular account passwords are often blocked.');
      console.log('- Consider using an SMTP relay provider (SendGrid, Mailgun) if your host blocks SMTP.');
    }

    if (smtpHost && smtpHost.includes('gmail')) {
      console.log('\nGmail notes:');
      console.log('- Google may block plain username/password SMTP. Create an App Password at https://myaccount.google.com/apppasswords and use it as SMTP_PASS.');
      console.log('- Alternatively use OAuth2 credentials (client id/secret + refresh token).');
    }

  } else {
    console.log('✔ SMTP Server is Ready to Send Emails');
  }
});

// Send Email Function
async function sendEmail(to, subject, html) {
  console.log("\n=== Sending Email ===");
  console.log("To:", to);
  console.log("Subject:", subject);

  try {
    // If SendGrid is configured, prefer its HTTP API (more reliable on PaaS)
    if (sendgrid) {
      const msg = {
        to,
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        subject,
        html,
      };
      const res = await sendgrid.send(msg);
      console.log('✔ Email Sent via SendGrid');
      return { success: true, info: res };
    }

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });

    console.log("✔ Email Sent Successfully!");
    console.log("Message ID:", info.messageId);

    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.log("❌ SMTP/SendGrid Error While Sending Email:");
    console.error(error);

    return { success: false, error };
  }
}

// Export the send function directly so call sites can `const sendMail = require('../config/mailer')`
module.exports = sendEmail;
