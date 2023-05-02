import { BaseService } from "medusa-interfaces";
import {ProductCollectionService, ProductService, ProductCollection, Product, PaymentService, RegionService, PaymentProviderService} from "@medusajs/medusa"
import {AggregationCursorResult} from "typeorm"
import {FindProductConfig} from "@medusajs/medusa/dist/types/product"
import TopProductsService from "./top-products"

export type ThreeCategory = ProductCollection & {
	count: number;
	sales: number;
	bestseller?: Product;
	sub_categories: ThreeCategory[];
}

class ThreeCategories extends BaseService {
	protected collection: ProductCollectionService
	protected productService: ProductService
	protected topProducts: TopProductsService
	protected regionService: RegionService;
	protected paymentProviderService: PaymentProviderService;
	
	constructor({ productCollectionService, productService, regionService, paymentProviderService, topProductsService }) {
		super();
		/*this.regionService = regionService
		this.paymentProviderService = paymentProviderService
		*/
		
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
		
		threeCols.forEach(col => {
			pros.push(
				(async () => {
					const { bestseller, sales } = await this.calculateBestseller([col.id])
					col.bestseller = bestseller
					col.sales = sales
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
			col.sales += col.sub_categories.reduce((total, sub) => sub.sales + total, 0)
		})
		
		this.sortCategories(threeCols)
		threeCols.forEach(parentCat => {
			this.sortCategories(parentCat.sub_categories)
			const allBestsellers = [parentCat.bestseller, ...parentCat.sub_categories.map(item => item.bestseller)].filter(item => item)
			this.topProducts.sortProductsByBestseller(allBestsellers)
			parentCat.bestseller = allBestsellers[0]
		})
		
		return threeCols
	}
	
	sortCategories(cats: ThreeCategory[]) {
		cats.sort((a, b) => {
			if (a.sales && !b.sales) return -1
			if (!a.sales && b.sales) return 1
			if (!a.sales && !b.sales && a.sales === b.sales) return a.count > b.count ? -1 : (a.count < b.count ? 1 : 0)
			
			return a.sales > b.sales ? -1 : (a.sales < b.sales ? 1 : 0)
		})
	}
	
	async countNumberOfProductsToEachCategory(categories: ThreeCategory[]) {
		categories = await Promise.all(
			categories.map(async subCategory => {
				const [count, { bestseller, sales }] = await Promise.all([
					this.productService.count({ collection_id: subCategory.id }),
					this.calculateBestseller([subCategory.id])
				])
				
				return { ...subCategory, count, bestseller, sales } as ThreeCategory
			})
		)
		return categories
		// Filter unnecessary, can be done on the frontend!!!
		// return categories.filter(col => col.count)
	}
	
	async calculateBestseller(categoryIds: string[]) {
		const keysToTake = ['id', "images", "title", "subtitle", "handle", "variants", "metadata"] as Array<keyof Product>
		
		const products = await this.topProducts.getTopProductsByCategory(categoryIds)
		
		let bestseller = products[0]
		/*products.forEach(candidate => {
			if (
				!bestseller.metadata?.sales ||
				candidate.metadata?.sales > bestseller.metadata?.sales
			) {
				bestseller = candidate
			}
		})*/
		
		if (bestseller) bestseller = keysToTake.reduce((obj, key) => ({ ...obj, [key]: bestseller[key] }), {}) as unknown as Product
		return { bestseller, sales: products.reduce((total, item) => ((item.metadata?.sales as number) || 0) + total, 0) }
	}
}

export default ThreeCategories;