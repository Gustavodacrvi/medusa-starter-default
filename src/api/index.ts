import { Router } from "express"

import Collections from "./collections/"
import TopProducts from "./top-products/"

export default () => {
	const router = Router()
	
	router.use('/', Collections)
	router.use('/', TopProducts)
	
	return router;
}