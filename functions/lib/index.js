"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRefundCreated = exports.onPaymentCreated = void 0;
const app_1 = require("firebase-admin/app");
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
/*
 * The monthly-analytics functions are gone: a scheduled recompute, a callable
 * that let any caller rewrite any month's totals, and two triggers that
 * incremented a stored aggregate. The aggregate is not a source of truth and had
 * already drifted from the payments it summarised.
 *
 * Deleting the source does NOT retire what is deployed. Run
 * `firebase deploy --only functions` to remove them from the project.
 */
var payments_1 = require("./payments");
Object.defineProperty(exports, "onPaymentCreated", { enumerable: true, get: function () { return payments_1.onPaymentCreated; } });
var refunds_1 = require("./refunds");
Object.defineProperty(exports, "onRefundCreated", { enumerable: true, get: function () { return refunds_1.onRefundCreated; } });
//# sourceMappingURL=index.js.map