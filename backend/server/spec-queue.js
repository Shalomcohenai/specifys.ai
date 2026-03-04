const { logger } = require('./logger');
const specGenerationService = require('./spec-generation-service');

/**
 * Simple in-memory queue for spec generation jobs
 * Processes jobs with configurable concurrency
 */
class SpecQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 3; // Process 3 specs at once
    this.jobs = new Map(); // Track active jobs by specId
  }

  /**
   * Add a job to the queue
   * @param {string} specId - Spec ID
   * @param {string} overview - Overview content
   * @param {Array} answers - User answers
   * @returns {Object} Job object
   */
  async add(specId, overview, answers) {
    // Allow new job if existing one has finished (failed or completed) so retry / re-approve works
    if (this.jobs.has(specId)) {
      const existingJob = this.jobs.get(specId);
      if (existingJob.status === 'failed' || existingJob.status === 'completed') {
        this.jobs.delete(specId);
        logger.info({ specId, previousStatus: existingJob.status }, '[SpecQueue] Replacing finished job with new job');
      } else {
        logger.warn({ specId }, '[SpecQueue] Job already exists for specId, returning existing job');
        return existingJob;
      }
    }

    const job = {
      id: specId,
      overview,
      answers,
      status: 'pending',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      results: null,
      error: null
    };

    this.queue.push(job);
    this.jobs.set(specId, job);

    logger.info({ specId, queueLength: this.queue.length }, '[SpecQueue] Job added to queue');

    // Start processing if not already processing
    this.process();

    return job;
  }

  /**
   * Process jobs from the queue
   */
  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    logger.debug({ queueLength: this.queue.length }, '[SpecQueue] Starting job processing');

    // Process up to maxConcurrent jobs
    const jobsToProcess = this.queue.splice(0, this.maxConcurrent);

    await Promise.all(
      jobsToProcess.map(job => this.processJob(job))
    );

    this.processing = false;

    // Continue processing if queue not empty
    if (this.queue.length > 0) {
      setImmediate(() => this.process());
    }
  }

  /**
   * Process a single job
   * @param {Object} job - Job object
   */
  async processJob(job) {
    const { id: specId, overview, answers } = job;

    try {
      job.status = 'processing';
      job.startedAt = Date.now();

      logger.info({ specId }, '[SpecQueue] Processing job');

      const results = await specGenerationService.generateAllSpecs(
        specId,
        overview,
        answers
      );

      job.status = 'completed';
      job.completedAt = Date.now();
      job.results = results;

      const duration = job.completedAt - job.startedAt;
      logger.info({ specId, duration: `${duration}ms` }, '[SpecQueue] Job completed successfully');

    } catch (error) {
      job.status = 'failed';
      job.completedAt = Date.now();
      job.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };

      logger.error({ 
        specId, 
        error: {
          message: error.message,
          stack: error.stack
        }
      }, '[SpecQueue] Job failed');

    } finally {
      // Clean up job after 5 minutes
      setTimeout(() => {
        this.jobs.delete(specId);
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Get job status
   * @param {string} specId - Spec ID
   * @returns {Object|null} Job object or null
   */
  getJob(specId) {
    return this.jobs.get(specId) || null;
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      activeJobs: Array.from(this.jobs.values()).filter(j => j.status === 'processing').length,
      totalJobs: this.jobs.size
    };
  }
}

module.exports = new SpecQueue();




