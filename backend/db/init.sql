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
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
