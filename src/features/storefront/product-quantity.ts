export function purchaseMaximum(item: {
	availableStock: number;
	maximumQuantity: number;
}) {
	return item.availableStock < 0
		? item.maximumQuantity
		: Math.min(item.maximumQuantity, item.availableStock);
}
