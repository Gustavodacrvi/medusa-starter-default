
import { Router } from "express"
import CrossellingDiscountService from "../../services/crosselling-discount"

const router = Router()

router.get("/store/crosselling-discount", async (req, res) => {
	const cartId = req.query.cartId as string
	const variants = req.query.variants as string[]
	
	const collectionsService = req.scope.resolve("crossellingDiscountService") as CrossellingDiscountService
	res.json(await collectionsService.getOrCreateDiscount(cartId, variants))
})

export default router

