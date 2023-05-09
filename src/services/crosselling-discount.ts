import {BaseService} from "medusa-interfaces"
import {Payment as MolliePayment} from '@mollie/api-client'

import {
	AllocationType, Cart,
	CartService,
	DiscountService,
	IdempotencyKey,
	LineItem, OrderService,
	Product,
	ProductService, ProductVariant, ProductVariantService, RegionService,
	SearchService
} from "@medusajs/medusa"
import {DiscountRuleType} from "@medusajs/medusa/dist/models/discount-rule"
import {DiscountConditionOperator} from "@medusajs/medusa/dist/models/discount-condition"
import {PaymentSessionData} from "./mollie-payment-processor"

interface Context {
	ip_address: string;
	cart_id: string;
	idempotency_key: IdempotencyKey;
}

export interface CrossellingDiscount {
	crosselling_discount?: {
		discount_expiration_date: string | Date;
		high: string[];
		medium: string[];
		low: string[];
	} | null;
}

class CrossellingDiscountService extends BaseService {
	protected productService: ProductService
	protected discountService: DiscountService
	protected searchService: SearchService
	protected cartService: CartService
	protected regionService: RegionService
	protected orderService: OrderService
	protected productVariantService: ProductVariantService
	
	public metadataKey = "is_thank_you_page_discount"
	public discountCodePrefix = "THANKYOUPAGEDISCOUNTCART"
	public durationInMinutes = 12
	public paymentSessionDataKey = "crosselling_discount"
	public orderMetadataDiscountCodeKey = "crosselling_discount_code"
	
	constructor({ productService, productVariantService, regionService, cartService, orderService, discountService, searchService }) {
		super();
		this.productService = productService
		this.regionService = regionService
		this.cartService = cartService
		this.orderService = orderService
		this.productVariantService = productVariantService
		this.discountService = discountService
		this.searchService = searchService
	}
	
	protected async getDiscountTotalFromVariants(variantIds: string[]) {
		const variants = await Promise.all(variantIds.map(async id => await this.productVariantService.retrieve(id, { relations: ["product", "prices"] })))
		const products = variants.map(variant => variant.product)
		
		let highDiscountProducts = products.filter(product => product.metadata?.high_discount_allow)
		let mediumDiscountProducts = products.filter(product => product.metadata?.medium_discount_allow)
		let lowDiscountProducts = products.filter(product => product.metadata?.low_discount_allow)
		
		// Ensure there aren't any duplicate products between sections.
		mediumDiscountProducts = mediumDiscountProducts.filter(product => !highDiscountProducts.some(highProduct => highProduct.id === product.id))
		const highAndMediumProducts = [...highDiscountProducts, ...mediumDiscountProducts]
		lowDiscountProducts = lowDiscountProducts.filter(product => !highAndMediumProducts.some(highProduct => highProduct.id === product.id))
		
		const filterVariantsByProperDiscountType = (variants: ProductVariant[], sectionProducts: Product[]) => variants.filter(variant => sectionProducts.some(product => product.id === variant.product_id))
		function calculateTotalDiscountTypePrice(percentage: number, variants: ProductVariant[], alreadyCalculatedVariants: string[]) {
			const total = variants.reduce((total, variant) => {
				if (alreadyCalculatedVariants.includes(variant.id)) return total
				return (percentage / 100) * 4.97 + total
			}, 0)
			alreadyCalculatedVariants.push(...variants.map(item => item.id))
			return total
		}
		
		// Double check that guarantees variants aren't calculated twice
		const alreadyCalculated = [] as string[]
		const highTotal = calculateTotalDiscountTypePrice(40, filterVariantsByProperDiscountType(variants, highDiscountProducts), alreadyCalculated)
		const mediumTotal = calculateTotalDiscountTypePrice(30, filterVariantsByProperDiscountType(variants, mediumDiscountProducts), alreadyCalculated)
		const lowTotal = calculateTotalDiscountTypePrice(20, filterVariantsByProperDiscountType(variants, lowDiscountProducts), alreadyCalculated)
		
		return { products, discountTotal: highTotal + mediumTotal + lowTotal }
	}
	
	protected async createProductDiscount(products: Product[], value: number, cart: Cart, ends_at: string | Date) {
		// Should only apply discount for the products that WERE NOT in the cart, if it's empty, then don't apply any discount.
		const availableProductIds = products.map(item => item.id).filter(id => !cart.items.some(lineItem => lineItem.id === id))
		if (!availableProductIds.length) return null
		
		const regions = await this.regionService.list()
		
		const code = `${this.discountCodePrefix}${cart.id}${value}`
		await this.discountService.create({
			code,
			rule: {
				type: DiscountRuleType.FIXED,
				allocation: AllocationType.TOTAL,
				value,
				conditions: [{
					operator: DiscountConditionOperator.IN,
					products,
				}],
			},
			is_disabled: false,
			is_dynamic: false,
			usage_limit: 1,
			ends_at: typeof ends_at === 'string' ? new Date(ends_at) : ends_at,
			regions: [regions[0].id],
			metadata: {
				[this.metadataKey]: true,
			},
		})
		return { code, products: availableProductIds }
	}
	
