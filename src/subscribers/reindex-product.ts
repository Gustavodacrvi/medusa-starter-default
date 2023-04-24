
import {ProductService, SearchService} from "@medusajs/medusa"

class ReindexProductService {
	protected productService: ProductService
	protected meilisearchService: SearchService
	
	constructor({ eventBusService, productService, meilisearchService }) {
		this.productService = productService
		this.meilisearchService = meilisearchService
		eventBusService.subscribe("product.updated", this.reindexMetadata);
	}
	
	reindexMetadata = async (data) => {
		const product = await this.productService.retrieve(data.id, {
			relations: [
				"variants",
				"tags",
				"type",
				"collection",
				"variants.prices",
				"variants.options",
				"options",
			],
		})
		await this.meilisearchService.addDocuments("products", [product], "products")
	};
}
export default ReindexProductService;