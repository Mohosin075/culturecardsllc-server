"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalRoutes = void 0;
const express_1 = require("express");
const public_model_1 = require("./public.model");
const legalView_1 = require("./legalView");
const router = (0, express_1.Router)();
router.get('/privacy-policy', async (req, res) => {
    try {
        const doc = await public_model_1.Public.findOne({ type: 'privacy-policy' }).lean();
        if (doc === null || doc === void 0 ? void 0 : doc.content) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send((0, legalView_1.renderLegalHtml)('Privacy Policy', doc.content, 'privacy-policy'));
            return;
        }
        res.status(404).send('Privacy Policy not found.');
    }
    catch (err) {
        res.status(500).send('Error loading Privacy Policy.');
    }
});
const renderTermsHandler = async (req, res) => {
    try {
        const doc = await public_model_1.Public.findOne({ type: 'terms-and-condition' }).lean();
        if (doc === null || doc === void 0 ? void 0 : doc.content) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send((0, legalView_1.renderLegalHtml)('Terms & Conditions', doc.content, 'terms-and-condition'));
            return;
        }
        res.status(404).send('Terms & Conditions not found.');
    }
    catch (err) {
        res.status(500).send('Error loading Terms & Conditions.');
    }
};
router.get('/terms-and-conditions', renderTermsHandler);
router.get('/terms', renderTermsHandler);
router.get('/terms-of-service', renderTermsHandler);
/**
 * Seller-facing policies. The seller application asks applicants to accept
 * these by name, so each one needs a page of its own. Content is managed from
 * the admin dashboard (`POST /api/v1/public` with the matching `type`); until
 * a document is published the page explains that rather than 404-ing on a
 * seller who is mid-application.
 */
const renderPolicyHandler = (type, heading) => async (req, res) => {
    try {
        const doc = await public_model_1.Public.findOne({ type }).lean();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (doc === null || doc === void 0 ? void 0 : doc.content) {
            res.send((0, legalView_1.renderLegalHtml)(heading, doc.content, type));
            return;
        }
        res.send((0, legalView_1.renderLegalHtml)(heading, `<p>The ${heading} have not been published yet. Please check back before completing your seller application.</p>`, type));
    }
    catch (err) {
        res.status(500).send(`Error loading ${heading}.`);
    }
};
router.get('/seller-policy', renderPolicyHandler('seller-policy', 'Seller Policy'));
router.get('/marketplace-rules', renderPolicyHandler('marketplace-rules', 'Marketplace Rules'));
exports.LegalRoutes = router;
