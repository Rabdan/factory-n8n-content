const express = require("express");
const router = express.Router();
const db = require("../db");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

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
    default_publish_days,
    default_publish_time,
    default_prompt
  } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO social_networks (project_id, name, logo_url, publishing_webhook_url, generation_webhook_url, default_publish_days, default_publish_time, default_prompt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [id, name, logo_url, publishing_webhook_url, generation_webhook_url, default_publish_days, default_publish_time, default_prompt],
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
    default_publish_days,
    default_publish_time,
    default_prompt
  } = req.body;
  try {
    const result = await db.query(
      "UPDATE social_networks SET name = $1, logo_url = $2, publishing_webhook_url = $3, generation_webhook_url = $4, default_publish_days = $5, default_publish_time = $6, default_prompt = $7 WHERE id = $8 RETURNING *",
      [name, logo_url, publishing_webhook_url, generation_webhook_url, default_publish_days, default_publish_time, default_prompt, networkId],
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

// Invite user to project
router.post("/:id/invite", async (req, res) => {
  const { id: projectId } = req.params;
  const { email } = req.body;

  try {
    // Generate a unique token
    const token = crypto.randomBytes(20).toString("hex");
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7); // Token expires in 7 days

    // Store invitation in the database
    await db.query(
      "INSERT INTO project_invitations (project_id, email, token, expires_at) VALUES ($1, $2, $3, $4)",
      [projectId, email, token, expires_at],
    );

    // Send invitation email
    const transporter = nodemailer.createTransport({
      // TODO: Replace with actual SMTP server configuration
      host: process.env.SMTP_HOST || "smtp.ethereal.email",
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const acceptUrl = `${req.protocol}://${req.get("host")}/api/projects/accept-invitation?token=${token}`;

    await transporter.sendMail({
      from: '"Content Factory" <noreply@content-factory.com>',
      to: email,
      subject: "You have been invited to a project",
      html: `
                <p>You have been invited to join a project.</p>
                <p>Click <a href="${acceptUrl}">here</a> to accept the invitation.</p>
                <p>This link will expire in 7 days.</p>
            `,
    });

    res.json({ message: "Invitation sent successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept invitation
router.get("/accept-invitation", async (req, res) => {
  const { token } = req.query;

  try {
    // Find invitation by token
    const result = await db.query(
      "SELECT * FROM project_invitations WHERE token = $1",
      [token],
    );
    if (result.rows.length === 0) {
      return res.status(400).send("Invalid or expired invitation token.");
    }

    const invitation = result.rows[0];

    // Check if token is expired
    if (new Date(invitation.expires_at) < new Date()) {
      await db.query("DELETE FROM project_invitations WHERE token = $1", [
        token,
      ]);
      return res.status(400).send("Invitation token has expired.");
    }

    const { project_id, email } = invitation;

    // Find or create user
    let userResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    let userId;
    if (userResult.rows.length === 0) {
      // User does not exist, create a new one
      userResult = await db.query(
        "INSERT INTO users (email) VALUES ($1) RETURNING id",
        [email],
      );
      userId = userResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }

    // Add user to project_members
    await db.query(
      "INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [project_id, userId],
    );

    // Delete invitation
    await db.query("DELETE FROM project_invitations WHERE id = $1", [
      invitation.id,
    ]);

    // Redirect to the frontend project page (or a success page)
    // For now, just send a success message
    res.send("Invitation accepted! You have been added to the project.");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get content plans for a project
router.get("/:id/content-plans", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      "SELECT * FROM content_plans WHERE project_id = $1 ORDER BY start_date DESC",
      [id],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create content plan
router.post("/:id/content-plans", async (req, res) => {
  const { id } = req.params;
  const { name, prompt, start_date, end_date, platforms, color } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO content_plans (project_id, name, prompt, start_date, end_date, platforms, color) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [id, name, prompt, start_date, end_date, JSON.stringify(platforms || []), color || '#3b82f6'],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate content for a plan (mock)
router.post("/content-plans/:planId/generate", async (req, res) => {
  const { planId } = req.params;
  try {
    // Mock generation process
    await new Promise(r => setTimeout(r, 2000));

    await db.query(
      "UPDATE content_plans SET is_generated = TRUE WHERE id = $1",
      [planId]
    );

    // In a real app, this would trigger an n8n workflow or similar
    // For now, we'll just return success
    res.json({ success: true, message: "Generation started for plan " + planId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
