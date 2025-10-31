"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueService = void 0;
const data_source_1 = __importDefault(require("../data-source"));
const Revenue_1 = require("../entities/Revenue");
class RevenueService {
    constructor() {
        this.repo = data_source_1.default.getRepository(Revenue_1.Revenue);
    }
    async findAll(municipalityId) {
        if (municipalityId) {
            return this.repo.find({ where: { municipalityId }, order: { date: 'ASC' } });
        }
        return this.repo.find({ order: { date: 'ASC' } });
    }
    async findOne(id) {
        return this.repo.findOneBy({ id });
    }
    async create(data) {
        const entity = this.repo.create(data);
        return this.repo.save(entity);
    }
    async update(id, data) {
        const existing = await this.repo.findOneBy({ id });
        if (!existing)
            return null;
        const merged = this.repo.create({ ...existing, ...data });
        return this.repo.save(merged);
    }
    async remove(id) {
        const res = await this.repo.delete(id);
        return res.affected !== undefined && res.affected > 0;
    }
}
exports.RevenueService = RevenueService;
//# sourceMappingURL=revenue.service.js.map