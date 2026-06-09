"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileAndBodyProcessorUsingDiskStorage = exports.fileAndBodyProcessor = void 0;
const multer_1 = __importDefault(require("multer"));
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sharp_1 = __importDefault(require("sharp"));
// Define upload configuration with maxCount information
const uploadFields = [
    { name: 'images', maxCount: 5 },
    { name: 'media', maxCount: 3 },
    { name: 'documents', maxCount: 3 },
    { name: 'coverPhoto', maxCount: 1 },
    { name: 'portfolio', maxCount: 10 },
];
const fileAndBodyProcessor = () => {
    const storage = multer_1.default.memoryStorage();
    // File filter configuration
    const fileFilter = (req, file, cb) => {
        var _a;
        try {
            const allowedTypes = {
                images: ['image/jpeg', 'image/png', 'image/jpg'],
                media: ['video/mp4', 'audio/mpeg'],
                documents: ['application/pdf'],
                coverPhoto: ['image/jpeg', 'image/png', 'image/jpg'],
                portfolio: ['image/jpeg', 'image/png', 'image/jpg'],
            };
            const fieldType = file.fieldname;
            if (!((_a = allowedTypes[fieldType]) === null || _a === void 0 ? void 0 : _a.includes(file.mimetype))) {
                return cb(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid file type for ${file.fieldname}`));
            }
            cb(null, true);
        }
        catch (error) {
            cb(new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'File validation failed'));
        }
    };
    const upload = (0, multer_1.default)({
        storage,
        fileFilter,
        limits: {
            fileSize: 10 * 1024 * 1024,
            files: 10,
        },
    }).fields(uploadFields);
    return (req, res, next) => {
        upload(req, res, async (error) => {
            var _a, _b;
            if (error)
                return next(error);
            try {
                // Parse JSON data if exists
                if ((_a = req.body) === null || _a === void 0 ? void 0 : _a.data) {
                    req.body = JSON.parse(req.body.data);
                }
                // Process uploaded files
                if (req.files) {
                    const processedFiles = {};
                    const fieldsConfig = new Map(uploadFields.map(f => [f.name, f.maxCount]));
                    // Process each uploaded field
                    for (const [fieldName, files] of Object.entries(req.files)) {
                        const maxCount = (_b = fieldsConfig.get(fieldName)) !== null && _b !== void 0 ? _b : 1;
                        const fileArray = files;
                        const paths = [];
                        // Process each file - with image optimization for image types
                        for (const file of fileArray) {
                            const extension = file.mimetype.split('/')[1];
                            const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
                            const filePath = `/${fieldName}/${filename}`;
                            // Apply Sharp optimization for images
                            if ((fieldName === 'images' ||
                                fieldName === 'coverPhoto' ||
                                fieldName === 'portfolio') &&
                                file.mimetype.startsWith('image/')) {
                                try {
                                    // Create Sharp instance
                                    let sharpInstance = (0, sharp_1.default)(file.buffer).resize(800);
                                    // Preserve original format
                                    if (file.mimetype === 'image/png') {
                                        sharpInstance = sharpInstance.png({ quality: 80 });
                                    }
                                    else {
                                        sharpInstance = sharpInstance.jpeg({ quality: 80 });
                                    }
                                    const optimizedBuffer = await sharpInstance.toBuffer();
                                    // Replace the original buffer with optimized one
                                    file.buffer = optimizedBuffer;
                                }
                                catch (err) {
                                    console.error('Image optimization failed:', err);
                                }
                            }
                            paths.push(filePath);
                        }
                        // Store as array or single value based on maxCount
                        processedFiles[fieldName] = maxCount > 1 ? paths : paths[0];
                    }
                    req.body = { ...req.body, ...processedFiles };
                }
                next();
            }
            catch (err) {
                next(err);
            }
        });
    };
};
exports.fileAndBodyProcessor = fileAndBodyProcessor;
// Utility function to generate random string
function generateRandomString(length = 9) {
    return Math.random()
        .toString(36)
        .slice(2, 2 + length);
}
const fileAndBodyProcessorUsingDiskStorage = () => {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
    if (!fs_1.default.existsSync(uploadsDir)) {
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    }
    // Configure storage
    const storage = multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            const folderPath = path_1.default.join(uploadsDir, file.fieldname);
            if (!fs_1.default.existsSync(folderPath)) {
                fs_1.default.mkdirSync(folderPath, { recursive: true });
            }
            cb(null, folderPath);
        },
        filename: (req, file, cb) => {
            const extension = path_1.default.extname(file.originalname) || `.${file.mimetype.split('/')[1]}`;
            const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
            cb(null, filename);
        },
    });
    // File filter configuration
    const fileFilter = (req, file, cb) => {
        var _a;
        try {
            const allowedTypes = {
                images: ['image/jpeg', 'image/png', 'image/jpg'],
                media: ['video/mp4', 'audio/mpeg'],
                documents: ['application/pdf'],
                coverPhoto: ['image/jpeg', 'image/png', 'image/jpg'],
                portfolio: ['image/jpeg', 'image/png', 'image/jpg'],
            };
            const fieldType = file.fieldname;
            if (!((_a = allowedTypes[fieldType]) === null || _a === void 0 ? void 0 : _a.includes(file.mimetype))) {
                return cb(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid file type for ${file.fieldname}`));
            }
            cb(null, true);
        }
        catch (error) {
            cb(new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'File validation failed'));
        }
    };
    const upload = (0, multer_1.default)({
        storage,
        fileFilter,
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
            files: 10,
        },
    }).fields(uploadFields);
    return (req, res, next) => {
        upload(req, res, async (error) => {
            var _a, _b;
            if (error)
                return next(error);
            try {
                // Parse JSON data if exists
                if ((_a = req.body) === null || _a === void 0 ? void 0 : _a.data) {
                    req.body = JSON.parse(req.body.data);
                }
                // Process uploaded files
                if (req.files) {
                    const processedFiles = {};
                    const fieldsConfig = new Map(uploadFields.map(f => [f.name, f.maxCount]));
                    // Process each uploaded field
                    for (const [fieldName, files] of Object.entries(req.files)) {
                        const maxCount = (_b = fieldsConfig.get(fieldName)) !== null && _b !== void 0 ? _b : 1;
                        const fileArray = files;
                        const paths = [];
                        // Process each file - with image optimization for image types
                        for (const file of fileArray) {
                            const filePath = `/${fieldName}/${file.filename}`;
                            // Apply Sharp optimization for images
                            if ((fieldName === 'images' ||
                                fieldName === 'coverPhoto' ||
                                fieldName === 'portfolio') &&
                                file.mimetype.startsWith('image/')) {
                                try {
                                    const fullPath = path_1.default.join(uploadsDir, fieldName, file.filename);
                                    // Create Sharp instance
                                    let sharpInstance = (0, sharp_1.default)(fullPath).resize(800);
                                    // Preserve original format
                                    if (file.mimetype === 'image/png') {
                                        sharpInstance = sharpInstance.png({ quality: 80 });
                                    }
                                    else if (file.mimetype === 'image/webp') {
                                        sharpInstance = sharpInstance.webp({ quality: 80 });
                                    }
                                    else {
                                        sharpInstance = sharpInstance.jpeg({ quality: 80 });
                                    }
                                    // Optimize the image file
                                    await sharpInstance.toFile(fullPath + '.optimized');
                                    // Replace original with optimized version
                                    fs_1.default.unlinkSync(fullPath);
                                    fs_1.default.renameSync(fullPath + '.optimized', fullPath);
                                }
                                catch (err) {
                                    console.error('Image optimization failed:', err);
                                }
                            }
                            paths.push(filePath);
                        }
                        // Store as array or single value based on maxCount
                        processedFiles[fieldName] = maxCount > 1 ? paths : paths[0];
                    }
                    req.body = { ...req.body, ...processedFiles };
                }
                next();
            }
            catch (err) {
                next(err);
            }
        });
    };
};
exports.fileAndBodyProcessorUsingDiskStorage = fileAndBodyProcessorUsingDiskStorage;
