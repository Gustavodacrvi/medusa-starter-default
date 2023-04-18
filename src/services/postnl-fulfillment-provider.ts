import { FulfillmentService } from "medusa-interfaces"
import {Cart} from "@medusajs/medusa"

interface ShippingOption {
	id: 'standard' | 'express';
}

class PostNlFulfillmentProvider extends FulfillmentService {
	static identifier = "post-nl"
	
	async getFulfillmentOptions(): Promise<ShippingOption[]> {
		return [
			{
				id: "standard",
			},
			{
				id: "express",
			},
		]
	}
	
	async validateOption(data: Partial<ShippingOption>) {
		return data.id === "standard" || data.id === 'express'
	}
	
	async validateFulfillmentData(optionData: ShippingOption, data, cart) {
		if (optionData.id !== "standard" && optionData.id !== 'express') {
			throw new Error("invalid data")
		}
		
		return {
			...data,
		}
	}
	
	async createFulfillment(
		methodData,
		fulfillmentItems,
		fromOrder,
		fulfillment
	) {
		console.log("createFulfillment: ", methodData, fulfillmentItems, fromOrder, fulfillment)
		// No data is being sent anywhere
		return Promise.resolve({})
	}
	
	canCalculate(data) {
		return true
	}
	
	calculatePrice(optionData: ShippingOption, data, cart: Cart): number {
		// @todo: Replace with table rates
		// @todo: Add pallets if necessary.
		
		const price = {
			nl: 4.97,
			be: 4.97,
			fr: 5.97,
		}[cart?.shipping_address?.country_code] || 5
		return price * 100
	}
}

export default PostNlFulfillmentProvider