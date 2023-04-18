
import { Router } from "express"
const router = Router()

router.get("/store/cart/validate/:cartId", async (req, res) => {
	const cartUtilityService = req.scope.resolve("cartUtilityService")
	res.json(await cartUtilityService.isCartValid(req.params.cartId as string))
})

export default router

