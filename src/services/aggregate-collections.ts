import { BaseService } from "medusa-interfaces";
import { ProductCollectionService, ProductService, ProductCollection } from "@medusajs/medusa"
import {AggregationCursorResult} from "typeorm"

export type AggregatedCollection = ProductCollection & {
	count: number;
	sub_collections: AggregatedCollection[];
}

class AggregateCollections extends BaseService {
	protected collection: ProductCollectionService
	protected productService: ProductService
	
	constructor({ productCollectionService, productService }) {
		super();
		this.collection = productCollectionService
		this.productService = productService
	}
	
	async treeFormatCollections() {
		const collections = await this.collection.list({}, { skip: 0, take: 100000 })
		// return collections
		return collections
			.filter(col => !col.metadata?.parent_id)
			.map(parent => ({
				...parent,
				sub_collections: collections.filter(subCollection => subCollection.metadata?.parent_id === parent.id)
			}))
	}
	
	async aggregatedCollections() {
		const aggregatedCols = await this.treeFormatCollections() as AggregatedCollection[]
		
		const pros: Promise<any>[] = []
		
		aggregatedCols.forEach(col => {
			pros.push(
				(async () => {
					col.sub_collections = await this.countNumberOfProductsToEachCollection(col.sub_collections as AggregatedCollection[])
				})(),
				(async () => {
					col.count = await this.productService.count({ collection_id: col.id })
				})(),
			)
		})
		
		await Promise.all(pros)
		
		aggregatedCols.forEach(col => {
			col.count += col.sub_collections.reduce((total, sub) => sub.count + total, 0)
		})
		
		return aggregatedCols
	}
	
		async countNumberOfProductsToEachCollection(collections: AggregatedCollection[]) {
		collections = await Promise.all(
			collections.map(async subCollection => ({
				...subCollection,
				count: await this.productService.count({ collection_id: subCollection.id })
			}) as AggregatedCollection
		))
		return collections
		// return collections.filter(col => col.count)
	}
}

export default AggregateCollections;