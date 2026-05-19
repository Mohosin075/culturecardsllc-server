import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import multer, { FileFilterCallback } from 'multer'
import sharp from 'sharp'
import ApiError from '../../errors/ApiError'

const fileUploadHandler = () => {
  // Configure storage (use memory for in-process transformations)
  const storage = multer.memoryStorage()

  // File filter: synchronous function expected by multer
  const validateFile = (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    try {
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg']
      const allowedMediaTypes = [
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'audio/mpeg',
        'audio/mp3',
      ]
      const allowedDocTypes = ['application/pdf']
      const imageFields = ['image', 'license', 'signature', 'businessProfile']
      // Images
      if (imageFields.includes(file.fieldname)) {
        if (allowedImageTypes.includes(file.mimetype)) cb(null, true)
        else
          cb(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              'Only .jpeg, .png, .jpg file supported',
            ),
          )
        return
      }

      // Media (videos/audio)
      if (file.fieldname === 'media' || file.fieldname === 'clips') {
        if (allowedMediaTypes.includes(file.mimetype)) cb(null, true)
        else
          cb(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              'Only .mp4, .mp3 file supported',
            ),
          )
        return
      }

      // Documents
      if (file.fieldname === 'doc') {
        if (allowedDocTypes.includes(file.mimetype)) cb(null, true)
        else cb(new ApiError(StatusCodes.BAD_REQUEST, 'Only pdf supported'))
        return
      }

      // Unknown field
      cb(
        new ApiError(
          StatusCodes.BAD_REQUEST,
          'This file field is not supported',
        ),
      )
    } catch (error) {
      cb(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          'File validation failed',
        ),
      )
    }
  }

  // Configure multer
  const upload = multer({
    storage: storage,
    fileFilter: validateFile,
    limits: {
      fileSize: 30 * 1024 * 1024, // 30 MB per file (adjust as needed)
      files: 10, // Maximum number of files allowed
    },
  }).fields([
    { name: 'image', maxCount: 5 },
    { name: 'media', maxCount: 3 },
    { name: 'doc', maxCount: 3 },
    { name: 'clips', maxCount: 3 },
  ])

  // Process uploaded images with Sharp
  const processImages = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.files) return next()

    try {
      const imageFields = ['image', 'license', 'signature', 'businessProfile']

      // Process each image field
      for (const field of imageFields) {
        const files = (req.files as any)[field]
        if (!files) continue

        // Process each file in the field
        for (const file of files) {
          if (!file.mimetype.startsWith('image')) continue

          // Resize and optimize the image
          // Use fit: 'inside' to preserve aspect ratio, limiting size to 1080x1350
          const transformer = sharp(file.buffer).resize({
            width: 1080,
            height: 1350,
            fit: 'inside',
          })

          // Preserve format and compress appropriately
          let optimizedBuffer
          const mimetype = file.mimetype
          if (mimetype === 'image/png') {
            optimizedBuffer = await transformer.png({ quality: 80 }).toBuffer()
          } else {
            // Default to jpeg for jpg/jpeg or unknown
            optimizedBuffer = await transformer.jpeg({ quality: 80 }).toBuffer()
          }

          // Replace the original buffer with the optimized one
          file.buffer = optimizedBuffer
        }
      }
      next()
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          'Image processing failed',
        ),
      )
    }
  }

  // Return middleware chain
  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, err => {
      if (err) return next(err)

      // If uploaded videos exceed server-side accepted size, reject and recommend using presigned URL
      try {
        const mediaFiles = (req.files as any)?.media as Express.Multer.File[]
        const clipsFiles = (req.files as any)?.clips as Express.Multer.File[]
        const MAX_VIDEO_SIZE_MB = Number(
          process.env.SERVER_UPLOAD_MAX_VIDEO_SIZE_MB || '10',
        )
        const maxBytes = MAX_VIDEO_SIZE_MB * 1024 * 1024

        const tooLarge = (mediaFiles || [])
          .concat(clipsFiles || [])
          .some(f => f && f.size > maxBytes)
        if (tooLarge) {
          return next(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              `Video too large for server-side upload; please use presigned S3 upload (limit ${MAX_VIDEO_SIZE_MB} MB)`,
            ),
          )
        }
      } catch (sizeCheckErr) {
        // ignore size check errors -- not critical
      }
      processImages(req, res, next)
    })
  }
}

export default fileUploadHandler
