const userModel = require('../../models/login/userModel');
const { verifyPassword } = require('../../utils/login/hashPassword');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '1d';
// Authentication: accept plaintext `password` column or `password_hash` column.
// If `password_hash` contains a bcrypt hash (starts with `$2`), use bcrypt compare;
// otherwise treat `password_hash` as plaintext (legacy data).

async function login(req, res) {
  const { user_code, password } = req.body;

  if (!user_code || !password) {
    return res.status(400).json({ message: 'User code and password are required' });
  }

  try {
    // Temporary debug logs to help trace login failures
    console.debug('Login attempt for user_code:', user_code);
    console.debug('Request body keys:', Object.keys(req.body));
    const user = await userModel.findUserByUserCode(user_code);

    console.debug('DB user result:', user ? {
      user_id: user.user_id,
      user_code: user.user_code,
      has_password_hash: !!user.password_hash,
      has_plain_password: !!user.password,
      is_active: user.is_active
    } : null);

    if (!user) {
      console.warn(`No user found for user_code='${user_code}'`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Determine match from available fields
    let isMatch = false;

    if (user.password && password === user.password) {
      // exact plaintext match in `password` column
      isMatch = true;
      console.debug('Authenticated using plaintext `password` column');
    } else if (user.password_hash) {
      // if password_hash looks like a bcrypt hash, use bcrypt comparison
      if (/^\$2[aby]\$/.test(user.password_hash)) {
        try {
          isMatch = await verifyPassword(password, user.password_hash);
          console.debug('Authenticated using bcrypt `password_hash` column');
        } catch (e) {
          console.error('Error verifying bcrypt hash:', e);
        }
      } else {
        // legacy: password_hash stored as plaintext
        if (password === user.password_hash) {
          isMatch = true;
          console.debug('Authenticated using plaintext `password_hash` column');
        }
      }
    }

    if (!isMatch) {
      console.warn(`Password mismatch for user_code='${user_code}'`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // create token payload and set httpOnly cookie
    const payload = {
      user_id: user.user_id,
      user_code: user.user_code,
      role: user.role,
      full_name: user.full_name,
      email: user.email
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    // cookie options - secure only when running in production over HTTPS
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // default 1 day
    };

    res.cookie('auth_token', token, cookieOptions);

    return res.json({
      user_id: user.user_id,
      user_code: user.user_code,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      language_preference: user.language_preference,
      last_login_at: user.last_login_at
    });


  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { login };

async function me(req, res) {
  // requireAuth middleware populates req.user
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  res.json({ ...req.user });
}

module.exports = { login, me };

