
import { Router } from "express"
const router = Router()

router.get("/store/categories/three", async (req, res) => {
	const collectionsService = req.scope.resolve("threeCategoriesService")
	res.json({
		categories: await collectionsService.threeCategories()
	})
})

router.get("/store/categories/three/bestsellers", async (req, res) => {
	const filters = req.scope.resolve("productFiltersService")
	res.json({
		categories: await filters.categoryBestsellers()
	})
})

export default router

