import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import config from '../../config'
import ApiError from '../../errors/ApiError'
import { StatusCodes } from 'http-status-codes'
import sharp from 'sharp'

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.access_key_id!,
    secretAccessKey: config.aws.secret_access_key!,
  },
})

const getPublicUri = (fileKey: string): string => {
  return `https://${config.aws.bucket_name}.s3.${config.aws.region}.amazonaws.com/${fileKey}`
}

const uploadToS3 = async (
  file: Express.Multer.File,
  folder: 'image' | 'pdf',
): Promise<string> => {
  const fileKey = `${folder}/${Date.now().toString()}-${file.originalname}`
  const params = {
    Bucket: config.aws.bucket_name!,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  }
  try {
    const command = new PutObjectCommand(params)
    await s3Client.send(command)
    return getPublicUri(fileKey)
  } catch (error) {
    console.error('Error uploading to S3:', error)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to upload file to S3')
  }
}

export const deleteFromS3 = async (fileKey: string): Promise<void> => {
  const params = {
    Bucket: config.aws.bucket_name!,
    Key: fileKey,
  }

  try {
    const command = new DeleteObjectCommand(params)
    await s3Client.send(command)
    console.log('deleted')
  } catch (error) {
    console.error('Error deleting from S3:', error)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to delete file from S3')
  }
}

const uploadMultipleFilesToS3 = async (
  files: Express.Multer.File[],
  folder: string,
): Promise<string[]> => {
  if (!files || files.length === 0) {
    throw new Error('No files provided for upload')
  }

  const uploadPromises = files.map(async file => {
    // Generate unique file name
    const fileExtension = file.originalname.split('.').pop()
    const fileKey = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`

    try {
      // Process images with Sharp, videos as-is
      let fileBuffer = file.buffer
      const contentType = file.mimetype

      if (file.mimetype.startsWith('image/')) {
        // Optimize image using sharp
        fileBuffer = await sharp(file.buffer)
          .resize(1024)
          .jpeg({ quality: 80 })
          .toBuffer()
      } else if (file.mimetype.startsWith('video/')) {
        // Use original video buffer - no Sharp processing
        fileBuffer = file.buffer
      } else {
        throw new Error(`Unsupported file type: ${file.mimetype}`)
      }

      const params = {
        Bucket: config.aws.bucket_name!, // FIXED: Use config instead of process.env
        Key: fileKey,
        Body: fileBuffer,
        ContentType: contentType,
      }

      const command = new PutObjectCommand(params)
      await s3Client.send(command)
      return getPublicUri(fileKey)
    } catch (error) {
      console.error('Error uploading file to S3:', error)
      return null
    }
  })

  const results = await Promise.allSettled(uploadPromises)
  return results
    .filter(result => result.status === 'fulfilled' && result.value !== null)
    .map(result => (result as PromiseFulfilledResult<string>).value)
}

const uploadMultipleVideosToS3 = async (
  files: Express.Multer.File[],
  folder: string,
): Promise<string[]> => {
  if (!files || files.length === 0) {
    throw new Error('No video files provided for upload')
  }

  const uploadPromises = files.map(async file => {
    // Validate it's actually a video
    if (!file.mimetype.startsWith('video/')) {
      console.warn(`Skipping non-video file: ${file.mimetype}`)
      return null
    }

    const fileExtension = file.originalname.split('.').pop()
    const fileKey = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`

    try {
      const params = {
        Bucket: config.aws.bucket_name!, // FIXED: Use config instead of process.env
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }

      const command = new PutObjectCommand(params)
      await s3Client.send(command)
      return getPublicUri(fileKey)
    } catch (error) {
      console.error('Error uploading video to S3:', error)
      return null
    }
  })

  const results = await Promise.allSettled(uploadPromises)
  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<string>).value)
}

export const S3Helper = {
  uploadToS3,
  uploadMultipleFilesToS3,
  uploadMultipleVideosToS3,
  generatePresignedUploadUrl: async (
    filename: string,
    folder: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<{ signedUrl: string; publicUrl: string; key: string }> => {
    const fileKey = `${folder}/${Date.now()}-${filename}`
    const command = new PutObjectCommand({
      Bucket: config.aws.bucket_name!,
      Key: fileKey,
      ContentType: contentType,
    })
    try {
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn })
      return { signedUrl, publicUrl: getPublicUri(fileKey), key: fileKey }
    } catch (err) {
      console.error('Error generating presigned URL:', err)
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to generate presigned URL',
      )
    }
  },
  deleteFromS3,
}
