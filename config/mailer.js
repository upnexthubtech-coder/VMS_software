const nodemailer = require("nodemailer");

// Log SMTP Config on Server Start
console.log("=== SMTP CONFIG CHECK ===");
console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_PORT:", process.env.SMTP_PORT);
console.log("SMTP_SECURE:", process.env.SMTP_SECURE);
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("MAIL_FROM:", process.env.MAIL_FROM);
console.log("==========================");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // Gmail requires STARTTLS on port 587

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  tls: {
    minVersion: "TLSv1",
    rejectUnauthorized: false
  }
});

// Check SMTP Connection on Server Start
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ SMTP Connection Failed:");
    console.error(error);
  } else {
    console.log("✔ SMTP Server is Ready to Send Emails");
  }
});

// Send Email Function
async function sendEmail(to, subject, html) {
  console.log("\n=== Sending Email ===");
  console.log("To:", to);
  console.log("Subject:", subject);

  try {
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
    console.log("❌ SMTP Error While Sending Email:");
    console.error(error);

    return { success: false, error };
  }
}

module.exports = { sendEmail };
