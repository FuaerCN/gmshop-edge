import { sql } from "drizzle-orm";
import {
	check,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { timestamps } from "./common";

export const roles = sqliteTable(
	"roles",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		description: text("description"),
		builtIn: integer("built_in", { mode: "boolean" }).notNull().default(false),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		permissionsJson: text("permissions_json", { mode: "json" })
			.$type<Record<string, number>>()
			.notNull()
			.default({}),
		...timestamps,
	},
	(table) => [
		uniqueIndex("roles_name_uidx").on(table.name),
		check(
			"roles_permissions_json_check",
			sql`json_valid(${table.permissionsJson}) AND json_type(${table.permissionsJson}) = 'object'`,
		),
	],
);
