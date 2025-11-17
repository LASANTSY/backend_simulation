import cron from 'node-cron';
import logger from './logger';
import PipelineService from './pipeline.service';

const schedule = process.env.CRON_SCHEDULE || process.env.ETL_CRON || '0 2 * * *'; // default daily at 02:00

export function initEtlModule() {
  logger.info('Initializing ETL module with schedule: %s', schedule);

  // schedule the job
  const task = cron.schedule(schedule, async () => {
    logger.info('Scheduled ETL job starting');
    try {
      await PipelineService.runOnce();
      logger.info('Scheduled ETL job finished');
    } catch (e) {
      logger.error('Scheduled ETL job failed: %s', (e as Error).message);
    }
  });

  // start immediately if configured
  if (process.env.ETL_RUN_ON_START === 'true') {
    (async () => {
      try {
        await PipelineService.runOnce();
      } catch (e) {
        logger.error('Initial ETL run failed: %s', (e as Error).message);
      }
    })();
  }

  return { task };
}

export default { initEtlModule };
