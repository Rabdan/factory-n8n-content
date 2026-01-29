const express = require("express");
const router = express.Router();
const db = require("../db");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const imageDownloader = require("../utils/imageDownloader");

// Get all projects for (mock) user
router.get("/", async (req, res) => {
  // In a real app, filter by req.user.id
  try {
    const result = await db.query(
      "SELECT * FROM projects ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create project
router.post("/", async (req, res) => {
  const { name, owner_id } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO projects (name, owner_id, settings) VALUES ($1, $2, $3) RETURNING *",
      [name, owner_id || 1, "{}"],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get project details
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const project = await db.query("SELECT * FROM projects WHERE id = $1", [
      id,
    ]);
    const socialNetworks = await db.query(
      "SELECT * FROM social_networks WHERE project_id = $1",
      [id],
    );
    if (project.rows.length === 0)
      return res.status(404).json({ error: "Project not found" });

    const members = await db.query(
      "SELECT u.id, u.email, pm.role FROM users u JOIN project_members pm ON u.id = pm.user_id WHERE pm.project_id = $1",
      [id],
    );

    res.json({
      ...project.rows[0],
      social_networks: socialNetworks.rows,
      members: members.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add social network
router.post("/:id/social-networks", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    logo_url,
    publishing_webhook_url,
    generation_webhook_url,
    default_publish_time,
    default_prompt,
  } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO social_networks (project_id, name, logo_url, publishing_webhook_url, generation_webhook_url, default_publish_time, default_prompt) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [
        id,
        name,
        logo_url,
        publishing_webhook_url,
        generation_webhook_url,
        default_publish_time,
        default_prompt,
      ],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update social network
router.put("/social-networks/:networkId", async (req, res) => {
  const { networkId } = req.params;
  const {
    name,
    logo_url,
    publishing_webhook_url,
    generation_webhook_url,
    default_publish_time,
    default_prompt,
  } = req.body;
  try {
    const result = await db.query(
      "UPDATE social_networks SET name = $1, logo_url = $2, publishing_webhook_url = $3, generation_webhook_url = $4, default_publish_time = $5, default_prompt = $6 WHERE id = $7 RETURNING *",
      [
        name,
        logo_url,
        publishing_webhook_url,
        generation_webhook_url,
        default_publish_time,
        default_prompt,
        networkId,
      ],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete social network
router.delete("/social-networks/:networkId", async (req, res) => {
  const { networkId } = req.params;
  try {
    await db.query("DELETE FROM social_networks WHERE id = $1", [networkId]);
    res.json({ message: "Social network deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Add member to project (with login and password)
 * Expects: { login, password, role }
 */
router.post("/:id/add-member", async (req, res) => {
  const { id: projectId } = req.params;
  const { login, password, role } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: "Login and password are required" });
  }
  try {
    // Check if user exists
    let userResult = await db.query("SELECT * FROM users WHERE email = $1", [
      login,
    ]);
    let userId;
    if (userResult.rows.length === 0) {
      // Create user with bcrypt hashed password
      const hashed = await bcrypt.hash(password, 10);
      userResult = await db.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [login, hashed],
      );
      userId = userResult.rows[0].id;
    } else {
      return res
        .status(400)
        .json({ error: "User with this login already exists" });
    }
    // Add to project_members
    await db.query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)",
      [projectId, userId, role || "member"],
    );
    res.json({ message: "Member added", user_id: userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Remove member from project
 * DELETE /:projectId/members/:userId
 */
router.delete("/:projectId/members/:userId", async (req, res) => {
  const { projectId, userId } = req.params;
  try {
    await db.query(
      "DELETE FROM project_members WHERE project_id = $1 AND user_id = $2",
      [projectId, userId],
    );
    res.json({ message: "Member removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Change password for current user
 * PATCH /users/:userId/password
 * Expects: { oldPassword, newPassword }
 */
router.patch("/users/:userId/password", async (req, res) => {
  const { userId } = req.params;
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Old and new password required" });
  }
  try {
    const userResult = await db.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId],
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const passwordHash = userResult.rows[0].password_hash;
    const isMatch = await bcrypt.compare(oldPassword, passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: "Old password is incorrect" });
    }
    const hashedNew = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      hashedNew,
      userId,
    ]);
    res.json({ message: "Password updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get content plans for a project
router.get("/:idproject/content-plans", async (req, res) => {
  const { idproject } = req.params;
  try {
    const result = await db.query(
      "SELECT * FROM content_plans WHERE project_id = $1 ORDER BY created_at DESC",
      [idproject],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create content plan
router.post("/:idproject/content-plans", async (req, res) => {
  const { idproject } = req.params;
  const { id, name, prompt, dates, platforms, color } = req.body;
  try {
    if (id == 0) {
      const result = await db.query(
        "INSERT INTO content_plans (project_id, name, prompt, dates, platforms, color) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          idproject,
          name,
          prompt,
          JSON.stringify(dates || []),
          JSON.stringify(platforms || []),
          color || "#3b82f6",
        ],
      );
      res.json(result.rows[0]);
    } else {
      if (dates.isEmpty) {
        await db.query("DELETE FROM content_plans WHERE id = $1", [id]);
        res.json({ id });
      } else {
        const result = await db.query(
          "UPDATE content_plans SET name = $2, prompt = $3, dates = $4, platforms = $5, color = $6 WHERE id = $1 RETURNING *",
          [
            id,
            name,
            prompt,
            JSON.stringify(dates || []),
            JSON.stringify(platforms || []),
            color || "#3b82f6",
          ],
        );
        res.json(result.rows[0]);
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate content for a plan
router.post("/content-plans/:planId/generate", async (req, res) => {
  const { planId } = req.params;
  try {
    // Get plan details
    const planResult = await db.query(
      "SELECT * FROM content_plans WHERE id = $1",
      [planId],
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }
    console.log(planResult.rows[0]);
    const plan = planResult.rows[0];
    const dates = plan.dates || [];
    const platforms = plan.platforms || [];
    const platformIds = platforms.map((p) => p.id);

    // Get social networks for platforms
    const networksResult = await db.query(
      "SELECT * FROM social_networks WHERE id = ANY($1) AND project_id = $2",
      [platformIds, plan.project_id],
    );

    const networks = networksResult.rows;

    if (networks.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid social networks found for this plan" });
    }

    console.log(
      `Starting generation for plan ${planId}: ${dates.length} dates x ${networks.length} networks`,
    );

    let totalGenerated = 0;

    // Generate content for each date and network combination
    for (const date of dates) {
      for (const network of networks) {
        if (network.generation_webhook_url) {
          // Check if post already exists for this date and network
          const existingPostResult = await db.query(
            `SELECT * FROM posts
            WHERE content_plan_id = $1
            AND social_network_id = $2
            AND DATE(publish_at) = $3
            AND status IN ('approved', 'published')`,
            [planId, network.id, date],
          );

          if (existingPostResult.rows.length > 0) {
            console.log(
              `Skipping generation for ${date} - ${network.name}: post already exists with approved/published status`,
            );
            continue;
          }

          // Delete posts without status ('approved', 'published')
          await db.query(
            `DELETE FROM posts
            WHERE content_plan_id = $1
            AND social_network_id = $2
            AND DATE(publish_at) = $3
            AND status NOT IN ('approved', 'published')`,
            [planId, network.id, date],
          );

          const publishTime =
            network.default_publish_time ||
            platformConfig?.publishTime ||
            "10:00:00";
          const publishAt = new Date(`${date}T${publishTime}`);

          const sheader = `[${network.name} Settings]`;
          const escapedHeader = sheader.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(
            `${escapedHeader}\\s*([\\s\\S]*?)(?=\\n\\[|$)`,
            "i",
          );
          const match = plan.prompt.match(regex);
          const textprompt = match ? match[1].trim() : "create a simple post";
          // Call webhook to generate content
          const webhookResponse = await fetch(network.generation_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: textprompt,
              network_name: network.name,
              publish_date: date,
            }),
          });

          if (!webhookResponse.ok) {
            throw new Error(
              `Webhook failed for ${network.name}: ${webhookResponse.status} ${webhookResponse.statusText}`,
            );
          }

          const webhookResult = await webhookResponse.json();
          console.log(`Webhook response for ${network.name}:`, webhookResult);

          let mediaFiles = [];

          // Download images from image_url(s) if provided
          if (webhookResult[0].image_url) {
            const imageUrls = Array.isArray(webhookResult[0].image_url)
              ? webhookResult[0].image_url
              : [webhookResult[0].image_url];
            const uploadDir = path.join(__dirname, "..", "data", "uploads");
            const downloadedFiles = await imageDownloader.downloadImages(
              imageUrls,
              uploadDir,
              network.name,
            );
            mediaFiles.push(...downloadedFiles);
            if (downloadedFiles.length > 0) {
              console.log(`Downloaded images: ${downloadedFiles.join(", ")}`);
            }
          }

          // Create new post
          const createResult = await db.query(
            `INSERT INTO posts (
                project_id,
                social_network_id,
                content_plan_id,
                publish_at,
                text_content,
                media_files,
                tags,
                status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'generated') RETURNING *`,
            [
              plan.project_id,
              network.id,
              planId,
              publishAt,
              webhookResult[0].caption ||
                webhookResult[0].text_content ||
                plan.prompt,
              mediaFiles.length > 0 ? JSON.stringify(mediaFiles) : null,
              webhookResult[0].tags
                ? JSON.stringify(webhookResult[0].tags)
                : null,
            ],
          );
          console.log(
            `Created new post for ${network.name}`,
            createResult.rows[0],
          );

          totalGenerated++;
        } else {
          console.log(`No webhook configured for ${network.name}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Generation completed for plan ${planId}`,
      generated_dates: dates.length,
      networks: networks.length,
      total_generated: totalGenerated,
    });
  } catch (err) {
    console.error("Generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
