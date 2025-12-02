const sendMail = require('../config/mailer');

// Simple invite email builder
async function sendInviteEmail(to, { hostName, prebookingUrl, invitedForDate, hostEmail, customMessage }, attachments = []) {


  // Format date only (no time) in a readable localized format
  const formattedDate = invitedForDate
    ? new Date(invitedForDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const html = `
    <div style="font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#0f172a; background:#f3f4f6; padding:32px 16px;">
      <div style="max-width:720px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e6e6e6; box-shadow:0 8px 24px rgba(15,23,42,0.08);">
        <div style="background:linear-gradient(90deg,#4f46e5,#7c3aed);padding:20px 24px;color:#fff;display:flex;align-items:center;gap:12px;">
          <div style="width:48px;height:48px;background:rgba(255,255,255,0.12);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700">VP</div>
          <div>
            <div style="font-size:18px;font-weight:700;line-height:1">You have an invitation</div>
            <div style="font-size:12px;opacity:0.9;margin-top:2px">Please complete your prebooking to confirm the visit</div>
          </div>
        </div>

        <div style="padding:22px 26px;">
          <p style="margin:0 0 8px 0;font-size:15px;color:#0f172a">Hello,</p>
          <p style="margin:0 0 16px;color:#374151;font-size:14px">You've been invited by <strong style="color:#0f172a">${hostName || hostEmail || 'your host'}</strong>${formattedDate ? ` to visit on <strong>${formattedDate}</strong>` : ''}. Please confirm your visit by completing the short prebooking form.</p>

          ${customMessage ? `<div style="margin:12px 0;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #eef2ff;color:#0f172a;font-size:13px">${customMessage}</div>` : ''}

          <div style="display:flex;gap:12px;align-items:center;margin-top:18px;">
            <a href="${prebookingUrl}" style="display:inline-block;background:linear-gradient(90deg,#4f46e5,#7c3aed);color:white;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Complete prebooking</a>
            <a href="${prebookingUrl}" style="color:#374151;text-decoration:underline;font-size:13px;">Open in browser</a>
          </div>

          <div style="margin-top:16px;font-size:12px;color:#6b7280;">
            If the button doesn't work, copy and paste the link below into your browser:
            <div style="word-break:break-all;margin-top:8px;padding:10px;background:#fafafa;border-radius:6px;border:1px solid #eaeaea;color:#0f172a">${prebookingUrl}</div>
          </div>

          <div style="margin-top:22px;border-top:1px dashed #e6e6e6;padding-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="font-size:13px;color:#6b7280">Thanks,<br/><strong style="color:#0f172a">${hostName || 'Visitor Management Team'}</strong></div>
            ${formattedDate ? `<div style="font-size:13px;color:#6b7280">Visit date: <strong style="color:#0f172a">${formattedDate}</strong></div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  const subject = `${hostName ? hostName + ' invites you' : 'You are invited to visit'}${invitedForDate ? ` — ${formattedDate}` : ''}`;

  return sendMail(to, subject, html, attachments);
}

module.exports = { sendInviteEmail };

// send a gatepass email containing the gatepass image / link
async function sendGatepassEmail(to, { visitor_name, host_name, visit_date, gatepass_code, company_name }, attachments = []) {
  // Use date-only format for gatepass (no time)
  const formattedDate = visit_date
    ? new Date(visit_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const html = `
    <div style="font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial; background:#f3f4f6;padding:28px 16px;">
      <div style="max-width:720px;margin:0 auto;background:white;border-radius:12px;padding:20px;border:1px solid #e6e6e6;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #f0f0f0;padding-bottom:14px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:56px;height:56px;border-radius:10px;background:linear-gradient(90deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:18px">GP</div>
            <div>
              <div style="font-weight:700;font-size:16px;color:#0f172a">Gate Pass</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px">Access pass for your visit</div>
            </div>
          </div>
          <div style="text-align:right;color:#6b7280;font-size:12px">${formattedDate ? formattedDate : ''}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px;align-items:start;">
          <div style="padding:12px;border-radius:8px;border:1px solid #eef2ff;background:linear-gradient(180deg,#fff,#fbfbff);">
            <div style="font-size:13px;color:#94a3b8;margin-bottom:8px">Visitor</div>
            <div style="font-weight:700;color:#0f172a;font-size:16px">${visitor_name || '-'}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:8px">${company_name || '-'}</div>
          </div>

          <div style="padding:12px;border-radius:8px;border:1px solid #eef2ff;background:#fff;">
            <div style="font-size:13px;color:#94a3b8;margin-bottom:8px">Host</div>
            <div style="font-weight:700;color:#0f172a;font-size:16px">${host_name || '-'}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:8px">Please carry a valid ID for verification</div>
          </div>
        </div>

        <div style="margin-top:14px;padding:14px;border-radius:8px;border:1px dashed #e6e6e6;background:#ffffff;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:180px">
            <div style="font-size:12px;color:#94a3b8">Gatepass code</div>
            <div style="font-weight:800;font-size:22px;color:#0f172a">${gatepass_code}</div>
          </div>
          <div style="min-width:180px;text-align:left">
            <div style="font-size:12px;color:#94a3b8">Visit date</div>
            <div style="font-weight:700;color:#0f172a;font-size:14px">${formattedDate || '-'}</div>
          </div>
          <div style="min-width:160px;text-align:center">
            <div style="font-size:11px;color:#6b7280">Show this code and your ID at security</div>
            <div style="margin-top:8px;height:48px;width:48px;background:#f2f4ff;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;color:#4f46e5;font-weight:700">QR</div>
          </div>
        </div>

        <div style="margin-top:18px;font-size:13px;color:#6b7280;line-height:1.35">
          If you have questions about access or need to reschedule, reply to this email or contact your host.
        </div>

        <div style="margin-top:18px;border-top:1px solid #f0f0f0;padding-top:12px;font-size:12px;color:#9aa1ae;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>Generated by Visitor Management System</div>
          <div>Valid for one-time use — bring valid photo ID</div>
        </div>
      </div>
    </div>
  `;

  const subject = `Gate Pass — ${host_name || 'Visit'}`;

  return sendMail(to, subject, html, attachments);
}

module.exports.sendGatepassEmail = sendGatepassEmail;
