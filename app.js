require('dotenv').config();
const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/corsOptions');
const routes = require('./routes/index.route');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

// Trust proxy headers (X-Forwarded-Proto, X-Forwarded-Host) when running behind
// a reverse proxy (Render, Vercel, etc). This makes `req.protocol` and
// `req.get('host')` reflect the public origin.
app.set('trust proxy', true);

app.use(cors(corsOptions));
app.use(express.json());
// support signed cookies / httpOnly cookies
app.use(cookieParser());

app.use('/api', routes);

// serve uploaded files publicly at /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// health check
app.get('/', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

const PORT = process.env.PORT || 3000;
// create HTTP server and attach Socket.IO for real-time notifications
const httpServer = require('http').createServer(app);
// Normalize FRONTEND_URL for socket.io CORS (strip trailing slash)
const frontendOrigin = (process.env.FRONTEND_URL || '*').toString().replace(/\/$/, '');
const io = require('socket.io')(httpServer, {
	cors: { origin: frontendOrigin || '*', methods: ['GET', 'POST', 'PUT', 'PATCH'] },
});

// expose io on app so controllers can emit: req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
	console.log('Socket connected', socket.id);

	socket.on('register_user', ({ user_id, role }) => {
		if (!user_id) return;
		socket.join(`user:${user_id}`);
		if (role) socket.join(`role:${role}`);
		console.log(`User ${user_id} joined rooms user:${user_id} and role:${role}`);
	});

	socket.on('disconnect', () => {
		console.log('Socket disconnected', socket.id);
	});
});

httpServer.listen(PORT, () => console.log(`API + Socket running on ${PORT}`));
