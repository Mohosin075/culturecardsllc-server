import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import path from 'path'
import fs from 'fs'
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

  // POST /upload/image
  async uploadImage(req: Request, res: Response) {
    try {
      const file =
        req.file ||
        (req.files && Array.isArray(req.files) ? req.files[0] : null) ||
        (req.files && (req.files as any).image?.[0]) ||
        (req.files && (req.files as any).file?.[0])

      if (!file) {
        return sendResponse(res, {
          statusCode: StatusCodes.BAD_REQUEST,
          success: false,
          message: 'No image file provided',
        })
      }

      let url: string = ''
      try {
        url = await S3Helper.uploadToS3(file, 'image')
      } catch (s3Err) {
        console.warn('S3 upload fallback to local disk:', s3Err)
        const uploadsDir = path.join(process.cwd(), 'uploads', 'images')
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true })
        }
        const ext = path.extname(file.originalname) || '.jpg'
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`
        const fullPath = path.join(uploadsDir, filename)
        fs.writeFileSync(fullPath, file.buffer)
        const host = req.get('host')
        url = `${req.protocol}://${host}/uploads/images/${filename}`
      }

      return sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Image uploaded successfully',
        data: { url },
      })
    } catch (err: any) {
      console.error('Upload image error:', err)
      return sendResponse(res, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        success: false,
        message: err?.message || 'Failed to upload image',
      })
    }
  },
}

export default UploadController
