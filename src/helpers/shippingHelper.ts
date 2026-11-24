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

/**
 * Sets up the shipping side of a new order: weight and, when the order
 * carries none, a fallback shipping figure.
 *
 * It no longer invents a tracking number or draws a label. The seller buys a
 * real label from the order screen (ShippingServices.buyLabelForOrder), and
 * the tracking number comes from the carrier with it.
 */
export const initializeOrderShipping = async (orderData: any, product: any): Promise<void> => {
  orderData.shippingWeight = product.shippingWeight || 1

  if (!orderData.trackingDetails) {
    orderData.trackingDetails = { journeyUpdates: [] }
  }
  if (!orderData.trackingDetails.carrier) {
    orderData.trackingDetails.carrier = 'USPS'
  }

  // Fill in the shipping rate only when the order carries no figure of its
  // own. The buyer has already been charged by this point, so overwriting
  // what they paid would leave the order — and the seller's earnings — out of
  // step with the actual Stripe charge.
  if (orderData.amountDetails) {
    if (!orderData.amountDetails.shipping) {
      orderData.amountDetails.shipping = calculateShippingRate(
        orderData.shippingWeight,
      )
    }
    if (!orderData.amountDetails.totalPaid) {
      orderData.amountDetails.totalPaid = Number(
        (
          (orderData.amountDetails.itemSubtotal || 0) +
          (orderData.amountDetails.shipping || 0) +
          (orderData.amountDetails.taxes || 0) +
          (orderData.amountDetails.processingFee || 0) +
          (orderData.amountDetails.charityContribution || 0)
        ).toFixed(2),
      )
    }
  }
}

