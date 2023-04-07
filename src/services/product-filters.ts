import { BaseService } from "medusa-interfaces";
import {Product, ProductCollection, ProductCollectionService, ProductService} from "@medusajs/medusa"

import ThreeCategoriesService from "./three-categories"
import TopProductsService from "./top-products"
import {FindProductConfig} from "@medusajs/medusa/dist/types/product"

export type BestsellerProductCategory = ProductCollection & {
	product: Product;
	sub_categories: BestsellerProductCategory[];
}

class ProductFilters extends BaseService {
	protected threeCategories: ThreeCategoriesService
	protected topProducts: TopProductsService
	
	constructor({ threeCategoriesService, topProductsService }) {
		super();
		this.threeCategories = threeCategoriesService
		this.topProducts = topProductsService
	}
	
	async findBesteller(categoryIds: string[], config: FindProductConfig) {
		const keysToTake = ['id', "images", "title", "subtitle", "handle", "variants"] as Array<keyof Product>
		
		const product = (await this.topProducts.getTopProducts({ collection_id: categoryIds }, config))[0] || null
		if (product) return keysToTake.reduce((obj, key) => ({ ...obj, [key]: product[key] }), {}) as Product
		return null
	}
	
	async categoryBestsellers() {
		const threeCategories = await this.threeCategories.treeFormatCategories() as BestsellerProductCategory[]
		
		const pros: Promise<any>[] = []
		
		const config: FindProductConfig = { relations: ["images"] }
		threeCategories.forEach(col => {
			pros.push(
				(async () => {
					col.product = await this.findBesteller([col.id, ...col.sub_categories.map(subCol => subCol.id)], config)
				})(),
				(async () => {
					col.sub_categories = await Promise.all(
						col.sub_categories.map(async subCol => ({
							...subCol,
							product: await this.findBesteller([subCol.id], config)
						}))
					) as BestsellerProductCategory[]
				})(),
			)
		})
		
		await Promise.all(pros)
		
		threeCategories.forEach(cat => cat.sub_categories = cat.sub_categories.filter(subCat => subCat.product))
		return threeCategories.filter(cat => cat.product)
	}
}

export default ProductFilters;