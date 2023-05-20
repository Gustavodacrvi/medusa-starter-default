class SendgridNotificationSubscriber {
	constructor({ notificationService }) {
		notificationService.subscribe("order.placed", "sendgrid")
		notificationService.subscribe("customer.password_reset", "sendgrid")
		// notificationService.subscribe("order.refund_created", "sendgrid")
	}
}

export default SendgridNotificationSubscriber