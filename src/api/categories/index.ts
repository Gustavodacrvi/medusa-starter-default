
import { Router } from "express"
const router = Router()

router.get("/store/categories/three", async (req, res) => {
	const collectionsService = req.scope.resolve("threeCategoriesService")
	res.json(await collectionsService.threeCategories())
})

router.get("/store/categories/handle/:handle", async (req, res) => {
	const collectionsService = req.scope.resolve("threeCategoriesService")
	res.json(await collectionsService.getCategoryByHandle(req.params.handle))
})

export default router

