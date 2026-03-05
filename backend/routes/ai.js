const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
const fs = require("fs");
const path = require("path");

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function asInt(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeChanges(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (!value) return [];
  return [String(value)];
}

function tryParseAiPayload(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

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

async function getBranchContext(projectId, branchType, branchId) {
  if (branchType === "strategy") {
    const result = await db.query(
      `SELECT s.*, s.id AS branch_id
       FROM strategies s
       WHERE s.id = $1 AND s.project_id = $2`,
      [branchId, projectId],
    );

    if (!result.rows[0]) return null;
    return {
      tableName: "strategies",
      context: result.rows[0],
      strategyId: result.rows[0].id,
      campaignId: null,
      planId: null,
    };
  }

  if (branchType === "campaign") {
    const result = await db.query(
      `SELECT c.*, s.project_id, s.id AS strategy_id, c.id AS branch_id
       FROM campaigns c
       JOIN strategies s ON s.id = c.strategy_id
       WHERE c.id = $1 AND s.project_id = $2`,
      [branchId, projectId],
    );

    if (!result.rows[0]) return null;
    return {
      tableName: "campaigns",
      context: result.rows[0],
      strategyId: result.rows[0].strategy_id,
      campaignId: result.rows[0].id,
      planId: null,
    };
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

    if (!result.rows[0]) return null;
    return {
      tableName: "content_plans",
      context: result.rows[0],
      strategyId: result.rows[0].strategy_id,
      campaignId: result.rows[0].campaign_id,
      planId: result.rows[0].id,
    };
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

    if (!result.rows[0]) return null;
    return {
      tableName: "posts",
      context: result.rows[0],
      strategyId: result.rows[0].strategy_id || null,
      campaignId: result.rows[0].campaign_id || null,
      planId: result.rows[0].content_plan_id || null,
    };
  }

  return null;
}

async function getLinkedBranchDocuments(projectId, strategyId, campaignId) {
  const [files, urls] = await Promise.all([
    db.query(
      `SELECT id, filename, file_type, filepath, strategy_id, campaign_id
       FROM uploads
       WHERE project_id = $1
         AND (
           ($2::int IS NOT NULL AND campaign_id = $2)
           OR ($3::int IS NOT NULL AND strategy_id = $3)
         )
       ORDER BY uploaded_at DESC`,
      [projectId, campaignId, strategyId],
    ),
    db.query(
      `SELECT id, url, title, strategy_id, campaign_id
       FROM knowledge_urls
       WHERE project_id = $1
         AND (
           ($2::int IS NOT NULL AND campaign_id = $2)
           OR ($3::int IS NOT NULL AND strategy_id = $3)
         )
       ORDER BY created_at DESC`,
      [projectId, campaignId, strategyId],
    ),
  ]);

  return { fileDocs: files.rows, urlDocs: urls.rows };
}

async function getBranchHistory(projectId, branchType, branchId) {
  const result = await db.query(
    `SELECT id, role, content, changes_summary, created_at
     FROM strategylm_chat_messages
     WHERE project_id = $1
       AND branch_type = $2
       AND branch_id = $3
     ORDER BY created_at ASC, id ASC`,
    [projectId, branchType, branchId],
  );

  return result.rows;
}

async function saveChatMessage(
  projectId,
  branchType,
  branchId,
  role,
  content,
  changesSummary = [],
) {
  await db.query(
    `INSERT INTO strategylm_chat_messages
      (project_id, branch_type, branch_id, role, content, changes_summary)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      projectId,
      branchType,
      branchId,
      role,
      content,
      JSON.stringify(changesSummary || []),
    ],
  );
}

async function updateBranchDocument(tableName, branchId, updatedDocument) {
  if (tableName === "strategies") {
    const result = await db.query(
      `UPDATE strategies
       SET document_markdown = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [updatedDocument, branchId],
    );
    return result.rows[0] || null;
  }

  if (tableName === "campaigns") {
    const result = await db.query(
      `UPDATE campaigns
       SET document_markdown = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [updatedDocument, branchId],
    );
    return result.rows[0] || null;
  }

  if (tableName === "posts") {
    const result = await db.query(
      `UPDATE posts
       SET text_content = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [updatedDocument, branchId],
    );
    return result.rows[0] || null;
  }

  const result = await db.query(
    `UPDATE content_plans
     SET document_markdown = $1
     WHERE id = $2
     RETURNING *`,
    [updatedDocument, branchId],
  );
  return result.rows[0] || null;
}

function isTextLikeFile(filename, fileType) {
  const name = String(filename || "").toLowerCase();
  if (fileType && String(fileType).startsWith("text/")) return true;
  return (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".json") ||
    name.endsWith(".csv")
  );
}

function readFileSafe(filePath, maxBytes = 200 * 1024) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const content = fs.readFileSync(filePath, "utf8");
    return content.slice(0, maxBytes);
  } catch {
    return null;
  }
}

