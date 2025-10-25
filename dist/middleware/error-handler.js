"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
function errorHandler(err, _req, res, _next) {
    console.error(err);
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({ message, details: err.details || null });
}
exports.errorHandler = errorHandler;
exports.default = errorHandler;
//# sourceMappingURL=error-handler.js.map