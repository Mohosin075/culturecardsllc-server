"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Helper = exports.deleteFromS3 = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const config_1 = __importDefault(require("../../config"));
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const sharp_1 = __importDefault(require("sharp"));
const s3Client = new client_s3_1.S3Client({
    region: config_1.default.aws.region,
    credentials: {
        accessKeyId: config_1.default.aws.access_key_id,
        secretAccessKey: config_1.default.aws.secret_access_key,
    },
});
const getPublicUri = (fileKey) => {
    return `https://${config_1.default.aws.bucket_name}.s3.${config_1.default.aws.region}.amazonaws.com/${fileKey}`;
};
const uploadToS3 = async (file, folder) => {
    const fileKey = `${folder}/${Date.now().toString()}-${file.originalname}`;
    const params = {
        Bucket: config_1.default.aws.bucket_name,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
    };
    try {
        const command = new client_s3_1.PutObjectCommand(params);
        await s3Client.send(command);
        return getPublicUri(fileKey);
    }
    catch (error) {
        console.error('Error uploading to S3:', error);
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to upload file to S3');
    }
};
const deleteFromS3 = async (fileKey) => {
    const params = {
        Bucket: config_1.default.aws.bucket_name,
        Key: fileKey,
    };
    try {
        const command = new client_s3_1.DeleteObjectCommand(params);
        await s3Client.send(command);
        console.log('deleted');
    }
    catch (error) {
        console.error('Error deleting from S3:', error);
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to delete file from S3');
    }
};
exports.deleteFromS3 = deleteFromS3;
const uploadMultipleFilesToS3 = async (files, folder) => {
    if (!files || files.length === 0) {
        throw new Error('No files provided for upload');
    }
    const uploadPromises = files.map(async (file) => {
        // Generate unique file name
        const fileExtension = file.originalname.split('.').pop();
        const fileKey = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
        try {
            // Process images with Sharp, videos as-is
            let fileBuffer = file.buffer;
            const contentType = file.mimetype;
            if (file.mimetype.startsWith('image/')) {
                // Optimize image using sharp
                fileBuffer = await (0, sharp_1.default)(file.buffer)
                    .resize(1024)
                    .jpeg({ quality: 80 })
                    .toBuffer();
            }
            else if (file.mimetype.startsWith('video/')) {
                // Use original video buffer - no Sharp processing
                fileBuffer = file.buffer;
            }
            else {
                throw new Error(`Unsupported file type: ${file.mimetype}`);
            }
            const params = {
                Bucket: config_1.default.aws.bucket_name, // FIXED: Use config instead of process.env
                Key: fileKey,
                Body: fileBuffer,
                ContentType: contentType,
            };
            const command = new client_s3_1.PutObjectCommand(params);
            await s3Client.send(command);
            return getPublicUri(fileKey);
        }
        catch (error) {
            console.error('Error uploading file to S3:', error);
            return null;
        }
    });
    const results = await Promise.allSettled(uploadPromises);
    return results
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
};
const uploadMultipleVideosToS3 = async (files, folder) => {
    if (!files || files.length === 0) {
        throw new Error('No video files provided for upload');
    }
    const uploadPromises = files.map(async (file) => {
        // Validate it's actually a video
        if (!file.mimetype.startsWith('video/')) {
            console.warn(`Skipping non-video file: ${file.mimetype}`);
            return null;
        }
        const fileExtension = file.originalname.split('.').pop();
        const fileKey = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
        try {
            const params = {
                Bucket: config_1.default.aws.bucket_name, // FIXED: Use config instead of process.env
                Key: fileKey,
                Body: file.buffer,
                ContentType: file.mimetype,
            };
            const command = new client_s3_1.PutObjectCommand(params);
            await s3Client.send(command);
            return getPublicUri(fileKey);
        }
        catch (error) {
            console.error('Error uploading video to S3:', error);
            return null;
        }
    });
    const results = await Promise.allSettled(uploadPromises);
    return results
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
};
exports.S3Helper = {
    uploadToS3,
    uploadMultipleFilesToS3,
    uploadMultipleVideosToS3,
    generatePresignedUploadUrl: async (filename, folder, contentType, expiresIn = 3600) => {
        const fileKey = `${folder}/${Date.now()}-${filename}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: config_1.default.aws.bucket_name,
            Key: fileKey,
            ContentType: contentType,
        });
        try {
            const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
            return { signedUrl, publicUrl: getPublicUri(fileKey), key: fileKey };
        }
        catch (err) {
            console.error('Error generating presigned URL:', err);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to generate presigned URL');
        }
    },
    deleteFromS3: exports.deleteFromS3,
};
