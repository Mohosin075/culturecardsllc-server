import express from 'express'
import { ProductControllers } from './product.controller'
import validateRequest from '../../middleware/validateRequest'
import { ProductValidations } from './product.validation'

const router = express.Router()

router.post(
  '/',
  validateRequest(ProductValidations.createProductSchema),
  ProductControllers.createProduct,
)
router.get('/', ProductControllers.getAllProducts)
router.get('/:id', ProductControllers.getProductById)
router.patch(
  '/:id',
  validateRequest(ProductValidations.updateProductSchema),
  ProductControllers.updateProduct,
)
router.delete('/:id', ProductControllers.deleteProduct)

export const ProductRoutes = router
export default ProductRoutes
