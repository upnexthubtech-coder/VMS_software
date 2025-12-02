// Read FRONTEND_URL from env if provided. Support comma-separated multiple origins.
const rawFrontends = process.env.FRONTEND_URL || 'https://visitor-nu.vercel.app';
const allowedOrigins = rawFrontends.split(',').map(u => u.trim()).filter(Boolean).map(u => u.replace(/\/$/, ''));

// Always make sure the list contains the default frontend domain without trailing slash
if (!allowedOrigins.includes('https://visitor-nu.vercel.app')) allowedOrigins.push('https://visitor-nu.vercel.app');

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman or curl)
    if (!origin) return callback(null, true);
    // Normalize origin from request (strip trailing slash)
    const normalized = origin.replace(/\/$/, '');

    if (allowedOrigins.indexOf(normalized) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

module.exports = corsOptions;
