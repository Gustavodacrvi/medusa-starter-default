
import { Router } from "express"
import Mollie from "../../services/mollie"
const router = Router()

router.get("/mollie/payment-methods", async (req, res) => {
	const mollie = req.scope.resolve("mollieService") as Mollie
	res.json(await mollie.retrieveMethods())
})

export default router

