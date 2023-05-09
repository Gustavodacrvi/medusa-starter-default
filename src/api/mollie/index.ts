
import { Router } from "express"
import MolliePaymentProcessor from "../../services/mollie-payment-processor"
const router = Router()

router.get("/mollie/payment-methods", async (req, res) => {
	const mollie = req.scope.resolve("molliePaymentProcessorService") as MolliePaymentProcessor
	res.json(await mollie.retrieveMethods())
})

router.post("/mollie/payment-status", async (req, res) => {
	const mollie = req.scope.resolve("molliePaymentProcessorService") as MolliePaymentProcessor
	res.send(await mollie.handleMolliePaymentWebhook(req.body.id as string))
})

export default router

