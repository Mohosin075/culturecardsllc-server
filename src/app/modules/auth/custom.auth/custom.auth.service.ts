import { StatusCodes } from 'http-status-codes'
import { User } from '../../user/user.model'
import { AuthHelper } from '../auth.helper'
import ApiError from '../../../../errors/ApiError'
import { USER_ROLES, USER_STATUS } from '../../../../enum/user'
import config from '../../../../config'
import { Token } from '../../token/token.model'
import { IAuthResponse, IResetPassword } from '../auth.interface'
import { emailTemplate } from '../../../../shared/emailTemplate'
import cryptoToken, { generateOtp } from '../../../../utils/crypto'
import bcrypt from 'bcrypt'
import { ILoginData } from '../../../../interfaces/auth'
import { AuthCommonServices, authResponse } from '../common'
import { jwtHelper } from '../../../../helpers/jwtHelper'
import { JwtPayload } from 'jsonwebtoken'
import { IUser } from '../../user/user.interface'
import { emailHelper } from '../../../../helpers/emailHelper'
// ProfessionalProfile removed
// import { emailQueue } from '../../../../helpers/bull-mq-producer'

const createUser = async (payload: IUser) => {
  payload.email = payload.email?.toLowerCase().trim()
  const isUserExist = await User.findOne({
    email: payload.email,
    status: { $nin: [USER_STATUS.DELETED] },
  })

  if (isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `An account with this email already exist, please login or try with another email.`,
    )
  }

  const otp = generateOtp()
  console.log({ otp }, 'create user')
  const otpExpiresIn = new Date(Date.now() + 5 * 60 * 1000)

  const authentication = {
    email: payload.email,
    oneTimeCode: otp,
    expiresAt: otpExpiresIn,
    latestRequestAt: new Date(),
    requestCount: 1,
    authType: 'createAccount',
    isVerified: false,
  }

  // Send email with OTP
  const createAccount = emailTemplate.createAccount({
    name: payload.name!,
    email: payload.email!.toLowerCase().trim(),
    otp,
  })

  emailHelper.sendEmail(createAccount)

  // Extract role from payload (if provided)
  const { role, ...userData } = payload as any

  // Initialize roles and activeRole based on signup choice
  const roles = [USER_ROLES.USER]
  let activeRole = USER_ROLES.USER

  if (role === USER_ROLES.PROFESSIONAL) {
    roles.push(USER_ROLES.PROFESSIONAL)
    activeRole = USER_ROLES.PROFESSIONAL
  }

  const user = await User.create({
    ...userData,
    roles,
    activeRole,
    password: payload.password,
    authentication,
  })

  // ProfessionalProfile creation logic removed

  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create user.')
  }

  return {
    success: true,
    message: 'Registration successful and OTP sent to your email',
    data: {
      email: user.email,
    },
  }
}

const customLogin = async (payload: ILoginData): Promise<IAuthResponse> => {
  const { email, phone } = payload
  const query = email ? { email: email.toLowerCase().trim() } : { phone: phone }

  const isUserExist = await User.findOne({
    ...query,
    status: { $in: [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE] },
  })
    .select('+password +authentication')
    .lean()
  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `No account found with this ${email ? 'email' : 'phone'}`,
    )
  }

  if (!isUserExist.password) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'It seems you have signed up using social login. Please use social login to access your account.',
    )
  }

  const result = await AuthCommonServices.handleLoginLogic(payload, isUserExist)

  return result
}

const adminLogin = async (payload: ILoginData): Promise<IAuthResponse> => {
  const { email, phone } = payload
  const query = email ? { email: email.trim().toLowerCase() } : { phone: phone }

  const isUserExist = await User.findOne({
    ...query,
  })
    .select('+password +authentication')
    .lean()
  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `No account found with this ${email ? 'email' : 'phone'}`,
    )
  }

  if (
    !isUserExist.roles.includes(USER_ROLES.ADMIN) &&
    !isUserExist.roles.includes(USER_ROLES.SUPER_ADMIN)
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You are not authorized to login as admin',
    )
  }

  const isPasswordMatch = await AuthHelper.isPasswordMatched(
    payload.password,
    isUserExist.password as string,
  )
  if (!isPasswordMatch) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      'Please try again with correct credentials.',
    )
  }

  //tokens
  const tokens = AuthHelper.createToken(
    isUserExist._id,
    isUserExist.activeRole,
    isUserExist.name!,
    isUserExist.email!,
  )

  return authResponse(
    StatusCodes.OK,
    `Welcome back ${isUserExist.name}`,
    isUserExist.activeRole,
    tokens.accessToken,
    tokens.refreshToken,
  )
}

