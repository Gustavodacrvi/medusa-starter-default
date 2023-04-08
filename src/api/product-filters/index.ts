
import {ProductService} from "@medusajs/medusa"

import { Router } from "express"
const router = Router()


router.get("/store/products/handle/:handle", async (req, res) => {
	const productService = req.scope.resolve("productService") as ProductService
	res.json(await productService.retrieveByHandle(req.params.handle))
})


export default router

