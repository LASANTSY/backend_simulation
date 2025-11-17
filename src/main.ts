import 'reflect-metadata';
import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger';
import AppDataSource from './data-source';
import revenueRouter from './revenue/revenue.controller';
import predictionRouter from './prediction/prediction.controller';
import predictionPublicRouter from './prediction/prediction.public.controller';
import simulationRouter from './simulation/simulation.controller';
import transactionRouter from './integrations/transaction.controller';
import optimizerRouter from './optimization/optimizer.controller';
import aiRouter from './ai/ai.controller';
import overpassRouter from './integrations/overpass.controller';
import placeRouter from './integrations/place.controller';
import { initEtlModule } from './etl';
import mlflowRouter from './mlflow/mlflow.controller';
import trainingRouter from './training/training.controller';
import backtestRouter from './backtest/backtest.controller';
import metricsRouter from './monitoring/metrics.controller';
import driftRouter from './monitoring/drift.controller';
import secretsRouter from './secrets/secrets.controller';
import dataLabelingRouter from './etl/data-labeling.controller';
import { initQueue } from './ai/queue';
// authMiddleware removed per request - application is public
import errorHandler from './middleware/error-handler';

dotenv.config();


async function bootstrap() {
  await AppDataSource.initialize();
  console.log('DataSource initialized');

  const app = express();
  app.use(express.json());
  app.use(morgan('dev'));

  // CORS
  // Configure via environment variables:
  //  - CORS_ORIGIN (comma-separated list) or default '*'
  //  - CORS_CREDENTIALS='true' to allow cookies/credentials
  const corsOptions = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  } as any;
  app.use(cors(corsOptions));

  // Swagger UI
  app.use('/serviceprediction/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Public routes
  // context GET endpoints removed - contexts must be provided when creating simulations
  app.use('/serviceprediction', predictionPublicRouter);

  app.use('/serviceprediction', revenueRouter);
  // Note: no auth middleware applied - all routes are public
  app.use('/serviceprediction', predictionRouter);
  app.use('/serviceprediction', simulationRouter);
  app.use('/serviceprediction', transactionRouter);
  app.use('/serviceprediction', aiRouter);
  app.use('/serviceprediction', optimizerRouter);
  app.use('/serviceprediction', overpassRouter);
  app.use('/serviceprediction', placeRouter);
  app.use('/serviceprediction', mlflowRouter);
  app.use('/serviceprediction', trainingRouter);
  app.use('/serviceprediction', backtestRouter);
  // Prometheus metrics endpoint (scraped by Prometheus)
  app.use('/', metricsRouter);
  app.use('/', driftRouter);
  app.use('/', secretsRouter);
  app.use('/serviceprediction', dataLabelingRouter);

  // Error handler
  app.use(errorHandler as any);

  const port = parseInt(process.env.APP_PORT || '3000', 10);
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`Swagger docs at http://localhost:${port}/serviceprediction/docs`);
    // initialize ETL module (schedules jobs) if enabled
    try {
      initEtlModule();
      console.log('ETL module initialized');
    } catch (e) {
      console.warn('ETL module failed to initialize:', (e as Error).message);
    }
    // initialize BullMQ queue and Bull Board (can be disabled with DISABLE_QUEUE=true)
    (async () => {
      try {
        if (process.env.DISABLE_QUEUE === 'true') {
          console.log('Queue initialization skipped (DISABLE_QUEUE=true)');
        } else {
          const router = await initQueue();
          if (router) app.use('/admin/queues', router);
          console.log('BullMQ queue initialized and admin UI mounted at /admin/queues');
        }
      } catch (e) {
        console.warn('Failed to initialize queue or bull board:', (e as Error).message);
      }
    })();
  });
}

bootstrap().catch((err) => {
  console.error('Error during bootstrap', err);
  process.exit(1);
});
