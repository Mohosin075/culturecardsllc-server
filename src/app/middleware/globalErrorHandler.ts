/* eslint-disable @typescript-eslint/no-unused-vars */
import { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import config from '../../config'
import { IGenericErrorMessage } from '../../interfaces/error'
import { ZodError } from 'zod'
import handleZodError from '../../errors/handleZodError'
import handleCastError from '../../errors/handleCastError'
import handleValidationError from '../../errors/handleValidationError'
import ApiError from '../../errors/ApiError'
import { errorLogger } from '../../shared/logger'

const globalErrorHandler: ErrorRequestHandler = (
  error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Safe logging using Winston
  if (config.node_env === 'development') {
    errorLogger.error(
      'Inside Global Error Handler🪐',
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    )
  }

  let statusCode = 500
  let message = 'Something went wrong!'
  let errorMessages: IGenericErrorMessage[] = []

  if (error?.name === 'ValidationError') {
    const simplifiedError = handleValidationError(error)
    statusCode = simplifiedError.statusCode
    message = simplifiedError.errorMessages[0]?.message || message
    errorMessages = simplifiedError.errorMessages
  } else if (error instanceof ZodError) {
    const simplifiedError = handleZodError(error)
    statusCode = simplifiedError.statusCode
    message = simplifiedError.errorMessages[0]?.message || message
    errorMessages = simplifiedError.errorMessages
  } else if (error?.name === 'CastError') {
    const simplifiedError = handleCastError(error)
    statusCode = simplifiedError.statusCode
    message = simplifiedError.message || message
    errorMessages = simplifiedError.errorMessages || []
  } else if (error?.code === 11000) {
    statusCode = 409
    const field = Object.keys(error.keyPattern)[0]
    message = `${field} already exists`
    errorMessages = [{ path: field, message }]
  } else if (error instanceof ApiError) {
    statusCode = error.statusCode || statusCode
    message = error.message || message
    errorMessages = error.message ? [{ path: '', message: error.message }] : []
  } else if (error instanceof Error) {
    message = error.message || message
    errorMessages = error.message ? [{ path: '', message: error.message }] : []
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorMessages,
    stack: config.node_env === 'production' ? undefined : error?.stack,
  })
}

export default globalErrorHandler
