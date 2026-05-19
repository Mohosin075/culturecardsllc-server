import { Types } from 'mongoose'
import { Token } from './token.model'
const logout = async (userId: string) => {
  console.log('Logging out user with ID:', userId)
  const res = await Token.updateOne(
    {
      user: new Types.ObjectId(userId),
    },
    {
      expireAt: new Date(Date.now()),
      token: '',
    },
  )

  console.log({ res })

  return res
}
export const TokenServices = {
  logout,
}
