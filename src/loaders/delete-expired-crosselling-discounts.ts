
import CrossellingDiscountService from "../services/crosselling-discount"

const deleteExpiredCrossellingDiscountsJob = async (container, options) => {
	const jobSchedulerService =
		container.resolve("jobSchedulerService")
	jobSchedulerService.create(
		"publish-products",
		{},
		"0 0 * * *",
		async () => {
			const crossellingService = container.resolve("crossellingDiscountService") as CrossellingDiscountService
			await crossellingService.deleteExpiredDiscounts()
		}
	)
}

export default deleteExpiredCrossellingDiscountsJob