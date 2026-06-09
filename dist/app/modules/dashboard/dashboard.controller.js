'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.dashboardController = void 0
const http_status_codes_1 = require('http-status-codes')
const dashboard_service_1 = require('./dashboard.service')
const catchAsync_1 = __importDefault(require('../../../shared/catchAsync'))
const sendResponse_1 = __importDefault(require('../../../shared/sendResponse'))
const getOverviewData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getOverviewData()
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Dashboard overview metrics retrieved successfully.',
    data: result,
  })
})
const getUsersData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getUsersData(
    req.query,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Users management data retrieved successfully.',
    data: result,
  })
})
const getSellerVerificationsData = (0, catchAsync_1.default)(
  async (req, res) => {
    const result =
      await dashboard_service_1.dashboardService.getSellerVerificationsData(
        req.query,
      )
    ;(0, sendResponse_1.default)(res, {
      statusCode: http_status_codes_1.StatusCodes.OK,
      success: true,
      message: 'Seller verifications retrieved successfully.',
      data: result,
    })
  },
)
const getListingsData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getListingsData(
    req.query,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Listings management data retrieved successfully.',
    data: result,
  })
})
const getLiveStreamsData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getLiveStreamsData(
    req.query,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Live streams data retrieved successfully.',
    data: result,
  })
})
const getTradesData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getTradesData(
    req.query,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Trades data retrieved successfully.',
    data: result,
  })
})
const getOrdersData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getOrdersData(
    req.query,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Orders data retrieved successfully.',
    data: result,
  })
})
const getDisputesData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getDisputesData(
    req.query,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Disputes data retrieved successfully.',
    data: result,
  })
})
const getPaymentsData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getPaymentsData(
    req.query,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Payments and revenue data retrieved successfully.',
    data: result,
  })
})
const getBoostedListingsData = (0, catchAsync_1.default)(async (req, res) => {
  const result =
    await dashboard_service_1.dashboardService.getBoostedListingsData(req.query)
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Boosted listings data retrieved successfully.',
    data: result,
  })
})
const getCategoriesData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getCategoriesData(
    req.query,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Categories management data retrieved successfully.',
    data: result,
  })
})
const getNotificationsData = (0, catchAsync_1.default)(async (req, res) => {
  const result =
    await dashboard_service_1.dashboardService.getNotificationsData(req.query)
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Notifications retrieved successfully.',
    data: result,
  })
})
const markAllNotificationsAsRead = (0, catchAsync_1.default)(
  async (req, res) => {
    const result =
      await dashboard_service_1.dashboardService.markAllNotificationsAsRead()
    ;(0, sendResponse_1.default)(res, {
      statusCode: http_status_codes_1.StatusCodes.OK,
      success: true,
      message: 'All notifications marked as read.',
      data: result,
    })
  },
)
const getReportsData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getReportsData(
    req.query,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Reports and analytics data retrieved successfully.',
    data: result,
  })
})
const getSettingsData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.getSettingsData()
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Platform settings retrieved successfully.',
    data: result,
  })
})
const updateSettingsData = (0, catchAsync_1.default)(async (req, res) => {
  const result = await dashboard_service_1.dashboardService.updateSettingsData(
    req.body,
  )
  ;(0, sendResponse_1.default)(res, {
    statusCode: http_status_codes_1.StatusCodes.OK,
    success: true,
    message: 'Platform settings updated successfully.',
    data: result,
  })
})
exports.dashboardController = {
  getOverviewData,
  getUsersData,
  getSellerVerificationsData,
  getListingsData,
  getLiveStreamsData,
  getTradesData,
  getOrdersData,
  getDisputesData,
  getPaymentsData,
  getBoostedListingsData,
  getCategoriesData,
  getNotificationsData,
  markAllNotificationsAsRead,
  getReportsData,
  getSettingsData,
  updateSettingsData,
}
