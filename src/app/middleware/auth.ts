import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { Secret, JwtPayload } from 'jsonwebtoken'
import config from '../../config'
import { jwtHelper } from '../../helpers/jwtHelper'
import ApiError from '../../errors/ApiError'
import { User } from '../modules/user/user.model'
import { USER_STATUS } from '../../enum/user'

type IVerifyUser = {
  userId?: string
  authId?: string
  role?: string
  activeRole?: string
  user?: { role?: string }
  data?: { role?: string }
} & JwtPayload

const auth =
  (...roles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokenWithBearer = req.headers.authorization

      if (!tokenWithBearer) {
        return next(new ApiError(StatusCodes.UNAUTHORIZED, 'Token not found!'))
      }

      if (!tokenWithBearer.startsWith('Bearer')) {
        return next(
          new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token format'),
        )
      }

      const token = tokenWithBearer.split(' ')[1]

      if (!token) {
        return next(
          new ApiError(StatusCodes.UNAUTHORIZED, 'Token missing after Bearer'),
        )
      }

      let verifyUser: IVerifyUser

      // FIRST: decode token
      try {
        verifyUser = jwtHelper.verifyToken(
          token,
          config.jwt.jwt_secret as Secret,
        ) as IVerifyUser
        // console.log({verifyUser})
        // Ensure userId is present even for older tokens
        if (!verifyUser.userId && verifyUser.authId) {
          verifyUser.userId = verifyUser.authId
        }
        // Normalize role fields for compatibility across token versions
        if (verifyUser.activeRole && !verifyUser.role) {
          verifyUser.role = verifyUser.activeRole
        }
        if (verifyUser.role && !verifyUser.activeRole) {
          verifyUser.activeRole = verifyUser.role
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'TokenExpiredError') {
          return next(
            new ApiError(StatusCodes.UNAUTHORIZED, 'Access Token has expired'),
          )
        }

        return next(new ApiError(StatusCodes.FORBIDDEN, 'Invalid Access Token'))
      }

      // VERIFY USER STATUS IN DB

      const userStatusCheck = await User.findById(verifyUser.userId)
        .select('status')
        .lean()
      if (!userStatusCheck) {
        return next(
          new ApiError(StatusCodes.UNAUTHORIZED, 'User does not exist'),
        )
      }
      if (userStatusCheck.status === USER_STATUS.INACTIVE) {
        return next(
          new ApiError(
            StatusCodes.FORBIDDEN,
            'Your account is inactive. Please log in again to reactivate it.',
          ),
        )
      }
      if (userStatusCheck.status === USER_STATUS.DELETED) {
        return next(
          new ApiError(StatusCodes.FORBIDDEN, 'Your account is deleted.'),
        )
      }

      // Attach to req
      req.user = verifyUser

      // SECOND: role check
      if (roles.length > 0) {
        const userRole =
          verifyUser.activeRole ||
          verifyUser.role ||
          verifyUser.user?.role ||
          verifyUser.data?.role

        if (!userRole) {
          return next(
            new ApiError(StatusCodes.FORBIDDEN, 'User role missing in token'),
          )
        }

        console.log({ userRole })

        if (!roles.includes(userRole)) {
          return next(
            new ApiError(
              StatusCodes.FORBIDDEN,
              "You don't have permission to access this API",
            ),
          )
        }
      }

      // SUCCESS
      return next()
    } catch (error) {
      return next(error)
    }
  }

export default auth

//this temp auth middleware is created for temporary user verification before creating a new user
//in the future, we will use the auth middleware above

export const tempAuth =
  (...roles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokenWithBearer = req.headers.authorization

      if (!tokenWithBearer) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Token not found!')
      }

      if (tokenWithBearer && tokenWithBearer.startsWith('Bearer')) {
        const token = tokenWithBearer.split(' ')[1]

        try {
          // Verify token
          const verifyUser = jwtHelper.verifyToken(
            token,
            config.jwt.temp_jwt_secret as Secret,
          )

          // Set user to header
          req.user = verifyUser

          // Guard user
          if (
            roles.length &&
            !roles.includes(verifyUser.activeRole || verifyUser.role)
          ) {
            throw new ApiError(
              StatusCodes.FORBIDDEN,
              "You don't have permission to access this API",
            )
          }

          next()
        } catch (error) {
          if (error instanceof Error && error.name === 'TokenExpiredError') {
            throw new ApiError(
              StatusCodes.UNAUTHORIZED,
              'Access Token has expired',
            )
          }
          next(error)
          throw new ApiError(StatusCodes.FORBIDDEN, 'Invalid Access Token')
        }
      }
    } catch (error) {
      next(error)
    }
  }
