const allowedOrigins = ['https://visitor-nu.vercel.app/']; // Your React app origin  
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
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
