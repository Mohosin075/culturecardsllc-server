"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeOrderShipping = exports.calculateShippingRate = exports.generateMockShippingLabel = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
/**
 * Generates a professional 4x6 mock shipping label PDF buffer.
 */
const generateMockShippingLabel = async (details) => {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ size: [288, 432], margin: 10 }); // 4x6 inches in points
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
        // Draw outer borders
        doc.lineWidth(2).rect(5, 5, 278, 422).stroke();
        // Carrier Header
        doc.fontSize(16).font('Helvetica-Bold').text(details.carrier.toUpperCase(), 15, 15);
        doc.lineWidth(1).moveTo(5, 45).lineTo(283, 45).stroke();
        // FROM ADDRESS
        doc.fontSize(8).font('Helvetica-Bold').text('FROM:', 15, 55);
        doc.font('Helvetica').fontSize(8)
            .text(details.fromName, 15, 65)
            .text(details.fromAddress, 15, 75);
        doc.lineWidth(1).moveTo(5, 105).lineTo(283, 105).stroke();
        // TO ADDRESS
        doc.fontSize(10).font('Helvetica-Bold').text('TO:', 15, 115);
        doc.font('Helvetica-Bold').fontSize(11)
            .text(details.toName, 15, 130);
        doc.font('Helvetica').fontSize(10)
            .text(details.toAddress, 15, 145);
        doc.lineWidth(1).moveTo(5, 210).lineTo(283, 210).stroke();
        // SHIP WEIGHT & DATE
        doc.fontSize(9).font('Helvetica-Bold')
            .text(`WEIGHT: ${details.weight || 1} LBS`, 15, 220)
            .text(`DATE: ${new Date().toLocaleDateString()}`, 150, 220);
        doc.lineWidth(1).moveTo(5, 240).lineTo(283, 240).stroke();
        // BARCODE SECTION (Simulate barcodes using vertical lines)
        doc.fontSize(8).font('Helvetica-Bold').text('TRACKING #:', 15, 250);
        doc.fontSize(10).text(details.trackingNumber, 15, 260, { align: 'center', width: 258 });
        let barcodeX = 35;
        const barcodeY = 280;
        const barcodeHeight = 75;
        // Draw barcode patterns
        for (let i = 0; i < 45; i++) {
            const lineWidth = (i % 3 === 0 || i % 7 === 0) ? 3 : 1;
            const spacing = (i % 5 === 0) ? 4 : 2;
            doc.lineWidth(lineWidth).moveTo(barcodeX, barcodeY).lineTo(barcodeX, barcodeY + barcodeHeight).stroke();
            barcodeX += lineWidth + spacing;
        }
        // Carrier Delivery Class
        doc.lineWidth(1).moveTo(5, 375).lineTo(283, 375).stroke();
        doc.fontSize(14).font('Helvetica-Bold').text('PRIORITY MAIL 3-DAY', 15, 385, { align: 'center', width: 258 });
        doc.end();
    });
};
exports.generateMockShippingLabel = generateMockShippingLabel;
/**
 * Calculates a mock shipping rate based on the item weight.
 */
const calculateShippingRate = (weight) => {
    const baseRate = 5.00;
    const ratePerLb = 0.50;
    const itemWeight = weight && weight > 0 ? weight : 1;
    return Number((baseRate + (itemWeight * ratePerLb)).toFixed(2));
};
exports.calculateShippingRate = calculateShippingRate;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Initializes shipping weight, rates, tracking, and generates PDF label on disk.
 */
const initializeOrderShipping = async (orderData, product) => {
    // Set weight
    orderData.shippingWeight = product.shippingWeight || 1;
    // Set tracking info if missing
    if (!orderData.trackingDetails) {
        orderData.trackingDetails = { journeyUpdates: [] };
    }
    if (!orderData.trackingDetails.carrier) {
        orderData.trackingDetails.carrier = 'USPS';
    }
    if (!orderData.trackingDetails.trackingNumber) {
        orderData.trackingDetails.trackingNumber = `USPS-CC-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    }
    // Set label URL
    orderData.shippingLabelUrl = `/uploads/labels/label-${orderData.trackingDetails.trackingNumber}.pdf`;
    // Calculate rate
    const shippingCost = (0, exports.calculateShippingRate)(orderData.shippingWeight);
    if (orderData.amountDetails) {
        orderData.amountDetails.shipping = shippingCost;
        orderData.amountDetails.totalPaid = Number(((orderData.amountDetails.itemSubtotal || 0) +
            shippingCost +
            (orderData.amountDetails.taxes || 0) +
            (orderData.amountDetails.processingFee || 0) +
            (orderData.amountDetails.charityContribution || 0)).toFixed(2));
    }
    // Generate label PDF file
    try {
        const toAddressStr = orderData.shippingAddress
            ? `${orderData.shippingAddress.street}, ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.postalCode}`
            : 'Address Pending';
        const labelBuffer = await (0, exports.generateMockShippingLabel)({
            carrier: orderData.trackingDetails.carrier,
            trackingNumber: orderData.trackingDetails.trackingNumber,
            fromName: 'CultureCards LLC (Central Warehouse)',
            fromAddress: '123 Collectors Square, Card Town, CC 10101',
            toName: 'Valued Customer',
            toAddress: toAddressStr,
            weight: orderData.shippingWeight
        });
        const labelsDir = path_1.default.join(process.cwd(), 'uploads', 'labels');
        if (!fs_1.default.existsSync(labelsDir)) {
            fs_1.default.mkdirSync(labelsDir, { recursive: true });
        }
        fs_1.default.writeFileSync(path_1.default.join(labelsDir, `label-${orderData.trackingDetails.trackingNumber}.pdf`), labelBuffer);
    }
    catch (error) {
        console.error('Failed to generate shipping label PDF:', error);
    }
};
exports.initializeOrderShipping = initializeOrderShipping;
