import { BaseService } from "medusa-interfaces";
import {
	LineItem,
	MoneyAmount,
	OrderService,
	Product,
	ProductCollection,
	ProductService,
	ProductVariant,
	SearchService
} from "@medusajs/medusa"
import { ProductSelector, FindProductConfig } from "@medusajs/medusa/dist/types/product"

class TopProductsService extends BaseService {
	protected productService: ProductService
	protected orderService: OrderService
	protected searchService: SearchService
	
	constructor({ productService, orderService, searchService }) {
		super();
		this.searchService = searchService
		this.productService = productService
		this.orderService = orderService
	}
	
	// 1.5 seconds
	/*async getTopProducts(productSelector: ProductSelector = {}, config: FindProductConfig = {}) {
		if (config.relations && !config.relations.includes("variants.prices")) {
			config.relations.push("variants.prices")
		}
		
		const products = (await this.productService.list({
			...productSelector,
			// @ts-ignore
			status: ['published'],
		}, {
			relations: ["variants", "variants.prices", "options", "options.values", "images", "tags", "collection", "type"],
			take: 10000,
			...config,
		})).filter(product => product.variants[0].inventory_quantity > 0)
		products.sort((a, b) => {
			const aSales = a.metadata && a.metadata.sales ? a.metadata.sales : 0
			const bSales = b.metadata && b.metadata.sales ? b.metadata.sales : 0
			return aSales > bSales ? -1 : (aSales < bSales ? 1 : 0)
		})
		
		return products
	}*/
	
	async getTopProductsByCategory(categories: string[]) {
		// @todo: Somehow reuse code for only getting products active and in stock
		// @todo: Sorting is for some reason not working, figure this out later!
		const { hits: products } = await this.searchService.search("products", '', {
			filter: [`collection_id IN [${categories.join(',')}]`, `variants.inventory_quantity > 0`, 'metadata.active = true'],
			sort: ["metadata.sales:desc"],
		}) as { hits: Product[] }
		
		
		// this.sortProductsByBestseller(products)
		
		return products
	}
	
	sortProductsByBestseller(products: Product[]) {
		products.sort((a, b) => {
			const aSales = a.metadata && a.metadata.sales ? a.metadata.sales : 0
			const bSales = b.metadata && b.metadata.sales ? b.metadata.sales : 0
			return aSales > bSales ? -1 : (aSales < bSales ? 1 : 0)
		})
	}
	
	async updateSales(orderId) {
		const order = await this.orderService.retrieve(orderId, {
			relations: ["items", "items.variant", "items.variant.product"]
		})
		const getId = (item: LineItem) => item.variant.product.id
		const getSku = (item: LineItem) => item.variant.product.external_id
		await Promise.all(
			order.items.map(async item => {
				const product = await this.productService.retrieve(getId(item), {
					relations: ["variants", "variants.prices", "options", "options.values", "images", "tags", "collection", "type"]
				})
				const otherProducts = order.items.filter(other => getId(other) !== getId(item))
				
				const sales = product.metadata && product.metadata.sales ? product.metadata.sales as number : 0
				const distribution = (product.metadata?.crossellingDistribution || {}) as {[key: string]: number | undefined}
				const externalIds = (product.metadata?.crossellingProductExternalIds || []) as string[]
				await this.productService.update(product.id, {
					metadata: {
						sales: sales + 1,
						
						crossellingProductExternalIds: [ ...externalIds, ...otherProducts.map(getSku) ],
						crossellingDistribution: {
							...distribution,
							...otherProducts.reduce((newDist, other) => ({
								...newDist,
								[getSku(other)]: (distribution[getSku(other)] || 0) + 1,
							}), {})
						},
					}
				})
			})
		)
	}
}

export default TopProductsService;