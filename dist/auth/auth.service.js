"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
class AuthService {
    async register() {
        throw new Error('Authentication is disabled in this project');
    }
    async validateUser() {
        return null;
    }
    async login() {
        throw new Error('Authentication is disabled in this project');
    }
}
exports.AuthService = AuthService;
exports.default = new AuthService();
//# sourceMappingURL=auth.service.js.map