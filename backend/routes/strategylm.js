const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");

async function ensureProjectAccess(userId, projectId) {
  const access = await db.query(
    `SELECT p.id
     FROM projects p
     LEFT JOIN project_members pm ON p.id = pm.project_id
     WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)
     LIMIT 1`,
    [projectId, userId],
  );
  return access.rows.length > 0;
}

function asInt(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function getBranchContext(projectId, branchType, branchId) {
  if (branchType === "strategy") {
    const result = await db.query(
      `SELECT s.*, s.id AS branch_id
       FROM strategies s
       WHERE s.id = $1 AND s.project_id = $2`,
      [branchId, projectId],
    );
    return result.rows[0] || null;
  }

  if (branchType === "campaign") {
    const result = await db.query(
      `SELECT c.*, s.project_id, s.id AS strategy_id, c.id AS branch_id
       FROM campaigns c
       JOIN strategies s ON s.id = c.strategy_id
       WHERE c.id = $1 AND s.project_id = $2`,
      [branchId, projectId],
    );
    return result.rows[0] || null;
  }

  if (branchType === "plan") {
    const result = await db.query(
      `SELECT cp.*, s.project_id, c.id AS campaign_id, s.id AS strategy_id, cp.id AS branch_id
       FROM content_plans cp
       JOIN campaigns c ON c.id = cp.campaign_id
       JOIN strategies s ON s.id = c.strategy_id
       WHERE cp.id = $1 AND s.project_id = $2`,
      [branchId, projectId],
    );
    return result.rows[0] || null;
  }

  if (branchType === "post") {
    const result = await db.query(
      `SELECT p.*, s.project_id, c.id AS campaign_id, s.id AS strategy_id, p.id AS branch_id
       FROM posts p
       LEFT JOIN content_plans cp ON cp.id = p.content_plan_id
       LEFT JOIN campaigns c ON c.id = cp.campaign_id
       LEFT JOIN strategies s ON s.id = c.strategy_id
       WHERE p.id = $1 AND p.project_id = $2`,
      [branchId, projectId],
    );
    return result.rows[0] || null;
  }

  return null;
}

router.use(authenticateToken);

router.get("/tree", async (req, res) => {
  const projectId = asInt(req.query.projectId);
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }

  try {
    const hasAccess = await ensureProjectAccess(req.user.id, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const [strategies, campaigns, plans] = await Promise.all([
      db.query(
        `SELECT * FROM strategies
         WHERE project_id = $1
         ORDER BY updated_at DESC, created_at DESC`,
        [projectId],
      ),
      db.query(
        `SELECT c.*, s.project_id
         FROM campaigns c
         JOIN strategies s ON s.id = c.strategy_id
         WHERE s.project_id = $1
         ORDER BY c.created_at DESC`,
        [projectId],
      ),
      db.query(
        `SELECT cp.*, s.project_id
         FROM content_plans cp
         JOIN campaigns c ON c.id = cp.campaign_id
         JOIN strategies s ON s.id = c.strategy_id
         WHERE s.project_id = $1
         ORDER BY cp.created_at DESC`,
        [projectId],
      ),
    ]);

    const planIds = plans.rows.map((plan) => plan.id);
    const posts = planIds.length
      ? await db.query(
          `SELECT id, project_id, content_plan_id, text_content, status, publish_at
           FROM posts
           WHERE project_id = $1 AND content_plan_id = ANY($2::int[])
           ORDER BY created_at DESC`,
          [projectId, planIds],
        )
      : { rows: [] };

    res.json({
      strategies: strategies.rows,
      campaigns: campaigns.rows,
      plans: plans.rows,
      posts: posts.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Strategies
router.get("/strategies", async (req, res) => {
  const projectId = asInt(req.query.projectId);
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }

  try {
    const hasAccess = await ensureProjectAccess(req.user.id, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const result = await db.query(
      `SELECT * FROM strategies
       WHERE project_id = $1
       ORDER BY updated_at DESC, created_at DESC`,
      [projectId],
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/strategies", async (req, res) => {
  const {
    project_id,
    title,
    brand_voice,
    target_audience,
    core_values,
    document_markdown,
    raw_data_json,
  } = req.body;
  const projectId = asInt(project_id);

  if (!projectId || !title || !String(title).trim()) {
    return res.status(400).json({ error: "project_id and title are required" });
  }

  try {
    const hasAccess = await ensureProjectAccess(req.user.id, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const result = await db.query(
      `INSERT INTO strategies (
        project_id, title, brand_voice, target_audience, core_values, document_markdown, raw_data_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        projectId,
        String(title).trim(),
        brand_voice || null,
        target_audience || null,
        core_values || null,
        document_markdown || null,
        raw_data_json || {},
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/strategies/:id", async (req, res) => {
  const id = asInt(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid strategy id" });
  }

  try {
    const current = await db.query("SELECT * FROM strategies WHERE id = $1", [
      id,
    ]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    const hasAccess = await ensureProjectAccess(
      req.user.id,
      current.rows[0].project_id,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const result = await db.query(
      `UPDATE strategies
       SET title = COALESCE($1, title),
           brand_voice = COALESCE($2, brand_voice),
           target_audience = COALESCE($3, target_audience),
           core_values = COALESCE($4, core_values),
           document_markdown = COALESCE($5, document_markdown),
           raw_data_json = COALESCE($6, raw_data_json),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        req.body.title ? String(req.body.title).trim() : null,
        req.body.brand_voice ?? null,
        req.body.target_audience ?? null,
        req.body.core_values ?? null,
        req.body.document_markdown ?? null,
        req.body.raw_data_json ?? null,
        id,
      ],
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Campaigns
router.get("/campaigns", async (req, res) => {
  const strategyId = asInt(req.query.strategyId);
  if (!strategyId) {
    return res.status(400).json({ error: "strategyId is required" });
  }

  try {
    const strategy = await db.query("SELECT * FROM strategies WHERE id = $1", [
      strategyId,
    ]);
    if (strategy.rows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    const hasAccess = await ensureProjectAccess(
      req.user.id,
      strategy.rows[0].project_id,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const result = await db.query(
      `SELECT * FROM campaigns WHERE strategy_id = $1 ORDER BY created_at DESC`,
      [strategyId],
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/campaigns", async (req, res) => {
  const {
    strategy_id,
    title,
    goal,
    main_message,
    document_markdown,
    start_date,
    end_date,
  } = req.body;
  const strategyId = asInt(strategy_id);

  if (!strategyId || !title || !String(title).trim()) {
    return res
      .status(400)
      .json({ error: "strategy_id and title are required" });
  }

  try {
    const strategy = await db.query("SELECT * FROM strategies WHERE id = $1", [
      strategyId,
    ]);
    if (strategy.rows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    const hasAccess = await ensureProjectAccess(
      req.user.id,
      strategy.rows[0].project_id,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const result = await db.query(
      `INSERT INTO campaigns (
        strategy_id, title, goal, main_message, document_markdown, start_date, end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        strategyId,
        String(title).trim(),
        goal || null,
        main_message || null,
        document_markdown || null,
        start_date || null,
        end_date || null,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/campaigns/:id", async (req, res) => {
  const id = asInt(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid campaign id" });
  }

  try {
    const current = await db.query(
      `SELECT c.*, s.project_id
       FROM campaigns c
       JOIN strategies s ON s.id = c.strategy_id
       WHERE c.id = $1`,
      [id],
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const hasAccess = await ensureProjectAccess(
      req.user.id,
      current.rows[0].project_id,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const result = await db.query(
      `UPDATE campaigns
       SET title = COALESCE($1, title),
           goal = COALESCE($2, goal),
           main_message = COALESCE($3, main_message),
           document_markdown = COALESCE($4, document_markdown),
           start_date = COALESCE($5, start_date),
           end_date = COALESCE($6, end_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        req.body.title ? String(req.body.title).trim() : null,
        req.body.goal ?? null,
        req.body.main_message ?? null,
        req.body.document_markdown ?? null,
        req.body.start_date ?? null,
        req.body.end_date ?? null,
        id,
      ],
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  const id = asInt(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid campaign id" });
  }

  try {
    const current = await db.query(
      `SELECT c.*, s.project_id
       FROM campaigns c
       JOIN strategies s ON s.id = c.strategy_id
       WHERE c.id = $1`,
      [id],
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const hasAccess = await ensureProjectAccess(
      req.user.id,
      current.rows[0].project_id,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const plansCount = await db.query(
      `SELECT COUNT(*) AS count FROM content_plans WHERE campaign_id = $1`,
      [id],
    );

    if (Number(plansCount.rows[0].count) > 0) {
      return res.status(400).json({
        error: "Campaign has content plans. Delete them first.",
      });
    }

    const result = await db.query(
      `DELETE FROM campaigns WHERE id = $1 RETURNING *`,
      [id],
    );

    res.json({ message: "Campaign deleted", campaign: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Content plans (StrategyLM branch)
router.get("/plans", async (req, res) => {
  const campaignId = asInt(req.query.campaignId);
  if (!campaignId) {
    return res.status(400).json({ error: "campaignId is required" });
  }

  try {
    const campaign = await db.query(
      `SELECT c.*, s.project_id
       FROM campaigns c
       JOIN strategies s ON s.id = c.strategy_id
       WHERE c.id = $1`,
      [campaignId],
    );

    if (campaign.rows.length === 0) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const hasAccess = await ensureProjectAccess(
      req.user.id,
      campaign.rows[0].project_id,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const result = await db.query(
      `SELECT * FROM content_plans
       WHERE campaign_id = $1
       ORDER BY created_at DESC`,
      [campaignId],
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/plans", async (req, res) => {
  const { campaign_id, title, platform, schedule_metadata, document_markdown } =
    req.body;
  const campaignId = asInt(campaign_id);

  if (!campaignId || !title || !String(title).trim()) {
    return res
      .status(400)
      .json({ error: "campaign_id and title are required" });
  }

  try {
    const campaign = await db.query(
      `SELECT c.*, s.project_id
       FROM campaigns c
       JOIN strategies s ON s.id = c.strategy_id
       WHERE c.id = $1`,
      [campaignId],
    );

    if (campaign.rows.length === 0) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const hasAccess = await ensureProjectAccess(
      req.user.id,
      campaign.rows[0].project_id,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const result = await db.query(
      `INSERT INTO content_plans (project_id, campaign_id, title, platform, schedule_metadata, document_markdown, name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        campaign.rows[0].project_id,
        campaignId,
        String(title).trim(),
        platform || null,
        schedule_metadata || {},
        document_markdown || null,
        String(title).trim(),
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/plans/:id", async (req, res) => {
  const id = asInt(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid plan id" });
  }

  try {
    const current = await db.query(
      `SELECT cp.*, s.project_id
       FROM content_plans cp
       JOIN campaigns c ON c.id = cp.campaign_id
       JOIN strategies s ON s.id = c.strategy_id
       WHERE cp.id = $1`,
      [id],
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const hasAccess = await ensureProjectAccess(
      req.user.id,
      current.rows[0].project_id,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const title = req.body.title ? String(req.body.title).trim() : null;
    const result = await db.query(
      `UPDATE content_plans
       SET title = COALESCE($1, title),
           platform = COALESCE($2, platform),
           schedule_metadata = COALESCE($3, schedule_metadata),
           document_markdown = COALESCE($4, document_markdown),
           name = COALESCE($5, name)
       WHERE id = $6
       RETURNING *`,
      [
        title,
        req.body.platform ?? null,
        req.body.schedule_metadata ?? null,
        req.body.document_markdown ?? null,
        title,
        id,
      ],
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Knowledge base
router.get("/sources", async (req, res) => {
  const projectId = asInt(req.query.projectId);
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }

  try {
    const hasAccess = await ensureProjectAccess(req.user.id, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const [files, urls] = await Promise.all([
      db.query(
        `SELECT * FROM uploads WHERE project_id = $1 ORDER BY uploaded_at DESC`,
        [projectId],
      ),
      db.query(
        `SELECT * FROM knowledge_urls WHERE project_id = $1 ORDER BY created_at DESC`,
        [projectId],
      ),
    ]);

    res.json({ files: files.rows, urls: urls.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/sources/files/:id", async (req, res) => {
  const id = asInt(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid file id" });
  }

  try {
    const existing = await db.query("SELECT * FROM uploads WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const hasAccess = await ensureProjectAccess(
      req.user.id,
      existing.rows[0].project_id,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const strategyId =
      req.body.strategy_id === null ? null : asInt(req.body.strategy_id);
    const campaignId =
      req.body.campaign_id === null ? null : asInt(req.body.campaign_id);

    const result = await db.query(
      `UPDATE uploads
       SET strategy_id = $1,
           campaign_id = $2
       WHERE id = $3
       RETURNING *`,
      [strategyId, campaignId, id],
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/knowledge-urls", async (req, res) => {
  const { project_id, strategy_id, campaign_id, url, title } = req.body;
  const projectId = asInt(project_id);

  if (!projectId || !url || !String(url).trim()) {
    return res.status(400).json({ error: "project_id and url are required" });
  }

  try {
    const hasAccess = await ensureProjectAccess(req.user.id, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const strategyId =
      strategy_id === null || strategy_id === undefined
        ? null
        : asInt(strategy_id);
    const campaignId =
      campaign_id === null || campaign_id === undefined
        ? null
        : asInt(campaign_id);

    const result = await db.query(
      `INSERT INTO knowledge_urls (project_id, strategy_id, campaign_id, url, title)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, strategyId, campaignId, String(url).trim(), title || null],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/knowledge-urls/:id", async (req, res) => {
  const id = asInt(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid URL id" });
  }

  try {
    const existing = await db.query(
      "SELECT * FROM knowledge_urls WHERE id = $1",
      [id],
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "URL not found" });
    }

    const hasAccess = await ensureProjectAccess(
      req.user.id,
      existing.rows[0].project_id,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const strategyId =
      req.body.strategy_id === null
        ? null
        : asInt(req.body.strategy_id ?? existing.rows[0].strategy_id);
    const campaignId =
      req.body.campaign_id === null
        ? null
        : asInt(req.body.campaign_id ?? existing.rows[0].campaign_id);

    const result = await db.query(
      `UPDATE knowledge_urls
       SET url = COALESCE($1, url),
           title = COALESCE($2, title),
           strategy_id = $3,
           campaign_id = $4
       WHERE id = $5
       RETURNING *`,
      [
        req.body.url ? String(req.body.url).trim() : null,
        req.body.title ?? null,
        strategyId,
        campaignId,
        id,
      ],
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/chat-history", async (req, res) => {
  const projectId = asInt(req.query.projectId);
  const branchType = String(req.query.branchType || "");
  const branchId = asInt(req.query.branchId);

  if (
    !projectId ||
    !branchId ||
    !["strategy", "campaign", "plan", "post"].includes(branchType)
  ) {
    return res
      .status(400)
      .json({ error: "projectId, branchType and branchId are required" });
  }

  try {
    const hasAccess = await ensureProjectAccess(req.user.id, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const branch = await getBranchContext(projectId, branchType, branchId);
    if (!branch) {
      return res.status(404).json({ error: "Branch document not found" });
    }

    const result = await db.query(
      `SELECT id, role, content, changes_summary, created_at
       FROM strategylm_chat_messages
       WHERE project_id = $1
         AND branch_type = $2
         AND branch_id = $3
       ORDER BY created_at ASC, id ASC`,
      [projectId, branchType, branchId],
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
