import { StatusCodes } from 'http-status-codes'
import { ILoginData } from '../../../interfaces/auth'
import ApiError from '../../../errors/ApiError'
import { USER_STATUS } from '../../../enum/user'
import { User } from '../user/user.model'
import { AuthHelper } from './auth.helper'
import { generateOtp } from '../../../utils/crypto'
import { IAuthResponse } from './auth.interface'
import { IUser } from '../user/user.interface'
import { emailTemplate } from '../../../shared/emailTemplate'
import { emailHelper } from '../../../helpers/emailHelper'
// import { emailQueue } from '../../../helpers/bull-mq-producer'

const handleLoginLogic = async (
  payload: ILoginData,
  isUserExist: IUser,
): Promise<IAuthResponse> => {
  const { authentication, verified, status, password } = isUserExist

  const { restrictionLeftAt, wrongLoginAttempts } = authentication

  if (!verified) {
    //send otp to user

    const otp = generateOtp()
    console.log({ otp })
    const otpExpiresIn = new Date(Date.now() + 5 * 60 * 1000)

    const authentication = {
      email: payload.email,
      oneTimeCode: otp,
      expiresAt: otpExpiresIn,
      latestRequestAt: new Date(),
      authType: 'createAccount',
    }

    await User.findByIdAndUpdate(isUserExist._id, {
      $set: {
        authentication,
      },
    })

    const otpTemplate = emailTemplate.createAccount({
      name: isUserExist.name!,
      email: isUserExist.email!,
      otp,
    })

    emailHelper.sendEmail(otpTemplate)

    // emailQueue.add('emails', otpTemplate)

    return authResponse(
      StatusCodes.PROXY_AUTHENTICATION_REQUIRED,
      `An OTP has been sent to your ${payload.email}. Please verify.`,
    )
  }

  if (status === USER_STATUS.DELETED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'No account found with this email',
    )
  }

  if (status === USER_STATUS.INACTIVE) {
    if (restrictionLeftAt && new Date() < restrictionLeftAt) {
      const remainingMinutes = Math.ceil(
        (restrictionLeftAt.getTime() - Date.now()) / 60000,
      )
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        `You are restricted to login for ${remainingMinutes} minutes`,
      )
    }
  }

  const isPasswordMatched = await User.isPasswordMatched(
    payload.password,
    password,
  )

  if (!isPasswordMatched) {
    isUserExist.authentication.wrongLoginAttempts = wrongLoginAttempts + 1

    if (isUserExist.authentication.wrongLoginAttempts >= 5) {
      isUserExist.status = USER_STATUS.INACTIVE
      isUserExist.authentication.restrictionLeftAt = new Date(
        Date.now() + 10 * 60 * 1000,
      ) // restriction for 10 minutes
    }

    await User.findByIdAndUpdate(isUserExist._id, {
      $set: {
        status: isUserExist.status,
        'authentication.restrictionLeftAt':
          isUserExist.authentication.restrictionLeftAt,
        'authentication.wrongLoginAttempts':
          isUserExist.authentication.wrongLoginAttempts,
      },
    })

    if (isUserExist.status === USER_STATUS.INACTIVE) {
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        'Too many incorrect password attempts. Your account has been restricted for 10 minutes.',
      )
    }

    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Incorrect password, please try again.',
    )
  }

  await User.findByIdAndUpdate(isUserExist._id, {
    $set: {
      status: USER_STATUS.ACTIVE,
      deviceToken: payload.deviceToken,
      'authentication.restrictionLeftAt': null,
      'authentication.wrongLoginAttempts': 0,
    },
  })
  const rememberMe = payload.rememberMe || false

  const tokens = AuthHelper.createToken(
    isUserExist._id,
    isUserExist.activeRole,
    isUserExist.name!,
    isUserExist.email!,
    payload.deviceToken,
    rememberMe,
  )

  return authResponse(
    StatusCodes.OK,
    `Welcome back ${isUserExist.name}`,
    isUserExist.activeRole,
    tokens.accessToken,
    tokens.refreshToken,
  )
}

export const AuthCommonServices = {
  handleLoginLogic,
}

export const authResponse = (
  status: number,
  message: string,
  role?: string,
  accessToken?: string,
  refreshToken?: string,
  token?: string,
): IAuthResponse => {
  return {
    status,
    message,
    ...(role && { role }),
    ...(role && { activeRole: role }),
    ...(accessToken && { accessToken }),
    ...(refreshToken && { refreshToken }),
    ...(token && { token }),
  }
}
