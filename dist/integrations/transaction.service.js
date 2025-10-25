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
exports.TransactionService = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const BASE_URL = process.env.TSIRY_BASE_URL || process.env.BASE_URL || 'https://gateway.tsirylab.com';
const TIMEOUT = parseInt(process.env.TSIRY_TIMEOUT || '10000', 10);
class TransactionService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl || BASE_URL;
    }
    async fetchTransactions(municipalityId) {
        var _a;
        if (!municipalityId)
            throw new Error('municipalityId required');
        const url = `${this.baseUrl.replace(/\/$/, '')}/servicepaiement/transactions/${encodeURIComponent(municipalityId)}`;
        try {
            const resp = await axios_1.default.get(url, { timeout: TIMEOUT });
            if (resp && resp.data) {
                return resp.data;
            }
            throw new Error('Empty response from transactions provider');
        }
        catch (err) {
            const msg = ((_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.data) ? JSON.stringify(err.response.data) : (err === null || err === void 0 ? void 0 : err.message) || String(err);
            throw new Error(`Transactions fetch failed: ${msg}`);
        }
    }
}
exports.TransactionService = TransactionService;
exports.default = new TransactionService();
//# sourceMappingURL=transaction.service.js.map