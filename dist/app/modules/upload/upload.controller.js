"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const http_status_codes_1 = require("http-status-codes");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const s3helper_1 = require("../../../helpers/image/s3helper");
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
exports.UploadController = {
    // POST /upload/presign
    async presign(req, res) {
        try {
            const { filename, contentType, folder = 'videos' } = req.body;
            if (!filename || !contentType) {
                return (0, sendResponse_1.default)(res, {
                    statusCode: http_status_codes_1.StatusCodes.BAD_REQUEST,
                    success: false,
                    message: 'filename and contentType required',
                });
            }
            const result = await s3helper_1.S3Helper.generatePresignedUploadUrl(filename, folder, contentType, 3600);
            return (0, sendResponse_1.default)(res, {
                statusCode: http_status_codes_1.StatusCodes.OK,
                success: true,
                message: 'Presigned URL generated',
                data: result,
            });
        }
        catch (err) {
            console.error('Presign error:', err);
            return (0, sendResponse_1.default)(res, {
                statusCode: (err === null || err === void 0 ? void 0 : err.status) || http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
                success: false,
                message: (err === null || err === void 0 ? void 0 : err.message) || 'Failed to get presigned URL',
            });
        }
    },
    // POST /upload/image
    async uploadImage(req, res) {
        var _a, _b;
        try {
            const file = req.file ||
                (req.files && Array.isArray(req.files) ? req.files[0] : null) ||
                (req.files && ((_a = req.files.image) === null || _a === void 0 ? void 0 : _a[0])) ||
                (req.files && ((_b = req.files.file) === null || _b === void 0 ? void 0 : _b[0]));
            if (!file) {
                return (0, sendResponse_1.default)(res, {
                    statusCode: http_status_codes_1.StatusCodes.BAD_REQUEST,
                    success: false,
                    message: 'No image file provided',
                });
            }
            let url = '';
            try {
                url = await s3helper_1.S3Helper.uploadToS3(file, 'image');
            }
            catch (s3Err) {
                console.warn('S3 upload fallback to local disk:', s3Err);
                const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'images');
                if (!fs_1.default.existsSync(uploadsDir)) {
                    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
                }
                const ext = path_1.default.extname(file.originalname) || '.jpg';
                const filename = `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`;
                const fullPath = path_1.default.join(uploadsDir, filename);
                fs_1.default.writeFileSync(fullPath, file.buffer);
                const host = req.get('host');
                url = `${req.protocol}://${host}/uploads/images/${filename}`;
            }
            return (0, sendResponse_1.default)(res, {
                statusCode: http_status_codes_1.StatusCodes.OK,
                success: true,
                message: 'Image uploaded successfully',
                data: { url },
            });
        }
        catch (err) {
            console.error('Upload image error:', err);
            return (0, sendResponse_1.default)(res, {
                statusCode: http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
                success: false,
                message: (err === null || err === void 0 ? void 0 : err.message) || 'Failed to upload image',
            });
        }
    },
};
exports.default = exports.UploadController;
