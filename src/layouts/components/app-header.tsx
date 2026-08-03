import { Header } from "#/layouts/components/header";
import { ProfileDropdown } from "#/layouts/components/profile-dropdown";
import { QuickSettings } from "#/layouts/components/quick-settings";
import { Search } from "#/layouts/components/search";
import { TopNav } from "#/layouts/components/top-nav";

interface AppHeaderProps {
	fixed?: boolean;
	topNav?: {
		title: string;
		href: string;
		isActive: boolean;
		disabled?: boolean;
	}[];
}

export function AppHeader({ fixed = true, topNav }: AppHeaderProps) {
	return (
		<Header fixed={fixed}>
			{topNav ? <TopNav links={topNav} /> : <Search />}
			<div className="ms-auto flex items-center space-x-4">
				{topNav ? <Search /> : null}
				<QuickSettings />
				<ProfileDropdown />
			</div>
		</Header>
	);
}
