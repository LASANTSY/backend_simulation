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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv = __importStar(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = __importDefault(require("./swagger"));
const data_source_1 = __importDefault(require("./data-source"));
const revenue_controller_1 = __importDefault(require("./revenue/revenue.controller"));
const prediction_controller_1 = __importDefault(require("./prediction/prediction.controller"));
const prediction_public_controller_1 = __importDefault(require("./prediction/prediction.public.controller"));
const simulation_controller_1 = __importDefault(require("./simulation/simulation.controller"));
const transaction_controller_1 = __importDefault(require("./integrations/transaction.controller"));
const optimizer_controller_1 = __importDefault(require("./optimization/optimizer.controller"));
const ai_controller_1 = __importDefault(require("./ai/ai.controller"));
const overpass_controller_1 = __importDefault(require("./integrations/overpass.controller"));
const place_controller_1 = __importDefault(require("./integrations/place.controller"));
const etl_1 = require("./etl");
const mlflow_controller_1 = __importDefault(require("./mlflow/mlflow.controller"));
const training_controller_1 = __importDefault(require("./training/training.controller"));
const backtest_controller_1 = __importDefault(require("./backtest/backtest.controller"));
const metrics_controller_1 = __importDefault(require("./monitoring/metrics.controller"));
const drift_controller_1 = __importDefault(require("./monitoring/drift.controller"));
const secrets_controller_1 = __importDefault(require("./secrets/secrets.controller"));
const data_labeling_controller_1 = __importDefault(require("./etl/data-labeling.controller"));
const revenue_validation_controller_1 = __importDefault(require("./revenue-validation/revenue-validation.controller"));
const queue_1 = require("./ai/queue");
const error_handler_1 = __importDefault(require("./middleware/error-handler"));
dotenv.config();
async function bootstrap() {
    await data_source_1.default.initialize();
    console.log('DataSource initialized');
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((0, morgan_1.default)('dev'));
    const allowedOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
        : ['*'];
    const corsOptions = {
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            console.log('CORS origin check - Allowed origins:', allowedOrigins);
            console.log('CORS origin check - Incoming origin:', origin);
            if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                console.error('CORS blocked origin:', origin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
        credentials: process.env.CORS_CREDENTIALS === 'true',
        optionsSuccessStatus: 204,
        preflightContinue: false,
    };
    app.use((0, cors_1.default)(corsOptions));
    app.use('/serviceprediction/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.default));
    app.use('/serviceprediction', prediction_public_controller_1.default);
    app.use('/serviceprediction', revenue_controller_1.default);
    app.use('/serviceprediction', prediction_controller_1.default);
    app.use('/serviceprediction', simulation_controller_1.default);
    app.use('/serviceprediction', transaction_controller_1.default);
    app.use('/serviceprediction', ai_controller_1.default);
    app.use('/serviceprediction', optimizer_controller_1.default);
    app.use('/serviceprediction', overpass_controller_1.default);
    app.use('/serviceprediction', place_controller_1.default);
    app.use('/serviceprediction', mlflow_controller_1.default);
    app.use('/serviceprediction', training_controller_1.default);
    app.use('/serviceprediction', backtest_controller_1.default);
    app.use('/', metrics_controller_1.default);
    app.use('/', drift_controller_1.default);
    app.use('/', secrets_controller_1.default);
    app.use('/serviceprediction', data_labeling_controller_1.default);
    app.use('/serviceprediction', revenue_validation_controller_1.default);
    app.use(error_handler_1.default);
    const port = parseInt(process.env.APP_PORT || '3000', 10);
    app.listen(port, () => {
        console.log(`Server listening on http://localhost:${port}`);
        console.log(`Swagger docs at http://localhost:${port}/serviceprediction/docs`);
        try {
            (0, etl_1.initEtlModule)();
            console.log('ETL module initialized');
        }
        catch (e) {
            console.warn('ETL module failed to initialize:', e.message);
        }
        (async () => {
            try {
                if (process.env.DISABLE_QUEUE === 'true') {
                    console.log('Queue initialization skipped (DISABLE_QUEUE=true)');
                }
                else {
                    const router = await (0, queue_1.initQueue)();
                    if (router)
                        app.use('/admin/queues', router);
                    console.log('BullMQ queue initialized and admin UI mounted at /admin/queues');
                }
            }
            catch (e) {
                console.warn('Failed to initialize queue or bull board:', e.message);
            }
        })();
    });
}
bootstrap().catch((err) => {
    console.error('Error during bootstrap', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map