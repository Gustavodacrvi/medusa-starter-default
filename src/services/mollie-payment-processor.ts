import {
	AbstractPaymentProcessor, Address as MedusaAddress, CartService, OrderService,
	PaymentProcessorContext,
	PaymentProcessorError,
	PaymentProcessorSessionResponse, PaymentService,
	PaymentSessionStatus,
} from "@medusajs/medusa"


import createMollieClient, {Locale, Payment} from '@mollie/api-client'
import { Address as MollieAddress } from "@mollie/api-client/dist/types/src/data/global"
import {CreateParameters} from "@mollie/api-client/dist/types/src/binders/payments/parameters"
import {UpdateParameters} from "@mollie/api-client/dist/types/src/binders/orders/parameters"
import CrossellingDiscountService, {CrossellingDiscount} from "./crosselling-discount"
import SendgridMailService from "./sendgrid-mail"
// For development only
const tunnel = require('localtunnel')
// @todo: Put this on a env variable!


export interface PaymentSessionData extends CrossellingDiscount {
	payment_id: string;
	method: string;
	redirect_url: string;
	email: string;
}


function medusaAddressToMollieAddress(address?: MedusaAddress): MollieAddress {
	return address && {
		country: address.country_code.toUpperCase(),
		city: address.city,
		postalCode: address.postal_code,
		streetAndNumber: `${address.address_1} ${address.metadata?.house_number}`
	}
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

function getMolliePaymentStatus(molliePayment: Payment): PaymentSessionStatus {
	switch (molliePayment.status) {
		case "authorized": return PaymentSessionStatus.AUTHORIZED // Used only by Klarna
		case "open": return PaymentSessionStatus.AUTHORIZED
		case "pending": return PaymentSessionStatus.PENDING
		case "paid": return PaymentSessionStatus.AUTHORIZED
		
		case "canceled": return PaymentSessionStatus.CANCELED
		case "expired": return PaymentSessionStatus.ERROR
		case "failed": return PaymentSessionStatus.ERROR
	}
}

let TUNNEL_URL = ''

// @todo: Keep in mind klarna flow!!
class MolliePaymentProcessor extends AbstractPaymentProcessor {
	static identifier = "mollie"
	
	protected crossellingDiscount: CrossellingDiscountService
	protected sendgridMailService: SendgridMailService
	protected orderService: OrderService
	protected mollie: ReturnType<typeof createMollieClient>
	protected tunnelUrl: string | null = TUNNEL_URL
	
	constructor(services) {
		super(services)
		this.crossellingDiscount = services.crossellingDiscountService
		this.sendgridMailService = services.sendgridMailService
		this.orderService = services.orderService
		this.mollie = createMollieClient({ apiKey: 'test_Agd9HbxSNkwaWSukSdENcVkJ6ym42S' })
	}
	
	async medusaContextToMollieData(context: PaymentProcessorContext): Promise<CreateParameters> {
		// @todo: Update README with this
		// @todo: This should only be ran on dev mode!
		if (!TUNNEL_URL) {
			const { url } = await tunnel({ port: 9000 })
			TUNNEL_URL = url
			console.log(`Local tunnel: ${url}`)
			this.tunnelUrl = url
		}
		
		// console.log('context:', context.paymentSessionData, context)
		// @todo: Implement webhooks API
		const data = {
			amount: { currency: context.currency_code.toUpperCase(), value: (context.amount / 100).toFixed(2) },
			description: 'something',
			billingAddress: medusaAddressToMollieAddress(context.billing_address),
			customerReference: context.customer?.id,
			billingEmail: context.email || context.customer?.email || (context.billing_address?.metadata?.email as string),
			// @todo: Make this dynamic!!!!
			redirectUrl: `http://localhost:8000/success?cart_id=${context.resource_id}`,
			method: context.billing_address?.metadata?.method,
			metadata: { cart_id: context.resource_id },
			// tunnelUrl is used in dev mode
			// @todo: replace with production url
			webhookUrl: `${this.tunnelUrl || ''}/mollie/payment-status`,
			
			
			// @todo: Put something else here
		} as CreateParameters
		
		return data
	}
	
	mollieResponseToMedusaResponse(payment: Payment, paymentSessionData: PaymentProcessorContext | Record<string, unknown>) {
		return {
			payment_id: payment.id,
			method: payment.method,
			redirect_url: payment?._links?.checkout?.href,
			email: paymentSessionData.email as string,
			[this.crossellingDiscount.paymentSessionDataKey]: (paymentSessionData[this.crossellingDiscount.paymentSessionDataKey] || undefined),
		}
	}
	
	async initiatePayment(
		context: PaymentProcessorContext
	): Promise<
		PaymentProcessorError | PaymentProcessorSessionResponse
		> {
		try {
			return {
				session_data: this.mollieResponseToMedusaResponse(
					await this.mollie.payments.create(await this.medusaContextToMollieData(context)),
					context
				),
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
			const payment = await this.mollie.payments.get(paymentSessionData.payment_id as string)
			
			const status = getMolliePaymentStatus(payment)
			let data = this.mollieResponseToMedusaResponse(payment, paymentSessionData)
			
			console.log("payment:: ", payment)
			console.log("context:: ", context)
			console.log("paymentSessionData:: ", paymentSessionData)
			if (status === "authorized") {
				await this.sendgridMailService.sendSomeEmail(data.email, "This is a test!")
			}
			if (this.crossellingDiscount.isAllowedToHaveDiscount(payment, context, paymentSessionData as unknown as PaymentSessionData)) {
				data = {
					...data,
					...await this.crossellingDiscount.prepareSuccessPageForCrossellingDiscount(payment, context as any)
				}
			}
			
			console.log("final data::: ", data)
			return {
				status,
				data,
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
			await this.mollie.payments.cancel(paymentSessionData.payment_id as string)
		} catch (err) {
			console.error("cancelPaymentError: ", err)
			// throw new Error("cancelPayment error!")
		}
		return {
			...paymentSessionData,
			canceled: true,
		}
	}
	
	async deletePayment(
		paymentSessionData: Record<string, unknown>
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		try {
			await this.mollie.payments.cancel(paymentSessionData.payment_id as string)
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
			const payment = await this.mollie.payments.get(paymentSessionData.payment_id as string)
			return this.mollieResponseToMedusaResponse(payment, paymentSessionData)
		} catch (err) {
			console.error("retrievePayment: ", err)
			throw new Error("retrievePayment error!")
		}
	}
	
	
	async capturePayment(
		paymentSessionData: Record<string, unknown>
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		return {
			status: "captured",
		}
	}
	
	async refundPayment(
		paymentSessionData: Record<string, unknown>,
		refundAmount: number
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		throw new Error("refundPayment. Method not implemented.")
	}
	
	
	async retrieveMethods() {
		// @todo: Discuss whether billingCountry is necessary
		// @todo: Figure out the reason why some payments aren't showing up
		return await this.mollie.methods.list({
			locale: Locale.nl_NL,
			/*amount: {
				currency: 'EUR',
				value: '30.00', // @todo: Figure out whether this should be 17.23 or 1723
			},*/
		})
	}
	
	async handleMolliePaymentWebhook(paymentId: string) {
		const payment = await this.mollie.payments.get(paymentId)
		const order = await this.orderService.retrieveByCartId(payment.metadata.cart_id)
		
		const cancel = async () => await this.orderService.cancel(order.id)
		switch (payment.status) {
			case "paid": {
				await this.orderService.capturePayment(order.id)
				break
			}
			case "canceled": {
				await cancel()
				break
			}
			case "expired": {
				await cancel()
				break
			}
			case "failed": {
				await cancel()
				break
			}
			case "authorized": {
				// @todo: KLARNA. Klarna payments are only done on the order is fulfilled, do something here.
				// @todo: Talk back with molile that the products are shipped
				break
			}
		}
		
		return payment.status
		// @todo: Should always return 200 OK, even when the payment id doesn't exist. To prevent leaking information.
	}
}

export default MolliePaymentProcessor