const forgetPassword = async (email?: string, phone?: string) => {
  const query = email ? { email: email.toLowerCase().trim() } : { phone: phone }
  const isUserExist = await User.findOne({
    ...query,
    status: { $in: [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE] },
  })

  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'No account found with this email or phone',
    )
  }

  const otp = generateOtp()
  console.log({ otp }, 'forget password')
  if (phone) {
    //implement this feature using twilio/aws sns
  }

  const authentication = {
    email: isUserExist.email,
    resetPassword: true,
    oneTimeCode: otp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    latestRequestAt: new Date(),
    requestCount: 1,
    authType: 'resetPassword',
  }

  await User.findByIdAndUpdate(
    isUserExist._id,
    {
      $set: { authentication: authentication },
    },
    { new: true },
  )

  // //send otp to user
  if (email) {
    const forgetPasswordEmailTemplate = emailTemplate.resetPassword({
      name: isUserExist.name as string,
      email: isUserExist.email as string,
      otp,
    })

    emailHelper.sendEmail(forgetPasswordEmailTemplate)
  }

  return 'OTP sent successfully.'
}

const resetPassword = async (resetToken: string, payload: IResetPassword) => {
  const { newPassword, confirmPassword } = payload
  if (newPassword !== confirmPassword) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Passwords do not match')
  }

  const isTokenExist = await Token.findOne({ token: resetToken }).lean()

  if (!isTokenExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You don't have authorization to reset your password, please verify your account first.",
    )
  }

  const isUserExist = await User.findById(isTokenExist.user)
    .select('+authentication')
    .lean()

  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Something went wrong, please try again. or contact support.',
    )
  }

  const { authentication } = isUserExist
  if (!authentication?.resetPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You don\'t have permission to change the password. Please click again to "Forgot Password"',
    )
  }

  const isTokenValid = isTokenExist?.expireAt > new Date()
  if (!isTokenValid) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Your reset token has expired, please try again.',
    )
  }

  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  )
  const updatedUserData = {
    password: hashPassword,
    authentication: {
      resetPassword: false,
      otp: '',
      expiresAt: null,
      latestRequestAt: null,
      requestCount: 0,
      authType: '',
    },
  }

  await User.findByIdAndUpdate(
    isUserExist._id,
    { $set: updatedUserData },
    { new: true },
  )

  return { message: 'Password reset successfully' }
}

const verifyAccount = async (
  onetimeCode: string,
  email?: string,
  phone?: string,
): Promise<IAuthResponse> => {
  if (!onetimeCode) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP is required.')
  }

  const searchCriteria: any = {}
  if (email) searchCriteria.email = email.toLowerCase().trim()
  else if (phone) searchCriteria.phone = phone

  const isUserExist = await User.findOne({
    ...searchCriteria,
    status: { $nin: [USER_STATUS.DELETED] },
  })
    .select('+password +authentication')
    .lean()

  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `No account found with this ${email || phone}, please register first.`,
    )
  }

  const { authentication } = isUserExist

  //check the otp
  if (authentication?.oneTimeCode !== onetimeCode) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid OTP, please try again.',
    )
  }

  const currentDate = new Date()
  if (!authentication || !authentication.expiresAt || authentication.expiresAt < currentDate) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'OTP has expired, please try again.',
    )
  }

  //either newly created user or existing user
  if (!isUserExist.verified) {
    await User.findByIdAndUpdate(
      isUserExist._id,
      { $set: { verified: true } },
      { new: true },
    )

    const tokens = AuthHelper.createToken(
      isUserExist._id,
      isUserExist.activeRole,
      isUserExist.name!,
      isUserExist.email!,
    )

    return authResponse(
      StatusCodes.OK,
      `Welcome ${isUserExist.name} to our platform.`,
      isUserExist.activeRole,
      tokens.accessToken,
      tokens.refreshToken,
    )
  } else {
    await User.findByIdAndUpdate(
      isUserExist._id,
      {
        $set: {
          authentication: {
            oneTimeCode: '',
            expiresAt: null,
            latestRequestAt: null,
            requestCount: 0,
            authType: '',
            resetPassword: true,
          },
        },
      },
      { new: true },
    )

    const token = await Token.create({
      token: cryptoToken(),
      user: isUserExist._id,
      expireAt: new Date(Date.now() + 5 * 60 * 1000), // 15 minutes
    })

    if (!token) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Something went wrong, please try again. or contact support.',
      )
    }

    return authResponse(
      StatusCodes.OK,
      'OTP verified successfully, please reset your password.',
      undefined,
      undefined,
      undefined,
      token?.token,
    )
  }
}

const getRefreshToken = async (token: string) => {
  try {
    const decodedToken = jwtHelper.verifyToken(
      token,
      config.jwt.jwt_refresh_secret as string,
    )

    const { userId, authId, role } = decodedToken

    const tokens = AuthHelper.createToken(
      (userId || authId) as any,
      decodedToken.activeRole || role,
      decodedToken.name,
      decodedToken.email,
    )

    return {
      accessToken: tokens.accessToken,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh Token has expired')
    }
    throw new ApiError(StatusCodes.FORBIDDEN, 'Invalid Refresh Token')
  }
}

