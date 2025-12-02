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
// Prepare socket.io CORS origins. Accept comma-separated FRONTEND_URLs.
const rawFrontends = (process.env.FRONTEND_URL || '').toString();
const frontendList = rawFrontends.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/\/$/, ''));
let socketCors = { methods: ['GET', 'POST', 'PUT', 'PATCH'] };
if (String(process.env.ALLOW_ALL_ORIGINS || 'false').toLowerCase() === 'true') {
	socketCors.origin = '*';
} else if (frontendList.length === 1) {
	socketCors.origin = frontendList[0];
} else if (frontendList.length > 1) {
	socketCors.origin = frontendList;
} else {
	socketCors.origin = '*';
}

const io = require('socket.io')(httpServer, { cors: socketCors });

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
