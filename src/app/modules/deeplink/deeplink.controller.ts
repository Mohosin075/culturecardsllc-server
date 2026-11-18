import { Request, Response } from 'express'
import { Types } from 'mongoose'
import config from '../../../config'
import Product from '../product/product.model'
import { User } from '../user/user.model'
import { LiveStream } from '../auction/auction.model'
import { generateOpenGraphHtml } from './deeplink.utils'

const getAndroidAssetLinks = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'public, max-age=86400') // Cache for 24h
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: config.deepLink.androidPackageName,
        sha256_cert_fingerprints: config.deepLink.androidSha256Fingerprints,
      },
    },
  ])
}

const getAppleAssociation = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'public, max-age=86400') // Cache for 24h
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: config.deepLink.iosAppId,
          appIDs: [config.deepLink.iosAppId],
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
  })
}

const getTradePreview = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params
    const product = Types.ObjectId.isValid(productId)
      ? await Product.findById(productId).lean()
      : null

    const host = req.get('host') || 'api.areisco.com'
    const protocol = req.protocol || 'https'
    const baseUrl = `${protocol}://${host}`

    const title = product
      ? `${product.title} - $${(product.buyNowPrice || product.estValue || 0).toFixed(2)}`
      : 'AREIS Trade Listing'
    const description =
      product?.description || 'Check out this verified collectible listing on AREIS.'

    const rawImage = product?.images?.[0] || '/uploads/default-card.png'
    const image = rawImage.startsWith('http')
      ? rawImage
      : `${baseUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`
    const pageUrl = `${baseUrl}/trade/${productId}`
    const deepLink = `culturecards://trade/${productId}`

    const html = generateOpenGraphHtml({
      title,
      description,
      image,
      pageUrl,
      deepLink,
      buttonText: 'Open in AREIS App',
      isAvatar: false,
    })

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
    res.status(200).send(html)
  } catch (error) {
    res.status(500).send('Error rendering trade preview')
  }
}

const getProfilePreview = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const user = Types.ObjectId.isValid(userId)
      ? await User.findById(userId).lean()
      : null

    const host = req.get('host') || 'api.areisco.com'
    const protocol = req.protocol || 'https'
    const baseUrl = `${protocol}://${host}`

    const title = user
      ? `${user.name} (@${user.username || 'trader'}) - AREIS`
      : 'Trader Profile - AREIS'
    const description =
      (user as any)?.description ||
      (user as any)?.bio ||
      `Check out ${user?.name || 'this seller'}'s verified collection on AREIS.`

    const rawImage = user?.profile || '/uploads/default-avatar.png'
    const image = rawImage.startsWith('http')
      ? rawImage
      : `${baseUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`
    const pageUrl = `${baseUrl}/profile/${userId}`
    const deepLink = `culturecards://profile/${userId}`

    const html = generateOpenGraphHtml({
      title,
      description,
      image,
      pageUrl,
      deepLink,
      buttonText: 'Open Profile in AREIS',
      isAvatar: true,
    })

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
    res.status(200).send(html)
  } catch (error) {
    res.status(500).send('Error rendering profile preview')
  }
}

const getLivePreview = async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params
    const stream: any = Types.ObjectId.isValid(streamId)
      ? await LiveStream.findById(streamId)
          .populate('sellerId', 'name fullName username')
          .lean()
      : null

    const host = req.get('host') || 'api.areisco.com'
    const protocol = req.protocol || 'https'
    const baseUrl = `${protocol}://${host}`

    const sellerName =
      stream?.sellerId?.fullName ||
      stream?.sellerId?.name ||
      stream?.sellerId?.username ||
      'AREIS Host'
    const title = stream ? `${stream.title} — LIVE on AREIS` : 'Live Show on AREIS'
    const description =
      stream?.description || `Watch ${sellerName} live on AREIS for auctions, trades, and giveaways!`

    const rawImage = stream?.coverImage || '/uploads/default-card.png'
    const image = rawImage.startsWith('http')
      ? rawImage
      : `${baseUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`
    const pageUrl = `${baseUrl}/live/${streamId}`
    const deepLink = `culturecards://live/${streamId}`

    const html = generateOpenGraphHtml({
      title,
      description,
      image,
      pageUrl,
      deepLink,
      buttonText: 'Watch Live in AREIS',
      isAvatar: false,
    })

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120')
    res.status(200).send(html)
  } catch (error) {
    res.status(500).send('Error rendering live show preview')
  }
}

const getSignupPreview = async (req: Request, res: Response) => {
  try {
    const promo = String(req.query.promo || req.query.code || req.query.promoCode || '').trim()
    const host = req.get('host') || 'api.areisco.com'
    const protocol = req.protocol || 'https'
    const baseUrl = `${protocol}://${host}`

    const queryStr = promo ? `?promo=${encodeURIComponent(promo)}` : ''
    const pageUrl = `${baseUrl}/signup${queryStr}`
    const deepLink = `culturecards://signup${queryStr}`

    const html = generateOpenGraphHtml({
      title: promo ? `Join AREIS with Code ${promo}` : 'Join AREIS',
      description: promo
        ? `You've been invited to AREIS! Sign up with promo code ${promo} for live auctions and verified trades.`
        : 'Join AREIS for live collectible shows, auctions, and verified trades.',
      image: `${baseUrl}/uploads/default-card.png`,
      pageUrl,
      deepLink,
      buttonText: 'Open in AREIS App',
      isAvatar: false,
    })

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
    res.status(200).send(html)
  } catch (error) {
    res.status(500).send('Error rendering signup preview')
  }
}

export const DeepLinkController = {
  getAndroidAssetLinks,
  getAppleAssociation,
  getTradePreview,
  getProfilePreview,
  getLivePreview,
  getSignupPreview,
}
