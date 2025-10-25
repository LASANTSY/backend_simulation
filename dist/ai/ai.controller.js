"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ai_service_1 = __importDefault(require("./ai.service"));
const router = express_1.default.Router();
router.post('/analysis-results/:id/enrich', async (req, res) => {
    const id = req.params.id;
    const extraContext = req.body || {};
    try {
        const parsed = await ai_service_1.default.enrichAnalysis(id, extraContext);
        res.json({ ok: true, parsed });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=ai.controller.js.map