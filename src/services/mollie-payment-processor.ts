import {
	AbstractPaymentProcessor, Address as MedusaAddress, CartService,
	PaymentProcessorContext,
	PaymentProcessorError,
	PaymentProcessorSessionResponse,
	PaymentSessionStatus,
} from "@medusajs/medusa"

import createMollieClient, {Payment} from '@mollie/api-client'
import { Address as MollieAddress } from "@mollie/api-client/dist/types/src/data/global"
import {CreateParameters} from "@mollie/api-client/dist/types/src/binders/payments/parameters"
import {UpdateParameters} from "@mollie/api-client/dist/types/src/binders/orders/parameters"
// @todo: Put this on a env variable!


function medusaAddressToMollieAddress(address?: MedusaAddress): MollieAddress {
	return address && {
		country: address.country_code.toUpperCase(),
		city: address.city,
		postalCode: address.postal_code,
		streetAndNumber: `${address.address_1} ${address.metadata?.house_number}`
	}
}


function medusaContextToMollieData(context: PaymentProcessorContext): CreateParameters {
	// console.log('context:', context.paymentSessionData, context)
	const data = {
		amount: { currency: context.currency_code.toUpperCase(), value: (context.amount / 100).toFixed(2) },
		description: 'something',
		billingAddress: medusaAddressToMollieAddress(context.billing_address),
		customerReference: context.customer?.id,
		billingEmail: context.email || context.customer?.email || (context.billing_address?.metadata?.email as string),
		// @todo: Make this dynamic!!!!
		redirectUrl: `http://localhost:8000/success?cart_id=${context.resource_id}`,
		method: context.billing_address?.metadata?.method,
		
		// @todo: Put something else here
	} as CreateParameters
	
	return data
}
// @todo: Discuss whether 'restrictPaymentMethodsToCountry'/'applePayPaymentToken' is necessary.
// res._links.checkout
/*this.mollie.payments.create({
	method: "ideal",
	restrictPaymentMethodsToCountry: '',
	billingAddress: ''
	cardToken: ''
	shippingAddress: ''
	customerReference: ''
	applicationFee: ''
})*/
function mollieResponseToMedusaResponse(payment: Payment) {
	console.log("session_data: ", {
		payment_id: payment.id,
		method: payment.method,
		redirect_url: payment?._links?.checkout?.href,
	})
	return {
		payment_id: payment.id,
		method: payment.method,
		redirect_url: payment?._links?.checkout?.href,
	}
}
function getMolliePaymentStatus(payment: Payment) {
	switch (payment.status) {
		case "canceled": return PaymentSessionStatus.CANCELED
		case "authorized": return PaymentSessionStatus.REQUIRES_MORE
		case "paid": return PaymentSessionStatus.AUTHORIZED
		
		case "expired": return PaymentSessionStatus.ERROR
		case "failed": return PaymentSessionStatus.ERROR
		
		case "open": return PaymentSessionStatus.PENDING
		case "pending": return PaymentSessionStatus.PENDING
	}
}


// @todo: Keep in mind klarna flow!!
class MolliePaymentProcessor extends AbstractPaymentProcessor {
	static identifier = "mollie"
	
	protected cart: CartService;
	protected mollie: ReturnType<typeof createMollieClient>;
	
	constructor(services) {
		super(services)
		this.cart = services.cartService;
		this.mollie = createMollieClient({ apiKey: 'test_Agd9HbxSNkwaWSukSdENcVkJ6ym42S' })
	}
	
	async initiatePayment(
		context: PaymentProcessorContext
	): Promise<
		PaymentProcessorError | PaymentProcessorSessionResponse
		> {
		try {
			return {
				session_data: mollieResponseToMedusaResponse(await this.mollie.payments.create(medusaContextToMollieData(context)))
			}
		} catch (err) {
			console.error(err)
			throw new Error("initiatePayment error" + err)
		}
	}
	
	async updatePayment(
		context: PaymentProcessorContext
	): Promise<
		void |
		PaymentProcessorError |
		PaymentProcessorSessionResponse
		> {
		throw new Error("This method is broken, should not be ran!")
	}
	
	async authorizePayment(
		paymentSessionData: Record<string, unknown>,
		context: Record<string, unknown>
	): Promise<
		PaymentProcessorError |
		{
			status: PaymentSessionStatus;
			data: Record<string, unknown>;
		}
		> {
		try {
			console.log(paymentSessionData)
			const payment = await this.mollie.payments.get(paymentSessionData.payment_id as string)
			return {
				status: getMolliePaymentStatus(payment),
				data: mollieResponseToMedusaResponse(payment),
			}
		} catch (err) {
			console.error("authorizePayment: ", err)
			throw new Error("authorizePayment error!")
		}
	}
	
	async getPaymentStatus(
		paymentSessionData: Record<string, unknown>
	): Promise<PaymentSessionStatus> {
		try {
			console.log("getPaymentSTatus: ", paymentSessionData)
			const payment = await this.mollie.payments.get(paymentSessionData.payment_id as string )
			return getMolliePaymentStatus(payment)
		} catch (err) {
			console.error("getPaymentStatus: ", err)
			throw new Error("getPaymentStatus error!")
		}
	}
	
	async cancelPayment(
		paymentSessionData: Record<string, unknown>
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		try {
			await this.mollie.payments.cancel(paymentSessionData.payment_id as string, {testmode: true})
			return paymentSessionData
		} catch (err) {
			console.error("cancelPayment: ", err)
			throw new Error("cancelPayment error!")
		}
	}
	
	async deletePayment(
		paymentSessionData: Record<string, unknown>
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		try {
			await this.mollie.payments.cancel(paymentSessionData.payment_id as string, {testmode: true})
			return paymentSessionData
		} catch (err) {
			console.error("deletePayment: ", err)
			throw new Error("deletePayment error!")
		}
	}
	
	async retrievePayment(
		paymentSessionData: Record<string, unknown>
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		try {
			// console.log("retrievePayment: " ,paymentSessionData)
			const payment = await this.mollie.payments.get(paymentSessionData.payment_id as string)
			return mollieResponseToMedusaResponse(payment)
			/*return {
				_links: response._links,
				amount: response.amount,
				status: response.status,
				amountCaptured: response.amountCaptured,
				amountRefunded: response.amountRefunded,
				amountRemaining: response.amountRemaining,
				amountChargedBack: response.amountChargedBack,
				settlementAmount: response.settlementAmount,
				applicationFee: response.applicationFee,
				countryCode: response.countryCode,
				customerId: response.customerId,
			}*/
		} catch (err) {
			console.error("retrievePayment: ", err)
			throw new Error("retrievePayment error!")
		}
	}
	
	
	async capturePayment(
		paymentSessionData: Record<string, unknown>
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		throw new Error("Capture, Method not implemented.")
	}
	
	async refundPayment(
		paymentSessionData: Record<string, unknown>,
		refundAmount: number
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		throw new Error("refundPayment. Method not implemented.")
	}
}

export default MolliePaymentProcessor