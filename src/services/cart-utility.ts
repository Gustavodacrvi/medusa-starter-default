import { BaseService } from "medusa-interfaces";
import {Cart, CartService} from "@medusajs/medusa"


class CartUtilityService extends BaseService {
	protected cart: CartService;
	
	constructor({ cartService }) {
		super();
		this.cart = cartService
	}
	
	async isCartValid(cartId: string) {
		try {
			const cart = (await this.cart.retrieve(cartId))
			if (!cart || !cart.items.length) return false
			
			return true
		} catch (err) {
			console.error(err)
			return false
		}
	}
}

export default CartUtilityService;