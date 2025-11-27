"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const dotenv = __importStar(require("dotenv"));
const Revenue_1 = require("./entities/Revenue");
const Prediction_1 = require("./entities/Prediction");
const Simulation_1 = require("./entities/Simulation");
const AnalysisResult_1 = require("./entities/AnalysisResult");
const LabeledDataset_1 = require("./entities/LabeledDataset");
const TrainedModel_1 = require("./entities/TrainedModel");
const BacktestResult_1 = require("./entities/BacktestResult");
const ProductionPrediction_1 = require("./entities/ProductionPrediction");
const DriftAlert_1 = require("./entities/DriftAlert");
const SecretAccess_1 = require("./entities/SecretAccess");
const RevenueValidation_1 = require("./entities/RevenueValidation");
const marketplace_entity_1 = require("./integrations/marketplace.entity");
const WeatherContext_1 = require("./entities/WeatherContext");
const EconomicIndicator_1 = require("./entities/EconomicIndicator");
const Demographic_1 = require("./entities/Demographic");
dotenv.config();
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USERNAME = process.env.DB_USERNAME || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'mobilisation_db';
const AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME,
    entities: [Revenue_1.Revenue, Prediction_1.Prediction, Simulation_1.Simulation, AnalysisResult_1.AnalysisResult, marketplace_entity_1.Marketplace, WeatherContext_1.WeatherContext, EconomicIndicator_1.EconomicIndicator, Demographic_1.Demographic, LabeledDataset_1.LabeledDataset, TrainedModel_1.TrainedModel, BacktestResult_1.BacktestResult, ProductionPrediction_1.ProductionPrediction, DriftAlert_1.DriftAlert, SecretAccess_1.SecretAccess, RevenueValidation_1.RevenueValidation],
    migrations: [__dirname + '/migrations/*.{ts,js}'],
    synchronize: false,
    logging: false
});
exports.default = AppDataSource;
//# sourceMappingURL=data-source.js.map