"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRefundCreated = exports.onPaymentCreated = exports.recomputeMonthlyAnalytics = exports.computeMonthlyAnalyticsScheduled = void 0;
const app_1 = require("firebase-admin/app");
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
var analytics_1 = require("./analytics");
Object.defineProperty(exports, "computeMonthlyAnalyticsScheduled", { enumerable: true, get: function () { return analytics_1.computeMonthlyAnalyticsScheduled; } });
Object.defineProperty(exports, "recomputeMonthlyAnalytics", { enumerable: true, get: function () { return analytics_1.recomputeMonthlyAnalytics; } });
var payments_1 = require("./payments");
Object.defineProperty(exports, "onPaymentCreated", { enumerable: true, get: function () { return payments_1.onPaymentCreated; } });
var refunds_1 = require("./refunds");
Object.defineProperty(exports, "onRefundCreated", { enumerable: true, get: function () { return refunds_1.onRefundCreated; } });
//# sourceMappingURL=index.js.map