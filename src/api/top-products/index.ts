
import { Router } from "express"
const router = Router()

router.get("/store/top-products", async (req, res) => {
	const topProductsService = req.scope.resolve("topProductsService")
	res.json({
		products: await topProductsService.getTopProducts()
	})
})

export default router

