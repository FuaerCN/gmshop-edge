export function applyPartialEmailChannelOrder(
	allIds: readonly string[],
	requestedIds: readonly string[],
) {
	const requested = new Set(requestedIds);
	const slots = allIds
		.map((id, index) => (requested.has(id) ? index : -1))
		.filter((index) => index >= 0);
	if (slots.length !== requestedIds.length) return null;
	const orderedIds = [...allIds];
	for (const [index, slot] of slots.entries()) {
		const id = requestedIds[index];
		if (id) orderedIds[slot] = id;
	}
	return orderedIds;
}
