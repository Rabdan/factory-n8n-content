const express = require("express");
const router = express.Router();
const db = require("../db");
const imageDownloader = require("../utils/imageDownloader");

// Get posts for a project
router.get("/", async (req, res) => {
  const { projectId, start, end } = req.query; // Filter by date range
  try {
    let query = `
            SELECT p.*, sn.name as social_network_name
            FROM posts p
            LEFT JOIN social_networks sn ON p.social_network_id = sn.id
            WHERE p.project_id = $1`;
    const params = [projectId];

    if (start && end) {
      query += " AND p.publish_at BETWEEN $2 AND $3";
      params.push(start, end);
    }

    query += " ORDER BY p.publish_at ASC";

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get single post
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `
            SELECT p.*, sn.name as social_network_name, sn.logo_url as social_network_logo
            FROM posts p
            LEFT JOIN social_networks sn ON p.social_network_id = sn.id
            WHERE p.id = $1
        `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Create post
router.post("/", async (req, res) => {
  const { project_id, social_network_id, publish_at, text_content, status } =
    req.body;
  try {
    const result = await db.query(
      "INSERT INTO posts (project_id, social_network_id, publish_at, text_content, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [
        project_id,
        social_network_id,
        publish_at,
        text_content,
        status || "draft",
      ],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update post
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    text_content,
    publish_at,
    status,
    media_files,
    tags,
    content_plan_id,
    social_network_id,
  } = req.body;

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
        id,
      ],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Generation for a single post (text, image, or all)
router.post("/:id/generate", async (req, res) => {
  const { id } = req.params;
  const { type } = req.body; // 'text', 'image', or 'all'

  try {
    // Fetch post and social network details
    const postResult = await db.query(
      `
        SELECT p.*, sn.generation_webhook_url, sn.name as network_name
        FROM posts p
        JOIN social_networks sn ON p.social_network_id = sn.id
        WHERE p.id = $1
      `,
      [id],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postResult.rows[0];

    if (!post.generation_webhook_url) {
      return res.status(400).json({
        error: "No generation webhook configured for this social network",
      });
    }

    // Prepare prompt (if needed, can be extended)
    const textprompt = post.text_content || "create a simple post";

    // Call webhook to generate content
    const webhookResponse = await fetch(post.generation_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: textprompt,
        network_name: post.network_name,
        publish_date: post.publish_at,
        type: type || "all",
        post_id: id,
        project_id: post.project_id,
      }),
    });

    if (!webhookResponse.ok) {
      throw new Error(
        `Webhook failed: ${webhookResponse.status} ${webhookResponse.statusText}`,
      );
    }

    const webhookResult = await webhookResponse.json();
    let updateFields = {};
    let mediaFiles = [];

    // Handle text, image, or all
    if (type === "all" || type === "text") {
      updateFields.text_content =
        webhookResult[0].caption ||
        webhookResult[0].text_content ||
        post.text_content;
      if (webhookResult[0].tags) {
        updateFields.tags = JSON.stringify(webhookResult[0].tags);
      }
    }

    if ((type === "all" || type === "image") && webhookResult[0].image_url) {
      const imageUrls = Array.isArray(webhookResult[0].image_url)
        ? webhookResult[0].image_url
        : [webhookResult[0].image_url];
      const path = require("path");
      const uploadDir = path.join(__dirname, "..", "data", "uploads");
      const downloadedFiles = await imageDownloader.downloadImages(
        imageUrls,
        uploadDir,
        post.network_name,
      );
      mediaFiles.push(...downloadedFiles);
      if (mediaFiles.length > 0) {
        updateFields.media_files = JSON.stringify(mediaFiles);
      }
    }

    // Always set status to 'generated'
    updateFields.status = "generated";

    // Build dynamic update query
    const setParts = [];
    const values = [];
    values.push(id);
    let idx = 2;
    for (const key in updateFields) {
      setParts.push(`${key} = $${idx}`);
      values.push(updateFields[key]);
      idx++;
    }
    console.log(values);
    console.log(setParts.join(", "));
    if (setParts.length > 0) {
      await db.query(
        `UPDATE posts SET ${setParts.join(", ")} WHERE id = $1 RETURNING *`,
        values,
      );
    }

    res.json({ message: "Generation completed", status: "generated" });
  } catch (err) {
    console.error("Generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
