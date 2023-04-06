import { BaseService } from "medusa-interfaces";
import { ProductCollectionService, ProductService, ProductCollection } from "@medusajs/medusa"
import {AggregationCursorResult} from "typeorm"

export type ThreeCategory = ProductCollection & {
	count: number;
	sub_categories: ThreeCategory[];
}

class ThreeCategories extends BaseService {
	protected collection: ProductCollectionService
	protected productService: ProductService
	
	constructor({ productCollectionService, productService }) {
		super();
		this.collection = productCollectionService
		this.productService = productService
	}
	
	async treeFormatCategories() {
		const categories = await this.collection.list({}, { skip: 0, take: 100000 })
		// return categories
		return categories
			.filter(col => !col.metadata?.parent_id)
			.map(parent => ({
				...parent,
				sub_categories: categories.filter(subCategory => subCategory.metadata?.parent_id === parent.id)
			}))
	}
	
	async threeCategories() {
		const threeCols = await this.treeFormatCategories() as ThreeCategory[]
		
		const pros: Promise<any>[] = []
		
		threeCols.forEach(col => {
			pros.push(
				(async () => {
					col.sub_categories = await this.countNumberOfProductsToEachCategory(col.sub_categories as ThreeCategory[])
				})(),
				(async () => {
					col.count = await this.productService.count({ collection_id: col.id })
				})(),
			)
		})
		
		await Promise.all(pros)
		
		threeCols.forEach(col => {
			col.count += col.sub_categories.reduce((total, sub) => sub.count + total, 0)
		})
		
		return threeCols
	}
	
		async countNumberOfProductsToEachCategory(categories: ThreeCategory[]) {
		categories = await Promise.all(
			categories.map(async subCategory => ({
				...subCategory,
				count: await this.productService.count({ collection_id: subCategory.id })
			}) as ThreeCategory
		))
		return categories
		// return categories.filter(col => col.count)
	}
}

export default ThreeCategories;