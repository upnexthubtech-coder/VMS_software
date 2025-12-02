const visitorInviteModel = require('../../models/visitor/visitorInviteModel');
const { sendInviteEmail } = require('../../services/mailerService');

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://visitor-nu.vercel.app/';

async function createVisitorInvite(req, res) {
  try {
    const { visitor_email, invite_message, invited_for_date } = req.body;

    if (!visitor_email) {
      return res.status(400).json({ message: 'visitor_email is required' });
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(visitor_email.trim())) {
      return res.status(400).json({ message: 'Invalid visitor_email' });
    }

    const createdBy = req.user?.emp_id || null;

    const invite = await visitorInviteModel.createInvite({
      visitor_email,
      invite_message,
      invited_for_date,
      created_by: createdBy
    });

    const prebookingUrl = `${APP_BASE_URL}/prebooking?token=${invite.invite_token}`;

    let email_sent = false;
    try {
      await sendInviteEmail(visitor_email, {
        prebookingUrl,
        invitedForDate: invited_for_date,
        customMessage: invite.invite_message,
      });
      email_sent = true;
    } catch (_) {
      email_sent = false;
    }

    res.status(201).json({
      message: 'Invite created',
      invite_id: invite.invite_id,
      prebooking_url: prebookingUrl,
      email_sent,
    });

  } catch (error) {
    console.error('Create visitor invite error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getInviteByToken(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Token is required' });

    const invite = await visitorInviteModel.getInviteByToken(token);
    if (!invite) return res.status(404).json({ message: 'Invite not found or expired' });

    res.json(invite);

  } catch (error) {
    console.error('Get invite by token error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { createVisitorInvite, getInviteByToken };