	protected async getCrossellingProducts(cartItems: LineItem[], filter: string): Promise<Product[]> {
		const skus = cartItems.map(item => item.variant.product.external_id)
		// external_id = sku
		// @todo: reuse logic for knowing whether product is in stock or now, and active
		const { hits: products } = await this.searchService.search("products", '', {
			filter: [
				skus.map(sku => `metadata.crossellingProductExternalIds = ${sku}`),
				filter,
				`variants.inventory_quantity > 0`, 'metadata.active = true',
			],
			sort: [`variants.prices.price_list_id:desc`, `metadata.sales:desc`],
		}) as { hits: Product[] }
		return products
	}
	
	protected isDiscountDateExpired(expirationDate: string | Date) {
		return (new Date().getTime() - new Date(expirationDate).getTime()) / (1000 * 60) > this.durationInMinutes // Expired
	}
	
	
	
	isAllowedToHaveDiscount(molliePayment: MolliePayment, context: Partial<Context>, paymentSessionData: PaymentSessionData) {
		// Ignore in case it has already been created or payment hasn't been done yet.
		// @todo: Implement other scenarios where user should be able to have another discount, for example, can only have one special discount per day, etc...
		console.log("crosselling_discount: ", molliePayment.status, paymentSessionData[this.paymentSessionDataKey], !paymentSessionData[this.paymentSessionDataKey])
		return molliePayment.status === "open" && !paymentSessionData[this.paymentSessionDataKey]
	}
	
	async prepareSuccessPageForCrossellingDiscount(molliePayment: MolliePayment, context: Context): Promise<CrossellingDiscount> {
		const cart = await this.cartService.retrieve(context.cart_id, { relations: ["items", "items.variant", "items.variant.product"] })
		let [highProducts, mediumProducts, lowProducts] = await Promise.all([
			this.getCrossellingProducts(cart.items, "metadata.high_discount_allow = true"),
			this.getCrossellingProducts(cart.items, "metadata.medium_discount_allow = true"),
			this.getCrossellingProducts(cart.items, "metadata.low_discount_allow = true"),
		])
		console.log("What is going on!", highProducts, mediumProducts, lowProducts, cart)
		
		const onlyGetProductsThatWereNotAlreadyInStock = (products: Product[]) => products.map(item => item.id).filter(id => !cart.items.some(lineItem => lineItem.id === id))
		
		mediumProducts = mediumProducts.filter(product => !highProducts.some(highProduct => highProduct.id === product.id))
		const highAndMediumProducts = [...highProducts, ...mediumProducts]
		lowProducts = lowProducts.filter(product => !highAndMediumProducts.some(highProduct => highProduct.id === product.id))
		
		
		const high = onlyGetProductsThatWereNotAlreadyInStock(highProducts)
		const medium = onlyGetProductsThatWereNotAlreadyInStock(mediumProducts)
		const low = onlyGetProductsThatWereNotAlreadyInStock(lowProducts)
		
		if (!high.length && !medium.length && !low.length) return null
		
		const ends_at = new Date()
		ends_at.setMinutes(ends_at.getMinutes() + this.durationInMinutes)
		return {
			[this.paymentSessionDataKey]: { discount_expiration_date: ends_at, high, low, medium }
		}
	}
	
	async getOrCreateDiscount(cartId: string, variantIds: string[]) {
		const order = await this.orderService.retrieveByCartId(cartId, { relations: ["payments"] })
		const sessionData = order.payments[0].data as unknown as PaymentSessionData
		
		// If payment hasn't been done yet, or is expired, return null.
		if (!sessionData[this.paymentSessionDataKey] || this.isDiscountDateExpired(sessionData[this.paymentSessionDataKey].discount_expiration_date)) return null
		if (order.metadata[this.orderMetadataDiscountCodeKey]) return [order.metadata[this.orderMetadataDiscountCodeKey]]
		
		const [{ products, discountTotal }, cart] = await Promise.all([
			this.getDiscountTotalFromVariants(variantIds),
			this.cartService.retrieve(cartId, { relations: ["items", "items.variant", "items.variant.product"] })
		])
		const { code } = await this.createProductDiscount(products, discountTotal, cart, sessionData.crosselling_discount.discount_expiration_date)
		await this.orderService.update(order.id, { metadata: { [this.orderMetadataDiscountCodeKey]: code } })
		return [code]
	}
	
	async deleteExpiredDiscounts() {
		const discounts = await this.discountService.list({ q: this.discountCodePrefix })
		const expired = discounts.filter(disc => {
			if (!disc.metadata?.[this.metadataKey]) return false // Is not thank you page discount
			return this.isDiscountDateExpired(disc.ends_at)
		})
		
		await Promise.all(expired.map(disc => this.discountService.delete(disc.id)))
	}
}

export default CrossellingDiscountService;