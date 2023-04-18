import { Router } from "express"

import Collections from "./categories/"
import ProductFilters from "./product-filters/"
import MagentoImport from "./trigger-magento-import/"
import Cart from "./cart/"

export default () => {
	const router = Router()
	
	router.use('/', Collections)
	router.use('/', ProductFilters)
	router.use('/', MagentoImport)
	router.use('/', Cart)
	
	return router;
}