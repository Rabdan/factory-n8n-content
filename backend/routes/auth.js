const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            logger.warn(`Failed login attempt for email: ${email} (User not found)`);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Allow plain text for legacy or bcrypt for new
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password_hash);
        } catch (e) {
            isMatch = user.password_hash === password;
        }

        if (isMatch) {
            const token = jwt.sign(
                { id: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: '5d' }
            );

            logger.info(`User logged in: ${email}`);
            res.json({
                success: true,
                token,
                user: { id: user.id, email: user.email }
            });
        } else {
            logger.warn(`Failed login attempt for email: ${email} (Wrong password)`);
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (err) {
        logger.error(`Login error for ${email}: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
