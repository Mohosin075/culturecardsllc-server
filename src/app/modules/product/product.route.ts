import express from 'express'
import { ProductControllers } from './product.controller'
import validateRequest from '../../middleware/validateRequest'
import { ProductValidations } from './product.validation'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

router.post(
  '/',
  auth(USER_ROLES.SELLER, USER_ROLES.BUYER),
  validateRequest(ProductValidations.createProductSchema),
  ProductControllers.createProduct,
)
router.get('/', ProductControllers.getAllProducts)
router.get('/:id', ProductControllers.getProductById)
router.patch(
  '/:id',
  auth(USER_ROLES.SELLER, USER_ROLES.BUYER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(ProductValidations.updateProductSchema),
  ProductControllers.updateProduct,
)
router.delete(
  '/:id',
  auth(USER_ROLES.SELLER, USER_ROLES.BUYER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  ProductControllers.deleteProduct,
)
router.post(
  '/:id/boost',
  auth(USER_ROLES.SELLER, USER_ROLES.BUYER),
  ProductControllers.boostProduct,
)
router.patch('/:id/share', ProductControllers.incrementShareCount)

export const ProductRoutes = router
export default ProductRoutes
