
import { Router } from "express"
const router = Router()

router.get("/store/aggregated-categories", async (req, res) => {
	const collectionsService = req.scope.resolve("aggregateCollectionsService")
	res.json({
		collections: await collectionsService.aggregatedCollections()
	})
})

export default router

