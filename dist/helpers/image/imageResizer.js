"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sharp_1 = __importDefault(require("sharp"));
const optimizeImage = async (file, options = {}) => {
    const { resize = false, width = 1024, quality = 80 } = options;
    // Detect the file format from the MIME type
    const format = await (0, sharp_1.default)(file)
        .metadata()
        .then(metadata => metadata.format);
    let image = (0, sharp_1.default)(file);
    // Resize if the resize option is set to true
    if (resize) {
        image = image.resize(width);
    }
    // Apply quality settings based on the image format
    if (format === 'jpeg' || format === 'jpg') {
        image = image.jpeg({ quality });
    }
    else if (format === 'png') {
        image = image.png({ quality: Math.round(quality / 10) }); // PNG quality ranges 0-9 (sharp uses 0-9)
    }
    else if (format === 'webp') {
        image = image.webp({ quality });
    }
    else {
        throw new Error('Unsupported image format');
    }
    // Convert the image to a buffer and return the optimized image
    const optimizedImage = await image.toBuffer();
    return optimizedImage;
};
exports.default = optimizeImage;
