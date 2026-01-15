const express = require('express');
const router = express.Router();
const db = require('../db');

// Get posts for a project
router.get('/', async (req, res) => {
    const { projectId, start, end } = req.query; // Filter by date range
    try {
        let query = `
            SELECT p.*, sn.name as social_network_name 
            FROM posts p 
            LEFT JOIN social_networks sn ON p.social_network_id = sn.id 
            WHERE p.project_id = $1`;
        const params = [projectId];

        if (start && end) {
            query += ' AND p.publish_at BETWEEN $2 AND $3';
            params.push(start, end);
        }

        query += ' ORDER BY p.publish_at ASC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get single post
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(`
            SELECT p.*, sn.name as social_network_name, sn.logo_url as social_network_logo
            FROM posts p
            LEFT JOIN social_networks sn ON p.social_network_id = sn.id
            WHERE p.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Create post
router.post('/', async (req, res) => {
    const { project_id, social_network_id, publish_at, text_content, status } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO posts (project_id, social_network_id, publish_at, text_content, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [project_id, social_network_id, publish_at, text_content, status || 'draft']
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update post
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { text_content, publish_at, status, media_files, tags, content_plan_id, social_network_id } = req.body;

    // Build dynamic update query
    try {
        const result = await db.query(
            `UPDATE posts SET 
            text_content = COALESCE($1, text_content),
            publish_at = COALESCE($2, publish_at),
            status = COALESCE($3, status),
            media_files = COALESCE($4, media_files),
            tags = COALESCE($5, tags),
            content_plan_id = COALESCE($6, content_plan_id),
            social_network_id = COALESCE($7, social_network_id)
           WHERE id = $8 RETURNING *`,
            [
                text_content,
                publish_at,
                status,
                media_files ? JSON.stringify(media_files) : null,
                tags ? JSON.stringify(tags) : null,
                content_plan_id,
                social_network_id,
                id
            ]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Trigger Generation (Call n8n webhook)
router.post('/:id/generate', async (req, res) => {
    const { id } = req.params;
    const { type } = req.body; // 'text', 'image', or 'all'

    try {
        // Fetch post and social network details
        const postResult = await db.query(`
            SELECT p.*, sn.generation_webhook_url 
            FROM posts p
            JOIN social_networks sn ON p.social_network_id = sn.id
            WHERE p.id = $1
        `, [id]);

        if (postResult.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const post = postResult.rows[0];

        if (!post.generation_webhook_url) {
            return res.status(400).json({ error: 'No generation webhook configured for this social network' });
        }

        // Call n8n webhook (Async, don't wait for completion if it takes long)
        // In a real scenario, n8n would then call back to our API to update the post
        try {
            fetch(post.generation_webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_id: id,
                    type: type || 'all',
                    current_text: post.text_content,
                    project_id: post.project_id
                })
            }).catch(err => console.error('Error calling n8n:', err.message));
        } catch (e) {
            console.error('Fetch failed:', e);
        }

        // Update post status to 'generating'
        await db.query('UPDATE posts SET status = $1 WHERE id = $2', ['generated', id]);

        res.json({ message: "Generation triggered", status: "generated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
