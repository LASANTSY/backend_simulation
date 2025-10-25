"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EconomicIndicator = void 0;
const typeorm_1 = require("typeorm");
let EconomicIndicator = class EconomicIndicator {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EconomicIndicator.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EconomicIndicator.prototype, "indicator", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EconomicIndicator.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], EconomicIndicator.prototype, "data", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EconomicIndicator.prototype, "municipalityId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EconomicIndicator.prototype, "fetchedAt", void 0);
EconomicIndicator = __decorate([
    (0, typeorm_1.Entity)({ name: 'economic_indicator' })
], EconomicIndicator);
exports.EconomicIndicator = EconomicIndicator;
//# sourceMappingURL=EconomicIndicator.js.map