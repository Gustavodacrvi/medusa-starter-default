
import { Router } from "express"
const router = Router()

router.get("/store/trigger-magento-import", async (req, res) => {
	const magentoImportService = req.scope.resolve("importFromMagentoService")
	/* Only CATEGORY and PRODUCTS import implemented */
	
	/*const form = new FormData()
	
	form.append("url", "https://backoffice2.hadiethshop.nl/")
	form.append("email", "superadmin@local.host")
	form.append("password", "supertest1")*/
	
	await magentoImportService.initiateImport({
		url: "https://backoffice2.hadiethshop.nl",
		email: "superadmin@local.host",
		password: "supertest1",
	})
	
	res.status(200).send()
})

export default router

