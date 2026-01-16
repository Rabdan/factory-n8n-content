const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3060;

const logger = require('./utils/logger');

// Middleware and Upload Config
const dataDir = path.resolve(__dirname, '..', 'data');
const uploadDir = path.join(dataDir, 'uploads');
const logDir = path.join(dataDir, 'log');

// Ensure directories exist
[uploadDir, logDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

app.use('/uploads', express.static(uploadDir));

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Routes
const projectsRouter = require('./routes/projects');
const postsRouter = require('./routes/posts');
const authRouter = require('./routes/auth');

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/posts', postsRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// File Upload Endpoint
app.post('/api/upload', (req, res, next) => {
    console.log('Upload request received:', {
        headers: req.headers,
        method: req.method,
        url: req.url,
        contentType: req.get('Content-Type')
    });
    next();
}, upload.single('file'), async (req, res) => {
    console.log('After multer middleware:', {
        file: req.file ? {
            originalname: req.file.originalname,
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size
        } : null,
        body: req.body
    });

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const { project_id } = req.body;

    try {
        const result = await pool.query( // Using direct pool here or import db
            'INSERT INTO uploads (project_id, filename, filepath, file_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [project_id || null, req.file.originalname, req.file.filename, req.file.mimetype]
        );
        console.log('Upload successful:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
