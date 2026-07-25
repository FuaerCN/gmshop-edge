import { queryOptions } from "@tanstack/react-query";
import { listProductOptionsFn } from "#/features/catalog/server/admin";

export const catalogOptionsQueryKey = ["admin", "catalog", "options"] as const;

export const catalogOptionsQuery = queryOptions({
	queryKey: catalogOptionsQueryKey,
	queryFn: () => listProductOptionsFn(),
});
