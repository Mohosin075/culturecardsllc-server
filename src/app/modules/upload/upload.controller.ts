import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { S3Helper } from '../../../helpers/image/s3helper'
import sendResponse from '../../../shared/sendResponse'

export const UploadController = {
  // POST /upload/presign
  async presign(req: Request, res: Response) {
    try {
      const { filename, contentType, folder = 'videos' } = req.body
      if (!filename || !contentType) {
        return sendResponse(res, {
          statusCode: StatusCodes.BAD_REQUEST,
          success: false,
          message: 'filename and contentType required',
        })
      }

      const result = await S3Helper.generatePresignedUploadUrl(
        filename,
        folder,
        contentType,
        3600,
      )

      return sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Presigned URL generated',
        data: result,
      })
    } catch (err: any) {
      console.error('Presign error:', err)
      return sendResponse(res, {
        statusCode: err?.status || StatusCodes.INTERNAL_SERVER_ERROR,
        success: false,
        message: err?.message || 'Failed to get presigned URL',
      })
    }
  },
}

export default UploadController
