import PDFDocument from 'pdfkit'
import { IPayment } from '../app/modules/payment/payment.interface'

/**
 * Generates a professional PDF invoice buffer for a payment.
 * @param payment The payment document with populated userId and bookingId
 * @returns Promise<Buffer>
 */
export const generatePDFInvoice = async (
  payment: IPayment,
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const buffers: Buffer[] = []

    doc.on('data', buffers.push.bind(buffers))
    doc.on('end', () => {
      resolve(Buffer.concat(buffers))
    })
    doc.on('error', err => {
      reject(err)
    })

    const userData = payment.userId as any
    const bookingData = payment.bookingId as any

    // --- Header ---
    doc
      .fillColor('#444444')
      .fontSize(20)
      .text('PHOTOPYA', 50, 57)
      .fontSize(10)
      .text('Photopya Marketplace', 200, 50, { align: 'right' })
      .text('123 Digital Square', 200, 65, { align: 'right' })
      .text('Tech City, TC 10101', 200, 80, { align: 'right' })
      .moveDown()

    // --- Line Divider ---
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, 100)
      .lineTo(550, 100)
      .stroke()

    // --- Invoice Info ---
    doc.fillColor('#444444').fontSize(16).text('INVOICE', 50, 120)

    doc
      .fontSize(10)
      .text(`Invoice Number:`, 50, 145)
      .text(payment._id.toString().substring(0, 8).toUpperCase(), 150, 145)
      .text(`Invoice Date:`, 50, 160)
      .text(new Date(payment.createdAt).toLocaleDateString(), 150, 160)
      .text(`Payment Status:`, 50, 175)

    if (payment.status === 'succeeded') {
      doc.fillColor('#28a745').text(payment.status.toUpperCase(), 150, 175)
    } else {
      doc.fillColor('#dc3545').text(payment.status.toUpperCase(), 150, 175)
    }
    doc.fillColor('#444444')

    // --- Customer Info ---
    doc
      .fontSize(10)
      .text('BILL TO:', 350, 145, { underline: true })
      .text(userData?.name || 'Valued Customer', 350, 160)
      .text(userData?.email || payment.userEmail, 350, 175)
      .text(userData?.phone || '', 350, 190)

    doc.moveDown(4)

    // --- Table Header ---
    const tableTop = 240
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Description', 50, tableTop)
      .text('Transaction ID', 250, tableTop)
      .text('Amount', 450, tableTop, { align: 'right' })

    doc
      .strokeColor('#eeeeee')
      .lineWidth(1)
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke()

    // --- Table Item ---
    const itemRowTop = tableTop + 30
    doc
      .font('Helvetica')
      .fontSize(10)
      .text('Professional Booking Service', 50, itemRowTop)
      .text(payment.paymentIntentId || 'N/A', 250, itemRowTop)
      .text(
        `${payment.amount.toLocaleString()} ${payment.currency.toUpperCase()}`,
        450,
        itemRowTop,
        { align: 'right' },
      )

    // --- Totals ---
    const subtotalTop = itemRowTop + 50
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(350, subtotalTop)
      .lineTo(550, subtotalTop)
      .stroke()

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#000000')
      .text('Total Paid:', 350, subtotalTop + 15)
      .text(
        `${payment.amount.toLocaleString()} ${payment.currency.toUpperCase()}`,
        450,
        subtotalTop + 15,
        { align: 'right' },
      )

    // --- Footer ---
    doc
      .fontSize(10)
      .fillColor('#aaaaaa')
      .text(
        'Thank you for choosing Photopya. For assistance, contact support@photopya.com',
        50,
        700,
        { align: 'center', width: 500 },
      )

    doc.end()
  })
}
