import config from '../../../../config'
import { ShippingProvider } from '../shipping.interface'
import { easypostShippingProvider } from './easypost.provider'
import { mockShippingProvider } from './mock.provider'

/** SHIPPING_PROVIDER=easypost switches every caller over at once. */
export const getShippingProvider = (): ShippingProvider =>
  config.shipping.provider === 'easypost'
    ? easypostShippingProvider
    : mockShippingProvider
