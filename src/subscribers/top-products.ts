
import TopProductsService from "../services/top-products"

class TopProductsSubscriber {
	protected topProductsService: TopProductsService;
	
	constructor({ topProductsService, eventBusService }) {
		this.topProductsService = topProductsService;
		eventBusService.subscribe("order.placed", this.handleTopProducts);
	}
	handleTopProducts = async (data) => {
		this.topProductsService.updateSales(data.id);
	};
}
export default TopProductsSubscriber;