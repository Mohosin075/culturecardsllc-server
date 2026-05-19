import { USER_ROLES } from '../../../enum/user'
import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { NotificationServices } from './notification.service'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import pick from '../../../shared/pick'
import { INotificationFilterables } from './notification.interface'
import { notificationFilterableFields } from './notification.constant'
import { paginationFields } from '../../../interfaces/pagination'
import { JwtPayload } from 'jsonwebtoken'

const createNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationServices.createNotification(req.body)

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Notification created successfully',
    data: result,
  })
})

const getAllNotifications = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user
  const filters = pick(
    req.query,
    notificationFilterableFields,
  ) as INotificationFilterables
  const paginationOptions = pick(req.query, paginationFields)

  const result = await NotificationServices.getAllNotifications(
    user,
    filters,
    paginationOptions,
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notifications retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user
  const paginationOptions = pick(req.query, paginationFields)

  const result = await NotificationServices.getMyNotifications(
    user,
    paginationOptions,
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'My notifications retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const getNotificationById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const result = await NotificationServices.getNotificationById(id)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification retrieved successfully',
    data: result,
  })
})

const updateNotification = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const user = (req as any).user

  const result = await NotificationServices.updateNotification(
    id,
    req.body,
    user.activeRole === USER_ROLES.USER ||
      user.activeRole === USER_ROLES.PROFESSIONAL
      ? user.userId
      : undefined,
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification updated successfully',
    data: result,
  })
})

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const user = (req as any).user

  const result = await NotificationServices.markAsRead(id, user.userId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification marked as read',
    data: result,
  })
})

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload

  console.log({ user })

  const result = await NotificationServices.markAllAsRead(user.userId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'All notifications marked as read',
    data: result,
  })
})

const archiveNotification = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const user = (req as any).user

  const result = await NotificationServices.archiveNotification(id, user.userId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification archived',
    data: result,
  })
})

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params

  const result = await NotificationServices.deleteNotification(id)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification deleted successfully',
    data: result,
  })
})

const getNotificationStats = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user

  const result = await NotificationServices.getNotificationStats(user)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification statistics retrieved',
    data: result,
  })
})

const sendTestEmail = catchAsync(async (req: Request, res: Response) => {
  const { to, template } = req.body

  const result = await NotificationServices.sendTestEmail(to, template)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Test email sent successfully',
    data: result,
  })
})

export const NotificationController = {
  createNotification,
  getAllNotifications,
  getMyNotifications,
  getNotificationById,
  updateNotification,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  deleteNotification,
  getNotificationStats,
  sendTestEmail,
}
