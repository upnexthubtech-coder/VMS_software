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

// Create transporter variable which will be initialized below depending on envs
let transporter = null;

const hasSmtpEnv = Boolean(process.env.SMTP_HOST || process.env.SMTP_USER || process.env.SMTP_PASS);

async function initTransporter() {
  // If SendGrid is configured we won't create a nodemailer transporter
  if (sendgrid) return null;

  if (hasSmtpEnv) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || smtpHost,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : smtpPort,
      secure: (typeof process.env.SMTP_SECURE !== 'undefined')
        ? (String(process.env.SMTP_SECURE).toLowerCase() === 'true')
        : smtpSecure,
      auth: {
        user: process.env.SMTP_USER || 'vms.software.upnexthub@gmail.com',
        pass: process.env.SMTP_PASS || '',
      },
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT) || 10000,
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT) || 5000,
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT) || 10000,
      tls: {
        minVersion: process.env.SMTP_TLS_MIN || 'TLSv1.2',
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
      }
    });
    return transporter;
  }

  // No SMTP envs and no SendGrid: create a test account (Ethereal) so email sending works anywhere (dev/test)
  try {
    console.log('No SMTP or SendGrid configured — creating Ethereal test account for email previews');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      }
    });
    console.log('✔ Ethereal test account created. Messages will not go to real inboxes.');
    return transporter;
  } catch (e) {
    console.warn('Failed to create Ethereal test account:', e && e.message ? e.message : e);
    return null;
  }
}

// Check SMTP Connection on Server Start
// Optionally skip SMTP verify (useful on PaaS where outbound SMTP may be blocked)
const skipVerify = String(process.env.SKIP_SMTP_VERIFY || '').toLowerCase() === 'true';

(async () => {
  // Initialize transporter if needed
  await initTransporter();

  if (sendgrid) {
    // nothing to verify for SendGrid
    return;
  }

  if (!transporter) {
    console.log('No transporter available (SendGrid disabled and transporter creation failed). Emails will use fallback behavior.');
    return;
  }

  if (skipVerify) {
    console.log('SKIP_SMTP_VERIFY=true — skipping transporter.verify() at startup.');
    return;
  }

  // Run verify to report status (may fail in environments that block SMTP)
  transporter.verify((error, success) => {
    if (error) {
      console.log('❌ SMTP Connection Failed:');
      console.error(error);

      if (error && error.code === 'ETIMEDOUT') {
        console.log('\nHint: Connection timed out when connecting to SMTP host.');
        console.log('- Check that your hosting provider allows outbound SMTP on port', process.env.SMTP_PORT || smtpPort);
        console.log('- If you are using Gmail, ensure you are using an App Password (2FA required) or OAuth2; regular account passwords are often blocked.');
        console.log('- Consider using an SMTP relay provider (SendGrid, Mailgun) if your host blocks SMTP.');
      }

      if ((process.env.SMTP_HOST || smtpHost).includes('gmail')) {
        console.log('\nGmail notes:');
        console.log('- Google may block plain username/password SMTP. Create an App Password at https://myaccount.google.com/apppasswords and use it as SMTP_PASS.');
        console.log('- Alternatively use OAuth2 credentials (client id/secret + refresh token).');
      }
    } else {
      console.log('✔ SMTP Server is Ready to Send Emails');
    }
  });
})();

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

    // Ensure transporter is initialized (initTransporter is idempotent)
    if (!transporter) {
      await initTransporter();
      if (!transporter) {
        const msg = 'No mail transporter available (no SendGrid key, no SMTP configured, and Ethereal creation failed)';
        console.warn(msg);
        return { success: false, error: new Error(msg) };
      }
    }

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });

    console.log("✔ Email Sent Successfully!");
    console.log("Message ID:", info.messageId);

    // If using Ethereal (nodemailer test account) provide preview URL
    try {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('Preview URL (Ethereal):', previewUrl);
        return { success: true, messageId: info.messageId, previewUrl };
      }
    } catch (e) {
      // ignore
    }

    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.log("❌ SMTP/SendGrid Error While Sending Email:");
    console.error(error);

    return { success: false, error };
  }
}

// Export the send function directly so call sites can `const sendMail = require('../config/mailer')`
module.exports = sendEmail;
