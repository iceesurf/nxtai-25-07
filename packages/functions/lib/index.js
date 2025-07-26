"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.updateProfile = exports.signup = exports.getCurrentUser = void 0;
// Export all Cloud Functions
var auth_1 = require("./auth");
Object.defineProperty(exports, "getCurrentUser", { enumerable: true, get: function () { return auth_1.getCurrentUser; } });
Object.defineProperty(exports, "signup", { enumerable: true, get: function () { return auth_1.signup; } });
Object.defineProperty(exports, "updateProfile", { enumerable: true, get: function () { return auth_1.updateProfile; } });
Object.defineProperty(exports, "deleteAccount", { enumerable: true, get: function () { return auth_1.deleteAccount; } });
//# sourceMappingURL=index.js.map