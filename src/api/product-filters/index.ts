
import { Router } from "express"
const router = Router()

router.get("/store/collection/bestsellers", async (req, res) => {
	const filters = req.scope.resolve("productFiltersService")
	res.json({
		collections: await filters.collectionBestsellers()
	})
})

export default router

