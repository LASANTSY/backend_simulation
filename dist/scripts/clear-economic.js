"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const data_source_1 = __importDefault(require("../src/data-source"));
(async () => {
    try {
        await data_source_1.default.initialize();
        const repo = data_source_1.default.getRepository('EconomicIndicator');
        console.log('Connected. Deleting EconomicIndicator entries for MDG/MG...');
        const res = await repo.createQueryBuilder().delete().where('country IN (:...c)', { c: ['MDG', 'MG'] }).execute();
        console.log('Deleted rows:', res.affected);
        await data_source_1.default.destroy();
    }
    catch (err) {
        console.error('Error clearing economic indicators:', err);
        process.exit(1);
    }
})();
//# sourceMappingURL=clear-economic.js.map