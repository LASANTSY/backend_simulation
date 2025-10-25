import 'reflect-metadata';
import * as dotenv from 'dotenv';
import express from 'express';
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
// authMiddleware removed per request - application is public
import errorHandler from './middleware/error-handler';

dotenv.config();


async function bootstrap() {
  await AppDataSource.initialize();
  console.log('DataSource initialized');

  const app = express();
  app.use(express.json());
  app.use(morgan('dev'));

  // Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Public routes
  // context GET endpoints removed - contexts must be provided when creating simulations
  app.use('/api', predictionPublicRouter);

  app.use('/api', revenueRouter);
  // Note: no auth middleware applied - all routes are public
  app.use('/api', predictionRouter);
  app.use('/api', simulationRouter);
  app.use('/api', transactionRouter);
  app.use('/api', aiRouter);
  app.use('/api', optimizerRouter);

  // Error handler
  app.use(errorHandler as any);

  const port = parseInt(process.env.APP_PORT || '3000', 10);
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`Swagger docs at http://localhost:${port}/api/docs`);
  });
}

bootstrap().catch((err) => {
  console.error('Error during bootstrap', err);
  process.exit(1);
});
