import express from 'express'
import { CategoryController } from './category.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'
import validateRequest from '../../middleware/validateRequest'
import {
  createCategorySchema,
  updateCategorySchema,
} from './category.validation'
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody'

const router = express.Router()

router.get('/popular-categories', CategoryController.getPopularCategories)
router.get(
  '/trending-subcategories',
  CategoryController.getTrendingSubcategories,
)

router
  .route('/')
  .get(CategoryController.getAllCategories)
  .post(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
    fileAndBodyProcessorUsingDiskStorage(),
    validateRequest(createCategorySchema),
    CategoryController.createCategory,
  )

router
  .route('/:id')
  .get(CategoryController.getSingleCategory)
  .patch(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
    fileAndBodyProcessorUsingDiskStorage(),
    validateRequest(updateCategorySchema),
    CategoryController.updateCategory,
  )
  .delete(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
    CategoryController.deleteCategory,
  )

export const CategoryRoutes = router
