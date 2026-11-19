"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepLinkController = void 0;
const mongoose_1 = require("mongoose");
const config_1 = __importDefault(require("../../../config"));
const product_model_1 = __importDefault(require("../product/product.model"));
const user_model_1 = require("../user/user.model");
const auction_model_1 = require("../auction/auction.model");
const deeplink_utils_1 = require("./deeplink.utils");
const getAndroidAssetLinks = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h
    res.json([
        {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
                namespace: 'android_app',
                package_name: config_1.default.deepLink.androidPackageName,
                sha256_cert_fingerprints: config_1.default.deepLink.androidSha256Fingerprints,
            },
        },
    ]);
};
const getAppleAssociation = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h
    res.json({
        applinks: {
            apps: [],
            details: [
                {
                    appID: config_1.default.deepLink.iosAppId,
                    appIDs: [config_1.default.deepLink.iosAppId],
                    paths: ['/trade/*', '/profile/*', '/live/*', '/signup', '/signup*'],
                    components: [
                        { '/': '/trade/*' },
                        { '/': '/profile/*' },
                        { '/': '/live/*' },
                        { '/': '/signup*' },
                    ],
                },
            ],
        },
    });
};
const getTradePreview = async (req, res) => {
    var _a;
    try {
        const { productId } = req.params;
        const product = mongoose_1.Types.ObjectId.isValid(productId)
            ? await product_model_1.default.findById(productId).lean()
            : null;
        const host = req.get('host') || 'api.areisco.com';
        const protocol = req.protocol || 'https';
        const baseUrl = `${protocol}://${host}`;
        const title = product
            ? `${product.title} - $${(product.buyNowPrice || product.estValue || 0).toFixed(2)}`
            : 'AREIS Trade Listing';
        const description = (product === null || product === void 0 ? void 0 : product.description) || 'Check out this verified collectible listing on AREIS.';
        const rawImage = ((_a = product === null || product === void 0 ? void 0 : product.images) === null || _a === void 0 ? void 0 : _a[0]) || '/uploads/default-card.png';
        const image = rawImage.startsWith('http')
            ? rawImage
            : `${baseUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;
        const pageUrl = `${baseUrl}/trade/${productId}`;
        const deepLink = `culturecards://trade/${productId}`;
        const html = (0, deeplink_utils_1.generateOpenGraphHtml)({
            title,
            description,
            image,
            pageUrl,
            deepLink,
            buttonText: 'Open in AREIS App',
            isAvatar: false,
        });
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.status(200).send(html);
    }
    catch (error) {
        res.status(500).send('Error rendering trade preview');
    }
};
const getProfilePreview = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = mongoose_1.Types.ObjectId.isValid(userId)
            ? await user_model_1.User.findById(userId).lean()
            : null;
        const host = req.get('host') || 'api.areisco.com';
        const protocol = req.protocol || 'https';
        const baseUrl = `${protocol}://${host}`;
        const title = user
            ? `${user.name} (@${user.username || 'trader'}) - AREIS`
            : 'Trader Profile - AREIS';
        const description = (user === null || user === void 0 ? void 0 : user.description) ||
            (user === null || user === void 0 ? void 0 : user.bio) ||
            `Check out ${(user === null || user === void 0 ? void 0 : user.name) || 'this seller'}'s verified collection on AREIS.`;
        const rawImage = (user === null || user === void 0 ? void 0 : user.profile) || '/uploads/default-avatar.png';
        const image = rawImage.startsWith('http')
            ? rawImage
            : `${baseUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;
        const pageUrl = `${baseUrl}/profile/${userId}`;
        const deepLink = `culturecards://profile/${userId}`;
        const html = (0, deeplink_utils_1.generateOpenGraphHtml)({
            title,
            description,
            image,
            pageUrl,
            deepLink,
            buttonText: 'Open Profile in AREIS',
            isAvatar: true,
        });
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.status(200).send(html);
    }
    catch (error) {
        res.status(500).send('Error rendering profile preview');
    }
};
const getLivePreview = async (req, res) => {
    var _a, _b, _c;
    try {
        const { streamId } = req.params;
        const stream = mongoose_1.Types.ObjectId.isValid(streamId)
            ? await auction_model_1.LiveStream.findById(streamId)
                .populate('sellerId', 'name fullName username')
                .lean()
            : null;
        const host = req.get('host') || 'api.areisco.com';
        const protocol = req.protocol || 'https';
        const baseUrl = `${protocol}://${host}`;
        const sellerName = ((_a = stream === null || stream === void 0 ? void 0 : stream.sellerId) === null || _a === void 0 ? void 0 : _a.fullName) ||
            ((_b = stream === null || stream === void 0 ? void 0 : stream.sellerId) === null || _b === void 0 ? void 0 : _b.name) ||
            ((_c = stream === null || stream === void 0 ? void 0 : stream.sellerId) === null || _c === void 0 ? void 0 : _c.username) ||
            'AREIS Host';
        const title = stream ? `${stream.title} — LIVE on AREIS` : 'Live Show on AREIS';
        const description = (stream === null || stream === void 0 ? void 0 : stream.description) || `Watch ${sellerName} live on AREIS for auctions, trades, and giveaways!`;
        const rawImage = (stream === null || stream === void 0 ? void 0 : stream.coverImage) || '/uploads/default-card.png';
        const image = rawImage.startsWith('http')
            ? rawImage
            : `${baseUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;
        const pageUrl = `${baseUrl}/live/${streamId}`;
        const deepLink = `culturecards://live/${streamId}`;
        const html = (0, deeplink_utils_1.generateOpenGraphHtml)({
            title,
            description,
            image,
            pageUrl,
            deepLink,
            buttonText: 'Watch Live in AREIS',
            isAvatar: false,
        });
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
        res.status(200).send(html);
    }
    catch (error) {
        res.status(500).send('Error rendering live show preview');
    }
};
const getSignupPreview = async (req, res) => {
    try {
        const promo = String(req.query.promo || req.query.code || req.query.promoCode || '').trim();
        const host = req.get('host') || 'api.areisco.com';
        const protocol = req.protocol || 'https';
        const baseUrl = `${protocol}://${host}`;
        const queryStr = promo ? `?promo=${encodeURIComponent(promo)}` : '';
        const pageUrl = `${baseUrl}/signup${queryStr}`;
        const deepLink = `culturecards://signup${queryStr}`;
        const html = (0, deeplink_utils_1.generateOpenGraphHtml)({
            title: promo ? `Join AREIS with Code ${promo}` : 'Join AREIS',
            description: promo
                ? `You've been invited to AREIS! Sign up with promo code ${promo} for live auctions and verified trades.`
                : 'Join AREIS for live collectible shows, auctions, and verified trades.',
            image: `${baseUrl}/uploads/default-card.png`,
            pageUrl,
            deepLink,
            buttonText: 'Open in AREIS App',
            isAvatar: false,
        });
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.status(200).send(html);
    }
    catch (error) {
        res.status(500).send('Error rendering signup preview');
    }
};
exports.DeepLinkController = {
    getAndroidAssetLinks,
    getAppleAssociation,
    getTradePreview,
    getProfilePreview,
    getLivePreview,
    getSignupPreview,
};
