import { Router, Request, Response } from 'express'
import { Public } from './public.model'
import { renderLegalHtml } from './legalView'

const router = Router()

router.get('/privacy-policy', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await Public.findOne({ type: 'privacy-policy' }).lean()
    if (doc?.content) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(renderLegalHtml('Privacy Policy', doc.content, 'privacy-policy'))
      return
    }
    res.status(404).send('Privacy Policy not found.')
  } catch (err) {
    res.status(500).send('Error loading Privacy Policy.')
  }
})

const renderTermsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await Public.findOne({ type: 'terms-and-condition' }).lean()
    if (doc?.content) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(renderLegalHtml('Terms & Conditions', doc.content, 'terms-and-condition'))
      return
    }
    res.status(404).send('Terms & Conditions not found.')
  } catch (err) {
    res.status(500).send('Error loading Terms & Conditions.')
  }
}

router.get('/terms-and-conditions', renderTermsHandler)
router.get('/terms', renderTermsHandler)
router.get('/terms-of-service', renderTermsHandler)

export const LegalRoutes = router
