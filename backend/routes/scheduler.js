const express = require('express');
const router = express.Router();
const postScheduler = require('../utils/postScheduler');
const db = require('../db');

/**
 * Get post statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await postScheduler.getStats();
        res.json({
            success: true,
            data: stats,
            scheduler: {
                isRunning: postScheduler.isRunning
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Manual check and publication of posts
 */
router.post('/check', async (req, res) => {
    try {
        await postScheduler.manualCheck();
        res.json({
            success: true,
            message: 'Manual check completed'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Start scheduler
 */
router.post('/start', async (req, res) => {
    try {
        postScheduler.start();
        res.json({
            success: true,
            message: 'Scheduler started'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Stop scheduler
 */
router.post('/stop', async (req, res) => {
    try {
        postScheduler.stop();
        res.json({
            success: true,
            message: 'Scheduler stopped'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get list of posts in publication queue
 */
router.get('/queue', async (req, res) => {
    try {
        const query = `
            SELECT p.*, sn.name as network_name, pr.name as project_name
            FROM posts p
            JOIN social_networks sn ON p.social_network_id = sn.id
            JOIN projects pr ON p.project_id = pr.id
            WHERE p.status = 'approved' 
            AND p.publish_at > NOW()
            ORDER BY p.publish_at ASC
            LIMIT 50
        `;

        const result = await db.query(query);
        res.json({
            success: true,
            data: result.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get publication history
 */
router.get('/history', async (req, res) => {
    try {
        const { limit = 20, offset = 0, status } = req.query;
        
        let whereClause = 'WHERE p.publish_at <= NOW()';
        const params = [];
        
        if (status) {
            whereClause += ' AND p.status = $' + (params.length + 1);
            params.push(status);
        }

        const query = `
            SELECT p.*, sn.name as network_name, pr.name as project_name
            FROM posts p
            JOIN social_networks sn ON p.social_network_id = sn.id
            JOIN projects pr ON p.project_id = pr.id
            ${whereClause}
            ORDER BY p.publish_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        params.push(limit, offset);
        
        const result = await db.query(query);
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM posts p
            ${whereClause}
        `;
        const countResult = await db.query(countQuery, params.slice(0, -2));
        
        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Retry publication of failed post
 */
router.post('/retry/:postId', async (req, res) => {
    try {
        const { postId } = req.params;
        
        // Check post existence
        const postResult = await db.query(
            'SELECT * FROM posts WHERE id = $1',
            [postId]
        );
        
        if (postResult.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const post = postResult.rows[0];
        
        if (post.status !== 'failed') {
            return res.status(400).json({ 
                error: 'Can only republish posts with failed status' 
            });
        }
        
        // Reset status and schedule immediate publication
        await db.query(`
            UPDATE posts 
            SET status = 'approved', 
                publish_attempts = 0,
                publish_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [postId]);
        
        res.json({
            success: true,
            message: 'Post scheduled for retry publication'
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;