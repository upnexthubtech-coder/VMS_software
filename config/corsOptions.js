// Read FRONTEND_URL from env if provided. Support comma-separated multiple origins.
// To simplify deployments, you can set FRONTEND_URL to a comma-separated list
// of allowed origins (no trailing slash). For quick staging/test you can set
// ALLOW_ALL_ORIGINS=true (not recommended for production).
const rawFrontends = (process.env.FRONTEND_URL || 'https://visitor-nu.vercel.app').toString();
const allowedOrigins = rawFrontends.split(',').map(u => u.trim()).filter(Boolean).map(u => u.replace(/\/$/, ''));

// always include the example default so local dev doesn't break
if (!allowedOrigins.includes('https://visitor-nu.vercel.app')) allowedOrigins.push('https://visitor-nu.vercel.app');

const allowAll = String(process.env.ALLOW_ALL_ORIGINS || 'false').toLowerCase() === 'true';
const allowSubdomains = String(process.env.ALLOW_SUBDOMAINS || 'false').toLowerCase() === 'true';

function normalizeOrigin(o) {
  try {
    return o.replace(/\/$/, '');
  } catch (e) {
    return o;
  }
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman or curl)
    if (!origin) return callback(null, true);

    // If explicitly allowing all origins (useful for quick staging), reflect origin
    if (allowAll) {
      console.log('CORS: allowing all origins (ALLOW_ALL_ORIGINS=true) for', origin);
      return callback(null, true);
    }

    const normalized = normalizeOrigin(origin);

    // Exact match allowed
    if (allowedOrigins.indexOf(normalized) !== -1) return callback(null, true);

    // Optional: allow subdomain suffix matches if configured
    if (allowSubdomains) {
      try {
        const originHost = new URL(normalized).hostname;
        for (const a of allowedOrigins) {
          try {
            const allowedHost = new URL(a).hostname;
            if (originHost === allowedHost || originHost.endsWith('.' + allowedHost)) {
              return callback(null, true);
            }
          } catch (e) {
            // skip invalid allowed origin entries
          }
        }
      } catch (e) {
        // fall through to reject
      }
    }

    console.warn('CORS: rejected origin', origin, '— allowed list:', allowedOrigins);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

module.exports = corsOptions;
