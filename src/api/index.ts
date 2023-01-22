import { Router } from "express"

import Collections from "./collections/"
import TopProducts from "./top-products/"
import ProductFilters from "./product-filters/"

export default () => {
	const router = Router()
	
	router.use('/', Collections)
	router.use('/', TopProducts)
	router.use('/', ProductFilters)
	
	return router;
}