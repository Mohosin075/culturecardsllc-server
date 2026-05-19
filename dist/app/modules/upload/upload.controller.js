"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const http_status_codes_1 = require("http-status-codes");
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
};
exports.default = exports.UploadController;
