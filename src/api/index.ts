import { Router } from "express"

import Collections from "./categories/"
import ProductFilters from "./product-filters/"
import MagentoImport from "./trigger-magento-import/"
import Cart from "./cart/"
import Mollie from "./mollie/"

export default () => {
	const router = Router()
	
	router.use('/', Collections)
	router.use('/', ProductFilters)
	router.use('/', MagentoImport)
	router.use('/', Cart)
	router.use('/', Mollie)
	
	return router;
}