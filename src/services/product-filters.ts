import { BaseService } from "medusa-interfaces";
import {Product, ProductCollection, ProductCollectionService, ProductService} from "@medusajs/medusa"

import AggregateCollectionsService from "./aggregate-collections"
import TopProductsService from "./top-products"
import {FindProductConfig} from "@medusajs/medusa/dist/types/product"

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
	
	async findBesteller(collectionIds: string[], config: FindProductConfig) {
		const keysToTake = ['id', "images", "title", "subtitle", "handle"] as Array<keyof Product>
		
		const product = (await this.topProducts.getTopProducts({ collection_id: collectionIds }, config))[0] || null
		if (product) return keysToTake.reduce((obj, key) => ({ ...obj, [key]: product[key] }), {}) as Product
		return null
	}
	
	async collectionBestsellers() {
		const aggregatedCollections = await this.aggregateCollections.treeFormatCollections() as BestsellerProductCollection[]
		
		const pros: Promise<any>[] = []
		
		const config: FindProductConfig = { relations: ["images"] }
		aggregatedCollections.forEach(col => {
			pros.push(
				(async () => {
					col.product = await this.findBesteller([col.id, ...col.sub_collections.map(subCol => subCol.id)], config)
				})(),
				(async () => {
					col.sub_collections = await Promise.all(
						col.sub_collections.map(async subCol => ({
							...subCol,
							product: await this.findBesteller([subCol.id], config)
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