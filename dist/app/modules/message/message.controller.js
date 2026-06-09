'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.MessageController = void 0
const catchAsync_1 = __importDefault(require('../../../shared/catchAsync'))
const sendResponse_1 = __importDefault(require('../../../shared/sendResponse'))
const http_status_codes_1 = require('http-status-codes')
const message_service_1 = require('./message.service')
const sendMessage = (0, catchAsync_1.default)(async (req, res) => {
  const user = req.user
  const message = await message_service_1.MessageService.sendMessageToDB(
    user.userId,
    req.body,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Send Message Successfully',
    data: message,
  })
})
const getMessage = (0, catchAsync_1.default)(async (req, res) => {
  const user = req.user
  const id = req.params.id
  console.log({ id }, 'chatId')
  const messages = await message_service_1.MessageService.getMessageFromDB(
    id,
    user,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Message Retrieve Successfully',
    data: messages,
  })
})
exports.MessageController = { sendMessage, getMessage }
