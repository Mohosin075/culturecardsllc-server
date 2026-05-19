import { Secret } from 'jsonwebtoken'
import { jwtHelper } from '../../../helpers/jwtHelper'
import config from '../../../config'
import { Types } from 'mongoose'
import bcrypt from 'bcrypt'

const createToken = (
  userId: Types.ObjectId,
  activeRole: string,
  name?: string,
  email?: string,
  deviceToken?: string,
  rememberMe?: boolean,
) => {
  const accessToken = jwtHelper.createToken(
    { userId, authId: userId, activeRole, name, email, deviceToken },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as string,
  )

  const refreshExpiry = rememberMe
    ? (config.jwt.jwt_refresh_expire_long as string)
    : (config.jwt.jwt_refresh_expire_in as string)

  const refreshToken = jwtHelper.createToken(
    { userId, authId: userId, activeRole, name, email, deviceToken },
    config.jwt.jwt_refresh_secret as Secret,
    refreshExpiry as string,
  )

  return { accessToken, refreshToken }
}

const tempAccessToken = (
  userId: Types.ObjectId,
  role: string,
  activeRole: string,
  name?: string,
  email?: string,
  deviceToken?: string,
) => {
  const accessToken = jwtHelper.createToken(
    { userId, authId: userId, role, name, email, deviceToken },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as string,
  )

  return { accessToken }
}

const isPasswordMatched = async (
  plainTextPassword: string,
  hashedPassword: string,
) => {
  return await bcrypt.compare(plainTextPassword, hashedPassword)
}

export const AuthHelper = { createToken, tempAccessToken, isPasswordMatched }
