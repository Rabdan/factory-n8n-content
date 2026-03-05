-- Create tables for Content Factory

-- Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- For simplicity, auth might be handled differently
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id INTEGER REFERENCES users(id),
    settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project Members
CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER REFERENCES projects(id),
    user_id INTEGER REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'member',
    PRIMARY KEY (project_id, user_id)
);

-- Project Invitations
CREATE TABLE IF NOT EXISTS project_invitations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Social Networks
CREATE TABLE IF NOT EXISTS social_networks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(255),
    publishing_webhook_url VARCHAR(255),
    generation_webhook_url VARCHAR(255),
    default_publish_time TIME,
    default_prompt TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content Plan (Themes/Prompts for specific dates)
CREATE TABLE IF NOT EXISTS content_plans (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    campaign_id INTEGER,
    title VARCHAR(255),
    platform VARCHAR(100),
    schedule_metadata JSONB DEFAULT '{}'::jsonb,
    document_markdown TEXT,
    name VARCHAR(255),
    social_network_id INTEGER REFERENCES social_networks(id), -- Keeping for compatibility
    dates JSONB DEFAULT '[]'::jsonb, -- Array of dates ["2026-01-12", "2026-01-15"]
    prompt TEXT,
    platforms JSONB DEFAULT '[]'::jsonb,
    color VARCHAR(7) DEFAULT '#3b82f6',
    is_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    social_network_id INTEGER REFERENCES social_networks(id),
    content_plan_id INTEGER REFERENCES content_plans(id),
    publish_at TIMESTAMP,
    text_content TEXT,
    media_files JSONB, -- Array of file paths or objects
    tags JSONB DEFAULT '[]'::jsonb, -- Array of strings
    status VARCHAR(50) DEFAULT 'draft', -- draft, generated, approved, published, rejected, failed
    n8n_task_id VARCHAR(100),
    created_at TIMESTAMP,
    publish_attempts INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- StrategyLM: top-level strategy docs
CREATE TABLE IF NOT EXISTS strategies (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    brand_voice TEXT,
    target_audience TEXT,
    core_values TEXT,
    document_markdown TEXT,
    raw_data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- StrategyLM: campaigns under strategies
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    goal TEXT,
    main_message TEXT,
    document_markdown TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_content_plans_campaign'
    ) THEN
        ALTER TABLE content_plans
            ADD CONSTRAINT fk_content_plans_campaign
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for faster search of posts to publish
CREATE INDEX IF NOT EXISTS idx_posts_publish_at_status
ON posts (publish_at, status)
WHERE status IN ('approved', 'published', 'failed');

-- Create index for faster search of posts by project
CREATE INDEX IF NOT EXISTS idx_posts_project_id
ON posts (project_id);

-- Files (RAG/Uploads)
CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE SET NULL,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- StrategyLM: external URLs for context/RAG per strategy/campaign
CREATE TABLE IF NOT EXISTS knowledge_urls (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE SET NULL,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- StrategyLM chat history by document branch (strategy/campaign/plan)
CREATE TABLE IF NOT EXISTS strategylm_chat_messages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    branch_type VARCHAR(20) NOT NULL, -- strategy | campaign | plan
    branch_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL, -- user | assistant
    content TEXT NOT NULL,
    changes_summary JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_strategies_project_id ON strategies(project_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_strategy_id ON campaigns(strategy_id);
CREATE INDEX IF NOT EXISTS idx_content_plans_campaign_id ON content_plans(campaign_id);
CREATE INDEX IF NOT EXISTS idx_uploads_strategy_campaign ON uploads(strategy_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_urls_strategy_campaign ON knowledge_urls(strategy_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_strategylm_chat_branch ON strategylm_chat_messages(project_id, branch_type, branch_id, created_at);

-- Seed Data
-- Seed Data
-- Passwords are 'Admin123!' (hash generated via bcryptjs with 8 rounds)
INSERT INTO users (email, password_hash)
VALUES
('admin', '$2b$10$rZ7vXlbhcaw2HFe4XrPvnuVUhy/HuwI5rCYozUQN97pSjm/ct0ZUu'),
('admin2', '$2b$10$rZ7vXlbhcaw2HFe4XrPvnuVUhy/HuwI5rCYozUQN97pSjm/ct0ZUu')
ON CONFLICT (email) DO NOTHING;

-- Since we can't reliably know the IDs if they already exist, we rely on 1 and 2 for a fresh DB
-- Otherwise in a real scenario we'd use subqueries or DO blocks
INSERT INTO projects (name, owner_id, settings)
VALUES
('NeuroVision', 1, '{}'),
('test My networks', 1, '{}')
ON CONFLICT DO NOTHING;

-- Add admin and admin2 to project members
INSERT INTO project_members (project_id, user_id, role)
VALUES
(1, 1, 'Owner'),
(2, 1, 'Owner'),
(1, 2, 'Owner'),
(2, 2, 'Owner')
ON CONFLICT DO NOTHING;

INSERT INTO social_networks (project_id, name, logo_url, default_publish_time)
VALUES
(1, 'Instagram', 'instagram-logo.png', '10:00:00'),
(1, 'Facebook', 'facebook-logo.png', '14:00:00'),
(2, 'Instagram', 'instagram-logo.png', '09:00:00'),
(2, 'Twitter', 'twitter-logo.png', '12:00:00'),
(2, 'Facebook', 'facebook-logo.png', '18:00:00');

-- StrategyLM initial seed (English)
INSERT INTO strategies (
    project_id,
    title,
    brand_voice,
    target_audience,
    core_values,
    raw_data_json
)
SELECT
    1,
    'NeuroVision Growth Strategy 2026',
    'Confident, practical, and insight-driven',
    'SMB founders and marketing managers in tech-enabled businesses',
    'Clarity, measurable impact, and continuous experimentation',
    '{"positioning":"AI-first content operations partner","priority_channels":["Instagram","Facebook"]}'::jsonb
WHERE NOT EXISTS (
    SELECT 1
    FROM strategies
    WHERE project_id = 1
      AND title = 'NeuroVision Growth Strategy 2026'
);

INSERT INTO campaigns (
    strategy_id,
    title,
    goal,
    main_message,
    start_date,
    end_date
)
SELECT
    s.id,
    'Spring Product Awareness Campaign',
    'Increase qualified inbound leads by 30% in Q2',
    'NeuroVision helps teams ship better content faster with reliable AI workflows',
    '2026-03-15',
    '2026-06-30'
FROM strategies s
WHERE s.project_id = 1
  AND s.title = 'NeuroVision Growth Strategy 2026'
  AND NOT EXISTS (
      SELECT 1
      FROM campaigns c
      WHERE c.strategy_id = s.id
        AND c.title = 'Spring Product Awareness Campaign'
  );

-- Posts for January 2026
INSERT INTO posts (project_id, social_network_id, publish_at, text_content, status)
VALUES
(1, 1, '2026-01-12 10:00:00', 'New Year, New Vision! Check out our latest AI tools.', 'published'),
(1, 2, '2026-01-13 14:00:00', 'How NeuroVision is changing content creation.', 'approved'),
(1, 1, '2026-01-14 10:00:00', 'Automate your social media with n8n.', 'generated'),
(1, 2, '2026-01-15 14:00:00', 'Case study: 300% growth with AI content.', 'draft'),
(1, 1, '2026-01-19 10:00:00', 'Creative prompts for 2026.', 'approved'),
(1, 2, '2026-01-20 14:00:00', 'The future of agentic coding.', 'generated'),
-- Posts for "test My networks" (Project ID 2)
(2, 3, '2026-01-21 09:00:00', 'Testing my new Instagram automation!', 'draft'),
(2, 4, '2026-01-22 12:00:00', 'Twitter (X) is still great for tech news.', 'approved'),
(2, 5, '2026-01-24 18:00:00', 'Weekend vibes on Facebook.', 'generated');
