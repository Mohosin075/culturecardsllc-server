import PDFDocument from 'pdfkit'

/**
 * Generates a professional 4x6 mock shipping label PDF buffer.
 */
export const generateMockShippingLabel = async (details: {
  carrier: string
  trackingNumber: string
  fromName: string
  fromAddress: string
  toName: string
  toAddress: string
  weight: number
}): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [288, 432], margin: 10 }) // 4x6 inches in points
    const buffers: Buffer[] = []

    doc.on('data', buffers.push.bind(buffers))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    // Draw outer borders
    doc.lineWidth(2).rect(5, 5, 278, 422).stroke()

    // Carrier Header
    doc.fontSize(16).font('Helvetica-Bold').text(details.carrier.toUpperCase(), 15, 15)
    
    doc.lineWidth(1).moveTo(5, 45).lineTo(283, 45).stroke()

    // FROM ADDRESS
    doc.fontSize(8).font('Helvetica-Bold').text('FROM:', 15, 55)
    doc.font('Helvetica').fontSize(8)
      .text(details.fromName, 15, 65)
      .text(details.fromAddress, 15, 75)

    doc.lineWidth(1).moveTo(5, 105).lineTo(283, 105).stroke()

    // TO ADDRESS
    doc.fontSize(10).font('Helvetica-Bold').text('TO:', 15, 115)
    doc.font('Helvetica-Bold').fontSize(11)
      .text(details.toName, 15, 130)
    doc.font('Helvetica').fontSize(10)
      .text(details.toAddress, 15, 145)

    doc.lineWidth(1).moveTo(5, 210).lineTo(283, 210).stroke()

    // SHIP WEIGHT & DATE
    doc.fontSize(9).font('Helvetica-Bold')
      .text(`WEIGHT: ${details.weight || 1} LBS`, 15, 220)
      .text(`DATE: ${new Date().toLocaleDateString()}`, 150, 220)

    doc.lineWidth(1).moveTo(5, 240).lineTo(283, 240).stroke()

    // BARCODE SECTION (Simulate barcodes using vertical lines)
    doc.fontSize(8).font('Helvetica-Bold').text('TRACKING #:', 15, 250)
    doc.fontSize(10).text(details.trackingNumber, 15, 260, { align: 'center', width: 258 })

    let barcodeX = 35
    const barcodeY = 280
    const barcodeHeight = 75
    
    // Draw barcode patterns
    for (let i = 0; i < 45; i++) {
      const lineWidth = (i % 3 === 0 || i % 7 === 0) ? 3 : 1
      const spacing = (i % 5 === 0) ? 4 : 2
      doc.lineWidth(lineWidth).moveTo(barcodeX, barcodeY).lineTo(barcodeX, barcodeY + barcodeHeight).stroke()
      barcodeX += lineWidth + spacing
    }

    // Carrier Delivery Class
    doc.lineWidth(1).moveTo(5, 375).lineTo(283, 375).stroke()
    doc.fontSize(14).font('Helvetica-Bold').text('PRIORITY MAIL 3-DAY', 15, 385, { align: 'center', width: 258 })

    doc.end()
  })
}

/**
 * Calculates a mock shipping rate based on the item weight.
 */
export const calculateShippingRate = (weight: number): number => {
  const baseRate = 5.00
  const ratePerLb = 0.50
  const itemWeight = weight && weight > 0 ? weight : 1
  return Number((baseRate + (itemWeight * ratePerLb)).toFixed(2))
}

import fs from 'fs'
import path from 'path'

/**
 * Initializes shipping weight, rates, tracking, and generates PDF label on disk.
 */
export const initializeOrderShipping = async (orderData: any, product: any): Promise<void> => {
  // Set weight
  orderData.shippingWeight = product.shippingWeight || 1

  // Set tracking info if missing
  if (!orderData.trackingDetails) {
    orderData.trackingDetails = { journeyUpdates: [] }
  }
  if (!orderData.trackingDetails.carrier) {
    orderData.trackingDetails.carrier = 'USPS'
  }
  if (!orderData.trackingDetails.trackingNumber) {
    orderData.trackingDetails.trackingNumber = `USPS-CC-${Math.floor(1000000000 + Math.random() * 9000000000)}`
  }

  // Set label URL
  orderData.shippingLabelUrl = `/uploads/labels/label-${orderData.trackingDetails.trackingNumber}.pdf`

  // Calculate rate
  const shippingCost = calculateShippingRate(orderData.shippingWeight)
  if (orderData.amountDetails) {
    orderData.amountDetails.shipping = shippingCost
    orderData.amountDetails.totalPaid = Number(
      (
        (orderData.amountDetails.itemSubtotal || 0) +
        shippingCost +
        (orderData.amountDetails.taxes || 0) +
        (orderData.amountDetails.processingFee || 0) +
        (orderData.amountDetails.charityContribution || 0)
      ).toFixed(2)
    )
  }

  // Generate label PDF file
  try {
    const toAddressStr = orderData.shippingAddress
      ? `${orderData.shippingAddress.street}, ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.postalCode}`
      : 'Address Pending'

    const labelBuffer = await generateMockShippingLabel({
      carrier: orderData.trackingDetails.carrier,
      trackingNumber: orderData.trackingDetails.trackingNumber,
      fromName: 'CultureCards LLC (Central Warehouse)',
      fromAddress: '123 Collectors Square, Card Town, CC 10101',
      toName: 'Valued Customer',
      toAddress: toAddressStr,
      weight: orderData.shippingWeight
    })

    const labelsDir = path.join(process.cwd(), 'uploads', 'labels')
    if (!fs.existsSync(labelsDir)) {
      fs.mkdirSync(labelsDir, { recursive: true })
    }
    fs.writeFileSync(path.join(labelsDir, `label-${orderData.trackingDetails.trackingNumber}.pdf`), labelBuffer)
  } catch (error) {
    console.error('Failed to generate shipping label PDF:', error)
  }
}

