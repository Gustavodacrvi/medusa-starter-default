import { BaseService } from "medusa-interfaces"

import createMollieClient, { Locale } from '@mollie/api-client'

// @todo: Put this on a env variable!
const mollie = createMollieClient({ apiKey: 'test_Agd9HbxSNkwaWSukSdENcVkJ6ym42S' })

class Mollie extends BaseService {
	
	async retrieveMethods() {
		// @todo: Discuss whether billingCountry is necessary
		// @todo: Figure out the reason why some payments aren't showing up
		return await mollie.methods.list({
			locale: Locale.nl_NL,
			/*amount: {
				currency: 'EUR',
				value: '30.00', // @todo: Figure out whether this should be 17.23 or 1723
			},*/
		})
	}
	
}

export default Mollie;