function enrichFilesWithContent(files) {
  const uploadDir = path.join(__dirname, "..", "data", "uploads");
  return (files || []).map((file) => {
    if (!isTextLikeFile(file.filename, file.file_type)) {
      return { ...file, content: null };
    }
    const fullPath = path.join(uploadDir, file.filepath);
    const content = readFileSafe(fullPath);
    return { ...file, content };
  });
}

function loadAiSkillsContext() {
  const skillsDir = path.join(__dirname, "..", "data", "aiskills");
  if (!fs.existsSync(skillsDir)) return "";
  try {
    const entries = fs.readdirSync(skillsDir);
    const chunks = [];
    for (const entry of entries) {
      const fullPath = path.join(skillsDir, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        const content = readFileSafe(fullPath, 50 * 1024);
        if (!content) continue;
        chunks.push(`### ${entry}\n${content}`);
      } catch {
        continue;
      }
    }
    if (chunks.length === 0) return "";
    return `\n\nAI Skills Context:\n${chunks.join("\n\n")}`;
  } catch {
    return "";
  }
}

router.post("/process", authenticateToken, async (req, res) => {
  const {
    project_id,
    branch_type,
    branch_id,
    document_markdown,
    message,
    attached_documents = { files: [], urls: [] },
  } = req.body;

  const projectId = asInt(project_id);
  const branchType = String(branch_type || "");
  const branchId = asInt(branch_id);

  if (
    !projectId ||
    !branchId ||
    !["strategy", "campaign", "plan", "post"].includes(branchType)
  ) {
    return res
      .status(400)
      .json({ error: "project_id, branch_type and branch_id are required" });
  }

  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  if (typeof document_markdown !== "string") {
    return res
      .status(400)
      .json({ error: "document_markdown is required as string" });
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

    const linkedDocs = await getLinkedBranchDocuments(
      projectId,
      branch.strategyId,
      branch.campaignId,
    );
    const attachedFiles = enrichFilesWithContent(
      attached_documents?.files || [],
    );
    const attachedUrls = attached_documents?.urls || [];
    const historyBefore = await getBranchHistory(
      projectId,
      branchType,
      branchId,
    );

    const userMessage = String(message).trim();
    await saveChatMessage(
      projectId,
      branchType,
      branchId,
      "user",
      userMessage,
      [],
    );

    const contextStack = {
      branch_type: branchType,
      branch_id: branchId,
      strategy_id: branch.strategyId,
      campaign_id: branch.campaignId,
      plan_id: branch.planId,
      branch_entity: branch.context,
      current_document: document_markdown,
      linked_branch_documents: {
        files: linkedDocs.fileDocs,
        urls: linkedDocs.urlDocs,
      },
      attached_documents: {
        files: attachedFiles,
        urls: attachedUrls,
      },
    };

    let assistantMessage = "Document updated.";
    let updatedDocument = document_markdown;
    let changesSummary = [];

    if (!OPENROUTER_API_KEY) {
      assistantMessage =
        "AI key is not configured. Document was kept unchanged.";
      changesSummary = [
        "No AI processing was executed because OPENROUTER_API_KEY is not configured.",
      ];
    } else {
      const systemPrompt = `You are StrategyLM.
Your task:
1) Refine the provided marketing document according to user request.
2) Keep structure clear and concise.
3) Return ONLY valid JSON with keys:
   - updated_document_markdown: string
   - assistant_message: string
   - changes_summary: string[]

Use context stack and attached docs, but focus on improving current document.${loadAiSkillsContext()}`;

      const chatMessages = [
        { role: "system", content: systemPrompt },
        ...historyBefore
          .slice(-10)
          .map((msg) => ({ role: msg.role, content: msg.content })),
        {
          role: "user",
          content: `USER REQUEST:\n${userMessage}\n\nCONTEXT STACK JSON:\n${JSON.stringify(contextStack, null, 2)}`,
        },
      ];

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "StrategyLM",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: chatMessages,
          max_tokens: 2200,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          error: "AI provider request failed",
          provider_error: errorData,
        });
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || "";
      const parsed = tryParseAiPayload(rawContent);

      if (parsed && typeof parsed.updated_document_markdown === "string") {
        updatedDocument = parsed.updated_document_markdown;
        assistantMessage = String(
          parsed.assistant_message || "Document updated successfully.",
        );
        changesSummary = normalizeChanges(parsed.changes_summary);
      } else {
        assistantMessage =
          rawContent || "Document updated with fallback response.";
        updatedDocument = `${document_markdown}\n\n## AI Revision Notes\n${assistantMessage}`;
        changesSummary = ["Applied AI revision notes to the document."];
      }
    }

    const updatedEntity = await updateBranchDocument(
      branch.tableName,
      branchId,
      updatedDocument,
    );
    await saveChatMessage(
      projectId,
      branchType,
      branchId,
      "assistant",
      assistantMessage,
      changesSummary,
    );

    const historyAfter = await getBranchHistory(
      projectId,
      branchType,
      branchId,
    );

    res.json({
      branch_type: branchType,
      branch_id: branchId,
      updated_document_markdown: updatedDocument,
      changes_summary: changesSummary,
      assistant_message: assistantMessage,
      updated_entity: updatedEntity,
      history: historyAfter,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
