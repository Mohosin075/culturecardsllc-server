import { Request, Response } from 'express'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { StatusCodes } from 'http-status-codes'
import { PartnerService } from './partner.service'

const createPartnerByAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerService.createPartnerByAdmin(req.body)
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Partner created successfully!',
    data: result,
  })
})

const getAllPartners = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerService.getAllPartners()
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Partners retrieved successfully!',
    data: result,
  })
})

const getPartnerDashboardByToken = catchAsync(async (req: Request, res: Response) => {
  const token = (req.query.token as string) || (req.headers['x-partner-token'] as string)
  const result = await PartnerService.getPartnerDashboardByToken(token)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Partner dashboard data retrieved successfully!',
    data: result,
  })
})

const updatePartnerBankDetails = catchAsync(async (req: Request, res: Response) => {
  const token = (req.query.token as string) || (req.headers['x-partner-token'] as string)
  const result = await PartnerService.updatePartnerBankDetails(token, req.body)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Bank details updated successfully!',
    data: result,
  })
})

const sendMagicLinkEmailToPartner = catchAsync(async (req: Request, res: Response) => {
  const { partnerId } = req.params
  const origin = req.get('origin') || req.get('referer')
  const result = await PartnerService.sendMagicLinkEmailToPartner(partnerId, origin)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: result,
  })
})


const validatePromoCode = catchAsync(async (req: Request, res: Response) => {
  const code = req.query.code as string
  const result = await PartnerService.validatePromoCode(code)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.valid ? 'Promo code is valid' : 'Invalid promo code',
    data: result,
  })
})

export const PartnerController = {
  createPartnerByAdmin,
  getAllPartners,
  getPartnerDashboardByToken,
  updatePartnerBankDetails,
  sendMagicLinkEmailToPartner,
  validatePromoCode,
}
