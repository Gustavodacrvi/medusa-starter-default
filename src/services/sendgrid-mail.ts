
import { BaseService } from "medusa-interfaces"
import {AbstractNotificationService, CartService, LineItem, OrderService, TotalsService} from "@medusajs/medusa"
import { readFileSync } from "fs"

const mail = require("@sendgrid/mail")
const mustache = require("mustache")
const format = (num?: number | null) => num && parseFloat((num / 100) + '').toFixed(2).replace('.', ',')

class SendgridMailService extends AbstractNotificationService {
	protected orderService: OrderService;
	protected cartService: CartService;
	
	static identifier = "sendgrid"
	protected sender = "gustavodacrvi@gmail.com"
	
	constructor(container) {
		super(container);
		this.orderService = container.orderService
		this.cartService = container.cartService
		
		mail.setApiKey(process.env.SEND_GRID_ACCESS_TOKEN)
	}
	
	
	async resetPasswordEmail(event: string, template: string, data: {
		id: string;
		email: string;
		token: string;
		last_name: string;
		first_name: string;
	}) {
		// @todo: Figure out how to translate the subject.
		// @todo: Replace localhost:8000 to proper link later on the email template!
		return await this.sendSomeEmail(data.email as string, "Reset your password", mustache.render(template, data), data)
	}
	
	async orderPlacedEmail(event: string, template: string, orderData: { id: string }) {
		const order = await this.orderService.retrieveWithTotals(orderData.id, { relations: ["shipping_address", "billing_address", "items", "items.variant", "items.variant.product", "items.variant.product"] })
		console.log(order, order.items.map(item => item.variant.product))
		
		order.subtotal = format(order.subtotal) as any
		order.total = format(order.total) as any
		order.shipping_total = format(order.shipping_total) as any
		order.items = order.items.map(item => ({
			...item, variant: { ...item.variant, product: { ...item.variant.product, external_id: item.variant.product.external_id || item.variant.product.id } }, total: format(item.total) as any
		})) as LineItem[]
		
		// @todo: Billing address/shipping address needs to contain the "Country" field!!!!
		// @todo: Create invoice here!!!!
		return await this.sendSomeEmail(order.email, "Placed order", mustache.render(template, order), orderData)
	}
	
	async sendNotification(
		event: string,
		data: any,
		attachmentGenerator: unknown
	): Promise<{
		to: string;
		status: string;
		data: Record<string, unknown>;
	}> {
		// @todo: Remove this later:
		console.log("SENDGRID EVENT: ", event, data, attachmentGenerator)
		const template = readFileSync(`sendgrid-templates/${event}.html`, {encoding: 'utf8', flag: 'r'})
		
		switch (event) {
			case "customer.password_reset": return await this.resetPasswordEmail(event, template, data)
			case "order.placed": return await this.orderPlacedEmail(event, template, data)
			default: throw new Error(`Notification event "${event}" not implemented!`)
		}
	}
	
	resendNotification(
		notification: unknown,
		config: unknown,
		attachmentGenerator: unknown
	): Promise<{
		to: string;
		status: string;
		data: Record<string, unknown>;
	}> {
		console.log("resendNotification: ", notification, config, attachmentGenerator)
		throw new Error("Method not implemented.")
	}
	
	async sendSomeEmail(to: string, subject: string, html: string, data: Record<string, string>) {
		await mail.send({
			to, subject, html,
			
			from: this.sender, // Change to your verified sender
		})
		
		return { to, status: "sent", data  }
	}
}

export default SendgridMailService;