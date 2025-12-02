const { poolPromise } = require('../../config/db');
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const http = require('http');
const https = require('https');

async function createGatepass({
  prebooking_id, visitor_name, visitor_email, visitor_phone,
  company_name, host_emp_id, host_name,
  visit_date = null, visitor_photo_url = null,
  purpose = null, expires_at = null, time_slot_from = null
}) {

  const pool = await poolPromise;

  // ----------------------------------------------
  // 1️⃣ FIND LAST AUTO INCREMENT GATEPASS NUMBER
  // ----------------------------------------------
  const lastCodeQuery = await pool.request().query(`
      SELECT MAX(gatepass_id) AS lastId FROM visitor_gatepass
  `);

  const lastId = lastCodeQuery.recordset[0].lastId || 0;
  const nextNumber = lastId + 1;

  // Final gatepass code format: GP-1, GP-2, GP-3...
  const code = `GP-${nextNumber}`;

  // Base URL for any links if needed. Prefer explicit env override. In production
  // the deploy should set APP_API_ORIGIN to the public API origin (https://api.example.com).
  // Fall back to a reasonable local default in development.
  const baseOrigin = (process.env.APP_API_ORIGIN && process.env.APP_API_ORIGIN.replace(/\/$/, ''))
    || (process.env.NODE_ENV === 'production'
      ? `https://${process.env.HOSTNAME || 'vms-software.onrender.com'}`
      : `http://localhost:${process.env.PORT || 3000}`);

  // ensure uploads folder
  const dir = path.join(__dirname, '..', '..', 'uploads', 'gatepasses');
  fs.mkdirSync(dir, { recursive: true });

  let pdfFilename = `${Date.now()}-${code}.pdf`;
  let pdfPath = path.join(dir, pdfFilename);

  // ------------------------------
  // 2️⃣ CREATE PDF GATEPASS WITHOUT QR CODE
  // ------------------------------
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Title section with underline
    doc.font('Helvetica-Bold').fontSize(26).fillColor('#1f2937').text('Visitor Gate Pass', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#3b82f6').lineWidth(2);
    doc.moveTo(doc.page.margins.left + 100, doc.y).lineTo(doc.page.width - doc.page.margins.right - 100, doc.y).stroke();
    doc.moveDown(1);

    // Container box with shadow effect
    const boxX = doc.page.margins.left;
    const boxY = doc.y;
    const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const boxHeight = 280;

    // Light gray background with rounded corners
    if (typeof doc.roundedRect === 'function') {
      doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 12).fill('#f3f4f6');
    } else {
      doc.rect(boxX, boxY, boxWidth, boxHeight).fill('#f3f4f6');
    }

    // Content padding inside box
    const padding = 20;
    const contentX = boxX + padding;
    const contentY = boxY + padding;
    const columnWidth = (boxWidth - padding * 3) / 2;

    // Left column (visitor details)
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(18);
    doc.text(visitor_name || '-', contentX, contentY, { width: columnWidth });
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(12).fillColor('#4b5563');
    doc.text('Company:', { continued: true }).font('Helvetica-Bold').text(` ${company_name || '-'}`);
    const visitDateStr = visit_date ? new Date(visit_date).toLocaleDateString() : '-';
    const checkInTimeStr = time_slot_from ? (typeof time_slot_from === 'string' ? time_slot_from : new Date(time_slot_from).toLocaleTimeString()) : '-';
    doc.text('Visit Date:', { continued: true, lineBreak: false }).font('Helvetica-Bold').text(` ${visitDateStr}`);
    doc.text('Check-in Time:', { continued: true, lineBreak: false }).font('Helvetica-Bold').text(` ${checkInTimeStr}`);
    doc.moveDown(0.3);
    doc.font('Helvetica').text('Host:', { continued: true }).font('Helvetica-Bold').text(` ${host_name || '-'}`);
    doc.text('Gatepass ID:', { continued: true }).font('Helvetica-Bold').text(` ${code}`);
    doc.text('Phone:', { continued: true }).font('Helvetica-Bold').text(` ${visitor_phone || '-'}`);
    if (purpose) {
      doc.moveDown(0.3);
      doc.font('Helvetica').text('Purpose:', { continued: true }).font('Helvetica-Bold').text(` ${purpose}`);
    }

    // Right column: visitor photo with label
    const photoX = boxX + boxWidth - padding - 140;
    const photoY = contentY;

    if (visitor_photo_url) {
      try {
        let imgBuffer = null;
        if (/^https?:\/\//i.test(visitor_photo_url)) {
          imgBuffer = await new Promise((resolve, reject) => {
            const url = new URL(visitor_photo_url);
            const getter = url.protocol === 'https:' ? https : http;
            getter.get(url, (res) => {
              if (res.statusCode !== 200) return reject(new Error('Failed fetching image'));
              const chunks = [];
              res.on('data', d => chunks.push(d));
              res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
          });
        } else {
          const localPath = path.join(__dirname, '..', '..', visitor_photo_url.replace(/^\//, ''));
          if (fs.existsSync(localPath)) {
            imgBuffer = fs.readFileSync(localPath);
          }
        }
        if (imgBuffer) {
          if (typeof doc.roundedRect === 'function') {
            doc.roundedRect(photoX - 10, photoY - 10, 160, 180, 12).fill('#e0e7ff');
          } else {
            doc.rect(photoX - 10, photoY - 10, 160, 180).fill('#e0e7ff');
          }
          doc.image(imgBuffer, photoX, photoY, { fit: [140, 160], align: 'center', valign: 'center' });
          doc.font('Helvetica-Bold').fontSize(14).fillColor('#3b82f6').text('Visitor Photo', photoX, photoY + 165, { width: 140, align: 'center' });
        }
      } catch (e) {
        console.warn('Failed to load visitor photo', e);
      }
    }

    // Footer: instruction line and contact info
    doc.moveTo(boxX, boxY + boxHeight + 30).lineTo(boxX + boxWidth, boxY + boxHeight + 30).stroke('#d1d5db');

    doc.font('Helvetica').fontSize(10).fillColor('#6b7280');
    doc.text('Please carry this gate pass during your visit.', boxX, boxY + boxHeight + 40, { width: boxWidth, align: 'center' });
    doc.text('For assistance, contact reception or call +1 234 567 8900', boxX, boxY + boxHeight + 55, { width: boxWidth, align: 'center' });

    doc.end();
    await new Promise((resolve, reject) => stream.on('finish', resolve).on('error', reject));

  } catch (pdfErr) {
    console.warn('PDF Error:', pdfErr);
  }

  const pdfFileUrl = `${baseOrigin}/uploads/gatepasses/${pdfFilename}`;

  // ----------------------------------------------
  // 3️⃣ SAVE GATEPASS RECORD IN DATABASE
  // ----------------------------------------------
  const result = await pool.request()
    .input('prebooking_id', sql.BigInt, prebooking_id || null)
    .input('gatepass_code', sql.VarChar(100), code)
    .input('qr_data', sql.NVarChar(2000), null) // No QR data since QR was removed
    .input('qr_file_url', sql.NVarChar(500), null)
    .input('pdf_file_url', sql.NVarChar(500), pdfFileUrl)
    .input('visitor_photo_url', sql.NVarChar(500), visitor_photo_url)
    .input('visitor_name', sql.NVarChar(150), visitor_name)
    .input('visitor_email', sql.NVarChar(200), visitor_email)
    .input('visitor_phone', sql.NVarChar(50), visitor_phone)
    .input('company_name', sql.NVarChar(200), company_name)
    .input('host_emp_id', sql.BigInt, host_emp_id)
    .input('host_name', sql.NVarChar(200), host_name)
    .input('visit_date', sql.DateTime2, visit_date)
    .input('expires_at', sql.DateTime2, expires_at)
    .query(`
      INSERT INTO visitor_gatepass (
        prebooking_id, gatepass_code, qr_data, qr_file_url, pdf_file_url, visitor_photo_url,
        visitor_name, visitor_email, visitor_phone, company_name,
        host_emp_id, host_name, visit_date, expires_at
      )
      OUTPUT INSERTED.gatepass_id
      VALUES (
        @prebooking_id, @gatepass_code, @qr_data, @qr_file_url, @pdf_file_url, @visitor_photo_url,
        @visitor_name, @visitor_email, @visitor_phone, @company_name,
        @host_emp_id, @host_name, @visit_date, @expires_at
      )
    `);

  return {
    gatepass_id: result.recordset[0].gatepass_id,
    gatepass_code: code,
    qr_file_url: null,
    pdf_file_url: pdfFileUrl,
    qr_data: null,
    visitor_photo_url
  };
}

module.exports = { createGatepass };