const socialLogin = async (
  appId: string,
  deviceToken: string,
): Promise<IAuthResponse> => {
  const isUserExist = await User.findOne({
    appId,
    status: { $in: [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE] },
  })
  if (!isUserExist) {
    const createdUser = await User.create({
      appId,
      deviceToken,
      status: USER_STATUS.ACTIVE,
      password: cryptoToken(),
    })
    if (!createdUser)
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create user.')
    const tokens = AuthHelper.createToken(
      createdUser._id,
      createdUser.roles[0],
      createdUser.activeRole,
      createdUser.name!,
      createdUser.email!,
    )
    return authResponse(
      StatusCodes.OK,
      `Welcome ${createdUser.name || ''} to our platform.`,
      createdUser.activeRole,
      tokens.accessToken,
      tokens.refreshToken,
    )
  } else {
    await User.findByIdAndUpdate(isUserExist._id, {
      $set: {
        deviceToken,
        status: USER_STATUS.ACTIVE,
        'authentication.restrictionLeftAt': null,
        'authentication.wrongLoginAttempts': 0,
      },
    })

    const tokens = AuthHelper.createToken(
      isUserExist._id,
      isUserExist.roles[0],
      isUserExist.activeRole,
      isUserExist.name!,
      isUserExist.email!,
    )
    //send token to client
    return authResponse(
      StatusCodes.OK,
      `Welcome back ${isUserExist.name || ''}`,
      isUserExist.activeRole,
      tokens.accessToken,
      tokens.refreshToken,
    )
  }
}

const deleteAccount = async (user: JwtPayload, password: string) => {
  const { userId } = user
  const isUserExist = await User.findById(userId).select('+password')
  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to delete account. Please try again.',
    )
  }

  if (isUserExist.status === USER_STATUS.DELETED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Requested user is already deleted.',
    )
  }

  const isPasswordMatched = await bcrypt.compare(password, isUserExist.password)

  if (!isPasswordMatched) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Please provide a valid password to delete your account.',
    )
  }

  const deletedData = await User.findByIdAndUpdate(userId, {
    $set: { status: USER_STATUS.DELETED },
  })

  return {
    status: StatusCodes.OK,
    message: 'Account deleted successfully.',
    deletedData,
  }
}

const resendOtp = async (
  authType: 'resetPassword' | 'createAccount',
  email?: string,
  phone?: string,
) => {
  const query = email ? { email: email.toLowerCase().trim() } : { phone: phone }
  const isUserExist = await User.findOne({
    ...query,
    status: { $in: [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE] },
  }).select('+authentication')
  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `No account found with this ${email ? 'email' : 'phone'}.`,
    )
  }

  const { authentication } = isUserExist
  if (authentication && (authentication.requestCount ?? 0) >= 5) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You have exceeded the maximum number of requests. Please try again later.',
    )
  }

  const otp = generateOtp()
  console.log({ otp }, 'resent otp')
  const authenticationPayload = {
    oneTimeCode: otp,
    latestRequestAt: new Date(),
    requestCount: (authentication?.requestCount || 0) + 1,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    authType,
  }

  await User.findByIdAndUpdate(
    isUserExist._id,
    {
      $set: { authentication: authenticationPayload },
    },
    { new: true },
  )

  if (email) {
    const otpTemplate =
      authType === 'createAccount'
        ? emailTemplate.createAccount({
            name: isUserExist.name!,
            email: isUserExist.email!,
            otp,
          })
        : emailTemplate.resetPassword({
            name: isUserExist.name!,
            email: isUserExist.email!,
            otp,
          })

    emailHelper.sendEmail(otpTemplate)
  }
}

const changePassword = async (
  user: JwtPayload,
  currentPassword: string,
  newPassword: string,
) => {
  // Find the user with password field
  const isUserExist = await User.findById(user.userId)
    .select('+password')
    .lean()

  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
  }

  // Check if current password matches
  const isPasswordMatch = await AuthHelper.isPasswordMatched(
    currentPassword,
    isUserExist.password as string,
  )

  if (!isPasswordMatch) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Current password is incorrect')
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  )

  // Update the password
  await User.findByIdAndUpdate(
    user.userId,
    { password: hashedPassword },
    { new: true },
  )

  return { message: 'Password changed successfully' }
}

export const CustomAuthServices = {
  adminLogin,
  forgetPassword,
  resetPassword,
  verifyAccount,
  customLogin,
  getRefreshToken,
  socialLogin,
  deleteAccount,
  resendOtp,
  changePassword,
  createUser,
}
