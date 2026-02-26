const express = require("express");
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

router.post("/", async (req, res) => {
  try {
    const { message, sources, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!OPENROUTER_API_KEY) {
      return res
        .status(500)
        .json({ error: "OpenRouter API key not configured" });
    }

    const systemPrompt = `You are a Content LM assistant. You help users analyze their sources and create content.
You have access to the following sources:
${sources?.map((s) => `- ${s.name} (${s.type}): ${s.content || "File content not available"}`).join("\n") || "No sources uploaded yet"}

Be helpful and provide accurate information based on the sources provided.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Content LM",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenRouter API error:", errorData);
      return res
        .status(response.status)
        .json({ error: "Failed to get response from AI" });
    }

    const data = await response.json();
    const assistantMessage =
      data.choices?.[0]?.message?.content ||
      "Sorry, I could not generate a response.";

    return res.json({
      message: assistantMessage,
      sources: sources || [],
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
