"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const optimizer_service_1 = __importDefault(require("./optimizer.service"));
const router = express_1.default.Router();
router.post('/simulations/:id/optimize', async (req, res) => {
    const id = req.params.id;
    try {
        const result = await optimizer_service_1.default.recommendTiming(id);
        res.json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=optimizer.controller.js.map