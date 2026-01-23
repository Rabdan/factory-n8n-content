# Content Factory

Content Factory is a comprehensive social media content management system designed to streamline the creation, management, and publication of content across multiple platforms.

## Overview

This project provides a robust platform for teams to collaborate on content strategies, utilizing AI for content generation and providing a visual calendar for scheduling.

## Features

- **Multi-Project & Multi-User Support**: Manage multiple projects and invite team members via email.
- **Visual Content Calendar**: Weekly and monthly views to manage posts effectively.
- **AI Integration**:
    - Integration with n8n webhooks for text, image, and video generation.
    - Automated publishing via webhooks.
- **RAG Support**: Upload documents and images to build a knowledge base for content generation.
- **Social Media Management**: Configure settings for various social networks (logos, webhooks, schedules).
- **Analytics**: Built-in analytics dashboard.

## Tech Stack

- **Frontend**: Svelte 5 (with Shadcn-svelte Yellow Theme)
- **Backend**: Node.js
- **Database**: PostgreSQL
- **Workflow Automation**: n8n

## Project Structure

- `backend/`: Node.js API server.
- `svelte-dashboard/`: Svelte 5 frontend application.
- `data/`: Storage for PostgreSQL data and uploaded files (`uploads/`).
- `n8n-workflows/`: JSON exports of n8n workflows.

### Credentials (Default)

- **Email/Username**: `admin`
- **Password**: `Admin123!`

## getting Started

### Prerequisites

- Docker & Docker Compose

### Running the Application

1. Clone the repository.
2. Run the following command to start all services:

```bash
docker-compose up -d --build
```

3. Access the dashboard: http://localhost:5175
4. The API is available at: http://localhost:3000

## Features Detail

- **Dark Mode**: Toggle between light and dark themes in the sidebar.
- **Visual Calendar**: Switch between weekly and monthly views.
- **RAG Support**: Upload files for AI context.
- **Project Isolation**: Data is separated by projects.


## Configuration

Environment variables and default settings can be configured in the `docker-compose.yml` file and individual service configuration files.

## n8n Workflow Setup

To enable AI-powered social post generation, follow these steps:

1. **Import the Workflow**  
   In your n8n instance, import the workflow file located at:  
   `n8n-workflows/Generate Post Social.json`

2. **Set Your OpenRouter API Key**  
   The workflow requires an OpenRouter API key for AI model access.  
   - In n8n, go to *Credentials* and add your OpenRouter API key as required by the workflow.

3. **Configure Paid Models (Optional)**  
   If you want to use paid models, edit the workflow:
   - Open the imported workflow in n8n.
   - Locate the node named **Prepare** (with the prompt array).
   - Add the desired paid model names to the array as needed.

Be sure to save and activate the workflow after making these changes.
