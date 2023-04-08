import { BaseService } from "medusa-interfaces";
import {ProductCollectionService, ProductService, ProductCollection, Product} from "@medusajs/medusa"
import {AggregationCursorResult} from "typeorm"
import {FindProductConfig} from "@medusajs/medusa/dist/types/product"
import TopProductsService from "./top-products"

export type ThreeCategory = ProductCollection & {
	count: number;
	bestseller: Product;
	sub_categories: ThreeCategory[];
}

class ThreeCategories extends BaseService {
	protected collection: ProductCollectionService
	protected productService: ProductService
	protected topProducts: TopProductsService
	
	constructor({ productCollectionService, productService, topProductsService }) {
		super();
		this.collection = productCollectionService
		this.topProducts = topProductsService
		this.productService = productService
	}
	
	async getCategoryByHandle(handle: string) {
		const catThree = await this.threeCategories()
		const flattenedThree = [ ...catThree, ...catThree.map(item => item.sub_categories).flat() ]
		return flattenedThree.find(item => item.handle === handle)
	}
	
	async treeFormatCategories() {
		const categories = await this.collection.list({}, { skip: 0, take: 100000 })
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
		
		const config: FindProductConfig = { relations: ["images"] }
		threeCols.forEach(col => {
			pros.push(
				(async () => {
					col.bestseller = await this.findBesteller([col.id, ...col.sub_categories.map(subCol => subCol.id)], config)
				})(),
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
		
		this.sortCategoriesByCount(threeCols)
		threeCols.forEach(parentCat => this.sortCategoriesByCount(parentCat.sub_categories))
		
		return threeCols
	}
	
	sortCategoriesByCount(cats: ThreeCategory[]) {
		cats.sort((a, b) => a.count > b.count ? -1 : (a.count < b.count ? 1 : 0))
	}
	
	async countNumberOfProductsToEachCategory(categories: ThreeCategory[]) {
		categories = await Promise.all(
			categories.map(async subCategory => ({
				...subCategory,
				count: await this.productService.count({ collection_id: subCategory.id })
			}) as ThreeCategory
		))
		return categories
		// Filter unnecessary, can be done on the frontend!!!
		// return categories.filter(col => col.count)
	}
	
	async findBesteller(categoryIds: string[], config: FindProductConfig) {
		const keysToTake = ['id', "images", "title", "subtitle", "handle", "variants"] as Array<keyof Product>
		
		const product = (await this.topProducts.getTopProducts({ collection_id: categoryIds }, config))[0] || null
		if (product) return keysToTake.reduce((obj, key) => ({ ...obj, [key]: product[key] }), {}) as Product
		return null
	}
}

export default ThreeCategories;