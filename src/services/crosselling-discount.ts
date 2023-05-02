import {BaseService} from "medusa-interfaces"
import {Payment as MolliePayment} from '@mollie/api-client'

import {
	AllocationType, Cart,
	CartService,
	DiscountService,
	IdempotencyKey,
	LineItem,
	Product,
	ProductService, RegionService,
	SearchService
} from "@medusajs/medusa"
import {DiscountRuleType} from "@medusajs/medusa/dist/models/discount-rule"
import {DiscountConditionOperator} from "@medusajs/medusa/dist/models/discount-condition"

interface Context {
	ip_address: string;
	cart_id: string;
	idempotency_key: IdempotencyKey;
}

interface CrossellingDiscount {
	products: string[];
	code: string;
}

class CrossellingDiscountService extends BaseService {
	protected productService: ProductService
	protected discountService: DiscountService
	protected searchService: SearchService
	protected cartService: CartService
	protected regionService: RegionService
	
	public metadataKey = "is_thank_you_page_discount";
	public discountCodePrefix = "THANKYOUPAGEDISCOUNTCART";
	public durationInMinutes = 12;
	
	constructor({ productService, regionService, cartService, discountService, searchService }) {
		super();
		this.productService = productService
		this.regionService = regionService
		this.cartService = cartService
		this.discountService = discountService
		this.searchService = searchService
	}
	
	protected async createProductDiscount(products: Product[], deal: number, cart: Cart): Promise<CrossellingDiscount | null> {
		// Should only apply discount for the products that WERE NOT in the cart, if it's empty, then don't apply any discount.
		const availableProductIds = products.map(item => item.id).filter(id => !cart.items.some(lineItem => lineItem.id === id))
		if (!availableProductIds.length) return null
		
		const ends_at = new Date()
		ends_at.setMinutes(ends_at.getMinutes() + this.durationInMinutes)
		
		const regions = await this.regionService.list()
		
		const code = `${this.discountCodePrefix}${cart.id}${deal}`
		await this.discountService.create({
			code,
			rule: {
				type: DiscountRuleType.PERCENTAGE,
				allocation: AllocationType.ITEM,
				value: deal,
				conditions: [{
					operator: DiscountConditionOperator.IN,
					products,
				}],
			},
			is_disabled: false,
			is_dynamic: false,
			usage_limit: 1,
			starts_at: new Date(),
			ends_at,
			regions: [regions[0].id],
			metadata: {
				[this.metadataKey]: true,
			},
		})
		return { code, products: availableProductIds }
	}
	
	protected async getCrossellingProducts(cartItems: LineItem[]): Promise<Product[]> {
		const skus = cartItems.map(item => item.variant.product.external_id)
		// external_id = sku
		// @todo: reuse logic for knowing whether product is in stock or now, and active
		const { hits: products } = await this.searchService.search("products", '', {
			filter: [skus.map(sku => `metadata.crossellingProductExternalIds = ${sku}`), `variants.inventory_quantity > 0`, 'metadata.active = true'],
			sort: [`variants.prices.price_list_id:desc`, `metadata.sales:desc`],
		}) as { hits: Product[] }
		return products
	}
	
	async createCrossellingDiscount(molliePayment: MolliePayment, context: Context, paymentSessionData: any) {
		const cart = await this.cartService.retrieve(context.cart_id, { relations: ["items", "items.variant", "items.variant.product"] })
		console.log(context.cart_id, cart, cart.items?.length)
		const products = await this.getCrossellingProducts(cart.items)
		
		
		let high = paymentSessionData?.crosselling_discount?.high as CrossellingDiscount | undefined
		if (!high) {
			// @todo: Replace this with proper filtering, it should only return the products that are capable of having the high discount, maybe with "high_discoutn_allow" metadata.
			high = await this.createProductDiscount(products.filter(item => true), 40, cart)
		}
		
		
		// @todo: Implement other discount types: medium and low
		return { crosselling_discount: { high, medium: null, low: null } }
	}
	
	async isAllowedToHaveDiscount(molliePayment: MolliePayment, context: Partial<Context>, paymentSessionData: Record<string, unknown>) {
		// Ignore in case it has already been created or payment hasn't been done yet.
		// @todo: Implement other scenarios where user should be able to have another discount, for example, can only have one special discount per day, etc...
		return molliePayment.status === "paid" && !paymentSessionData.crosselling_discount
	}
	
	async deleteExpiredDiscounts() {
		const discounts = await this.discountService.list({ q: this.discountCodePrefix })
		const expired = discounts.filter(disc => {
			if (!disc.metadata?.[this.metadataKey]) return false // Is not thnak you page discount
			return (new Date().getTime() - new Date(disc.ends_at).getTime()) / (1000 * 60) > this.durationInMinutes // Expired
		})
		
		await Promise.all(expired.map(disc => this.discountService.delete(disc.id)))
	}
}

export default CrossellingDiscountService;