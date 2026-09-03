import { Request, Response } from 'express'
import { Types } from 'mongoose'
import config from '../../../config'
import Product from '../product/product.model'
import { User } from '../user/user.model'
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
          paths: ['/trade/*', '/profile/*'],
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

    const host = req.get('host') || 'culturecards.app'
    const protocol = req.protocol || 'https'
    const baseUrl = `${protocol}://${host}`

    const title = product
      ? `${product.title} - $${(product.buyNowPrice || product.estValue || 0).toFixed(2)}`
      : 'Culture Cards Trade'
    const description =
      product?.description || 'Check out this verified trading card on Culture Cards LLC.'

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
      buttonText: 'Open in Culture Cards App',
      isAvatar: false,
    })

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600') // 5 min client, 10 min CDN cache
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

    const host = req.get('host') || 'culturecards.app'
    const protocol = req.protocol || 'https'
    const baseUrl = `${protocol}://${host}`

    const title = user
      ? `${user.name} (@${user.username || 'trader'}) - Culture Cards`
      : 'Trader Profile - Culture Cards'
    const description =
      (user as any)?.description ||
      (user as any)?.bio ||
      `Check out ${user?.name || 'this seller'}'s verified trading card collection on Culture Cards LLC.`

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
      buttonText: 'Open Profile in App',
      isAvatar: true,
    })

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
    res.status(200).send(html)
  } catch (error) {
    res.status(500).send('Error rendering profile preview')
  }
}

export const DeepLinkController = {
  getAndroidAssetLinks,
  getAppleAssociation,
  getTradePreview,
  getProfilePreview,
}
