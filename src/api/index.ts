import { Router } from "express"

const bodyParser = require("body-parser")

import Collections from "./categories/"
import ProductFilters from "./product-filters/"
import MagentoImport from "./trigger-magento-import/"
import Cart from "./cart/"
import Mollie from "./mollie/"
import CrossellingDiscount from "./crosselling-discount/"

export default () => {
	const router = Router()
	
	// parse application/x-www-form-urlencoded
	router.use(bodyParser.urlencoded({ extended: false }))
	// parse application/json
	router.use(bodyParser.json())
	
	router.use('/', Collections)
	router.use('/', ProductFilters)
	router.use('/', MagentoImport)
	router.use('/', Cart)
	router.use('/', Mollie)
	router.use('/', CrossellingDiscount)
	
	return router;
}