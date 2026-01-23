const cron = require("node-cron");
const axios = require("axios");
const db = require("../db");
const logger = require("./logger");

/**
 * Automatic Post Publishing System
 * Checks posts with 'approved' status and publish time <= current time
 */
class PostScheduler {
  constructor() {
    this.isRunning = false;
    this.task = null;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn("PostScheduler is already running");
      return;
    }

    // Run every minute
    this.task = cron.schedule(
      "* * * * *",
      async () => {
        await this.checkAndPublishPosts();
      },
      {
        scheduled: false,
      },
    );

    this.task.start();
    this.isRunning = true;
    logger.info("PostScheduler started - checking every minute");
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.isRunning = false;
    logger.info("PostScheduler stopped");
  }

  /**
   * Check and publish posts
   */
  async checkAndPublishPosts() {
    try {
      logger.info("--- Checking publication queue ---");

      // 1. Find posts with 'approved' status whose time has come
      const query = `
                SELECT p.*, sn.name as network_name, sn.publishing_webhook_url
                FROM posts p
                JOIN social_networks sn ON p.social_network_id = sn.id
                WHERE p.status = 'approved'
                AND p.publish_at <= NOW()
                AND sn.publishing_webhook_url IS NOT NULL
                ORDER BY p.publish_at ASC
            `;

      const result = await db.query(query);

      if (result.rows.length === 0) {
        logger.debug("No posts found for publication");
        return;
      }

      logger.info(`Found posts for publication: ${result.rows.length}`);

      // 2. Process each post
      for (const post of result.rows) {
        await this.publishPost(post);
      }
    } catch (err) {
      logger.error("Error checking publication schedule:", err);
    }
  }

  /**
   * Publish individual post
   */
  async publishPost(post) {
    try {
      logger.info(`Publishing post #${post.id} to ${post.network_name}`);

      // Prepare data for sending
      const publishData = {
        postId: post.id,
        networkName: post.network_name,
        textContent: post.text_content,
        mediaFiles: post.media_files,
        tags: post.tags,
        publishAt: post.publish_at,
        projectId: post.project_id,
        socialNetworkId: post.social_network_id,
      };

      // Send to n8n webhook
      const response = await axios.post(
        post.publishing_webhook_url,
        publishData,
        {
          timeout: 30000, // 30 seconds timeout
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Content-Factory/1.0",
          },
        },
      );

      // 3. If n8n responds successfully, update status
      if (response.status >= 200 && response.status < 300) {
        await this.updatePostStatus(post.id, "published");
        logger.info(
          `Post #${post.id} successfully published via n8n (status: ${response.status})`,
        );

        // Log n8n response if there is useful information
        if (response.data && Object.keys(response.data).length > 0) {
          logger.debug(`n8n response for post #${post.id}:`, response.data);
        }
      } else {
        throw new Error(`Invalid response status: ${response.status}`);
      }
    } catch (error) {
      logger.error(`Error publishing post #${post.id}:`, {
        error: error.message,
        network: post.network_name,
        webhook: post.publishing_webhook_url,
      });

      // Update status to 'failed' in case of error
      await this.updatePostStatus(post.id, "failed");

      // Can add retry logic here
      await this.handleFailedPost(post, error);
    }
  }

  /**
   * Update post status
   */
  async updatePostStatus(postId, status) {
    try {
      await db.query(
        "UPDATE posts SET status = $1, updated_at = NOW() WHERE id = $2",
        [status, postId],
      );
    } catch (err) {
      logger.error(`Error updating post status #${postId}:`, err);
    }
  }

  /**
   * Handle failed publication attempts
   */
  async handleFailedPost(post, error) {
    try {
      // Check number of previous attempts
      const attemptsResult = await db.query(
        "SELECT publish_attempts FROM posts WHERE id = $1",
        [post.id],
      );

      const currentAttempts = attemptsResult.rows[0]?.publish_attempts || 0;
      const maxAttempts = 3; // Maximum 3 attempts

      if (currentAttempts < maxAttempts) {
        // Increase attempt counter and schedule retry publication
        const retryDelay = Math.pow(2, currentAttempts) * 60; // Exponential delay: 2, 4, 8 minutes
        const retryAt = new Date(Date.now() + retryDelay * 60 * 1000);

        await db.query(
          `
                    UPDATE posts
                    SET status = 'approved',
                        publish_attempts = publish_attempts + 1,
                        publish_at = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `,
          [retryAt, post.id],
        );

        logger.info(
          `Post #${post.id} scheduled for retry publication in ${retryDelay} minutes (attempt ${currentAttempts + 1}/${maxAttempts})`,
        );
      } else {
        // If exceeded max attempts, leave status 'failed'
        await db.query(
          "UPDATE posts SET publish_attempts = publish_attempts + 1, updated_at = NOW() WHERE id = $1",
          [post.id],
        );

        logger.error(
          `Post #${post.id} could not be published after ${maxAttempts} attempts. Status: failed`,
        );
      }
    } catch (err) {
      logger.error(`Error handling failed post #${post.id}:`, err);
    }
  }

  /**
   * Manual check and publication (for testing)
   */
  async manualCheck() {
    logger.info("Manual publication queue check...");
    await this.checkAndPublishPosts();
  }

  /**
   * Get statistics
   */
  async getStats() {
    try {
      const result = await db.query(`
                SELECT
                    status,
                    COUNT(*) as count
                FROM posts
                WHERE publish_at <= NOW()
                GROUP BY status
                ORDER BY status
            `);

      return result.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {});
    } catch (err) {
      logger.error("Error getting statistics:", err);
      return {};
    }
  }
}

// Create and export instance
const postScheduler = new PostScheduler();

module.exports = postScheduler;
