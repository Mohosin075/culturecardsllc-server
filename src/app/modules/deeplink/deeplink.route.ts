import express from 'express'
import { DeepLinkController } from './deeplink.controller'

const router = express.Router()

// Android Asset Links
router.get('/.well-known/assetlinks.json', DeepLinkController.getAndroidAssetLinks)

// iOS Universal Links
router.get('/.well-known/apple-app-site-association', DeepLinkController.getAppleAssociation)

// Social Media OG Preview & Fallback Redirection
router.get('/trade/:productId', DeepLinkController.getTradePreview)
router.get('/profile/:userId', DeepLinkController.getProfilePreview)
router.get('/live/:streamId', DeepLinkController.getLivePreview)
router.get('/signup', DeepLinkController.getSignupPreview)

export const DeepLinkRoutes = router
