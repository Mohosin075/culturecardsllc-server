"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepLinkRoutes = void 0;
const express_1 = __importDefault(require("express"));
const deeplink_controller_1 = require("./deeplink.controller");
const router = express_1.default.Router();
// Android Asset Links
router.get('/.well-known/assetlinks.json', deeplink_controller_1.DeepLinkController.getAndroidAssetLinks);
// iOS Universal Links
router.get('/.well-known/apple-app-site-association', deeplink_controller_1.DeepLinkController.getAppleAssociation);
// Social Media OG Preview & Fallback Redirection
router.get('/trade/:productId', deeplink_controller_1.DeepLinkController.getTradePreview);
router.get('/profile/:userId', deeplink_controller_1.DeepLinkController.getProfilePreview);
router.get('/live/:streamId', deeplink_controller_1.DeepLinkController.getLivePreview);
router.get('/signup', deeplink_controller_1.DeepLinkController.getSignupPreview);
exports.DeepLinkRoutes = router;
