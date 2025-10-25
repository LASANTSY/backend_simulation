"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const transaction_service_1 = __importDefault(require("./transaction.service"));
const router = express_1.default.Router();
router.get('/external/transactions/:municipalityId', async (req, res) => {
    const municipalityId = req.params.municipalityId;
    if (!municipalityId)
        return res.status(400).json({ message: 'municipalityId is required' });
    try {
        const result = await transaction_service_1.default.fetchTransactions(municipalityId);
        res.json(result);
    }
    catch (err) {
        console.error('Transactions fetch error', err);
        res.status(502).json({ message: 'Failed to fetch transactions', error: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=transaction.controller.js.map