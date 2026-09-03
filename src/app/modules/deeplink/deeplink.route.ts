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

export const DeepLinkRoutes = router
