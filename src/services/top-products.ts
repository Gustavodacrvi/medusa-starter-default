import { BaseService } from "medusa-interfaces";
import {
	MoneyAmount,
	OrderService,
	Product,
	ProductCollection,
	ProductService,
	ProductVariant,
	SearchService
} from "@medusajs/medusa"
import { ProductSelector, FindProductConfig } from "@medusajs/medusa/dist/types/product"

export interface SearchEngineProduct {
	id: string;
	title: string;
	handle: string;
	description: string;
	thumbnail: string;
	metadata: {
		featured: boolean;
	};
	variants: Array<{
		prices: Array<{
			amount: number;
		}>,
	}>;
}

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
		const { hits } = await this.searchService.search("products", '', {
			filter: `collection_id IN [${categories.join(',')}] AND variants.inventory_quantity > 0`
		}) as { hits: SearchEngineProduct[] }
		
		const products = await this.productService.list({ id: hits.map(product => product.id) }, { take: 10000 })
		this.sortProductsByBestseller(products)
		
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
		if (order.items && order.items.length) {
			for (let i = 0; i < order.items.length; i++) {
				const item = order.items[i]
				const product = await this.productService.retrieve(item.variant.product.id, {
					relations: ["variants", "variants.prices", "options", "options.values", "images", "tags", "collection", "type"]
				})
				const sales = product.metadata && product.metadata.sales ? product.metadata.sales as number : 0
				await this.productService.update(product.id, {
					metadata: { sales: sales + 1 }
				})
				
			}
		}
	}
}

export default TopProductsService;