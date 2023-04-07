import { BaseService } from "medusa-interfaces";
import { OrderService, ProductService } from "@medusajs/medusa"
import { ProductSelector, FindProductConfig } from "@medusajs/medusa/dist/types/product"

class TopProductsService extends BaseService {
	protected _productService: ProductService
	protected _orderService: OrderService
	
	constructor({ productService, productCollectionService, orderService }) {
		super();
		this._productService = productService
		this._orderService = orderService
	}
	
	async getTopProducts(productSelector: ProductSelector = {}, config: FindProductConfig = {}) {
		if (config.relations && !config.relations.includes("variants.prices")) {
			config.relations.push("variants.prices")
		}
		
		const products = await this._productService.list({
			...productSelector,
			// @ts-ignore
			status: ['published'],
		}, {
			relations: ["variants", "variants.prices", "options", "options.values", "images", "tags", "collection", "type"],
			take: 1000,
			...config,
		});
		products.sort((a, b) => {
			const aSales = a.metadata && a.metadata.sales ? a.metadata.sales : 0;
			const bSales = b.metadata && b.metadata.sales ? b.metadata.sales : 0;
			return aSales > bSales ? -1 : (aSales < bSales ? 1 : 0);
		});
		
		return products.filter(product => product.variants[0].inventory_quantity > 0);
	}
	
	async updateSales(orderId) {
		const order = await this._orderService.retrieve(orderId, {
			relations: ["items", "items.variant", "items.variant.product"]
		})
		if (order.items && order.items.length) {
			for (let i = 0; i < order.items.length; i++) {
				const item = order.items[i]
				const product = await this._productService.retrieve(item.variant.product.id, {
					relations: ["variants", "variants.prices", "options", "options.values", "images", "tags", "collection", "type"]
				})
				const sales = product.metadata && product.metadata.sales ? product.metadata.sales as number : 0
				await this._productService.update(product.id, {
					metadata: { sales: sales + 1 }
				})
				
			}
		}
	}
}

export default TopProductsService;