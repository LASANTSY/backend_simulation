import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Revenue } from './entities/Revenue';
import { Prediction } from './entities/Prediction';
import { Simulation } from './entities/Simulation';
import { AnalysisResult } from './entities/AnalysisResult';
import { Marketplace } from './integrations/marketplace.entity';

dotenv.config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USERNAME = process.env.DB_USERNAME || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'mobilisation_db';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_NAME,
  entities: [Revenue, Prediction, Simulation, AnalysisResult, Marketplace],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: false
});

export default AppDataSource;
