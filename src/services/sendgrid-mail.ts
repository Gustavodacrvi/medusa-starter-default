import {BaseService} from "medusa-interfaces"

const mail = require("@sendgrid/mail")

class SendgridMailService extends BaseService {
	
	constructor() {
		super();
		mail.setApiKey("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")
	}
	
	protected sender = "gustavodacrvi@gmail.com"
	
	async sendSomeEmail(to: string, subject: string, templateId?: string) {
		await mail.send({
			to, subject,
			from: this.sender, // Change to your verified sender
			
			text: 'and easy to do anywhere, even with Node.js',
			html: '<strong>and easy to do anywhere, even with Node.js</strong>',
		})
	}
}

export default SendgridMailService;