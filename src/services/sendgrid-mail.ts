import {BaseService} from "medusa-interfaces"

const mail = require("@sendgrid/mail")

class SendgridMailService extends BaseService {
	
	constructor() {
		super();
		console.log("SENDGRID: ", process.env.SEND_GRID_ACCESS_TOKEN)
		mail.setApiKey(process.env.SEND_GRID_ACCESS_TOKEN)
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