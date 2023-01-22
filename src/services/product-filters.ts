import { BaseService } from "medusa-interfaces";
import {Product, ProductCollection, ProductCollectionService, ProductService} from "@medusajs/medusa"

import AggregateCollectionsService from "./aggregate-collections"
import TopProductsService from "./top-products"

export type BestsellerProductCollection = ProductCollection & {
	product: Product;
	sub_collections: BestsellerProductCollection[];
}

class ProductFilters extends BaseService {
	protected collection: ProductCollectionService
	protected productService: ProductService
	protected aggregateCollections: AggregateCollectionsService
	protected topProducts: TopProductsService
	
	constructor({ productCollectionService, productService, aggregateCollectionsService, topProductsService }) {
		super();
		this.collection = productCollectionService
		this.productService = productService
		this.aggregateCollections = aggregateCollectionsService
		this.topProducts = topProductsService
	}
	
	async collectionBestsellers() {
		const aggregatedCollections = await this.aggregateCollections.treeFormatCollections() as BestsellerProductCollection[]
		
		const pros: Promise<any>[] = []
		
		aggregatedCollections.forEach(col => {
			pros.push(
				(async () => {
					col.product = (await this.topProducts.getTopProducts({ collection_id: [col.id] }))[0]
				})(),
				(async () => {
					col.sub_collections = await Promise.all(
						col.sub_collections.map(async subCol => ({
							...subCol,
							product: (await this.topProducts.getTopProducts({ collection_id: [subCol.id] }))[0]
						}))
					) as BestsellerProductCollection[]
				})(),
			)
		})
		
		await Promise.all(pros)
		return aggregatedCollections
	}
}

export default ProductFilters;