import {
	NewspaperIcon,
	MusicIcon,
	SearchIcon,
	DownloadIcon,
	ListMusicIcon,
	UsersIcon,
	DiscIcon,
	MonitorSmartphoneIcon,
	SunIcon,
	MoonIcon,
	ImageIcon,
	PaletteIcon,
	SwatchBookIcon,
	type LucideIcon,
} from 'lucide-react-native';
import type {
	ThemePreference,
	DefaultTab,
	HomeLanguage,
	LibraryTabId,
	PlayerBackground,
} from '@/src/application/state/settings-store';
import type { StreamQuality } from '@/src/domain/value-objects/audio-source';

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
	{ value: 'system', label: 'System', icon: MonitorSmartphoneIcon },
	{ value: 'light', label: 'Light', icon: SunIcon },
	{ value: 'dark', label: 'Dark', icon: MoonIcon },
];

export const DEFAULT_TAB_OPTIONS: { value: DefaultTab; label: string; icon: LucideIcon }[] = [
	{ value: 'feed', label: 'Home', icon: NewspaperIcon },
	{ value: 'library', label: 'Library', icon: MusicIcon },
	{ value: 'search', label: 'Search', icon: SearchIcon },
	{ value: 'downloads', label: 'Downloads', icon: DownloadIcon },
];

export const HOME_LANGUAGE_OPTIONS: {
	value: HomeLanguage;
	label: string;
	icon: LucideIcon;
}[] = [
	{ value: 'All', label: 'All', icon: NewspaperIcon },
	{ value: 'Hindi', label: 'Hindi', icon: MusicIcon },
	{ value: 'English', label: 'English', icon: MusicIcon },
	{ value: 'Malayalam', label: 'Malayalam', icon: MusicIcon },
	{ value: 'Tamil', label: 'Tamil', icon: MusicIcon },
	{ value: 'Telugu', label: 'Telugu', icon: MusicIcon },
];

export const LIBRARY_TAB_OPTIONS: { value: LibraryTabId; label: string; icon: LucideIcon }[] = [
	{ value: 'songs', label: 'Songs', icon: MusicIcon },
	{ value: 'playlists', label: 'Playlists', icon: ListMusicIcon },
	{ value: 'artists', label: 'Artists', icon: UsersIcon },
	{ value: 'albums', label: 'Albums', icon: DiscIcon },
];

export const TAB_INDEX_MAP: Record<LibraryTabId, number> = {
	songs: 0,
	artists: 1,
	albums: 2,
	playlists: 3,
};

export const PLAYER_BACKGROUND_OPTIONS: {
	value: PlayerBackground;
	label: string;
	icon: LucideIcon;
}[] = [
	{ value: 'artwork-blur', label: 'Blurred', icon: ImageIcon },
	{ value: 'artwork-solid', label: 'Solid', icon: PaletteIcon },
	{ value: 'theme-color', label: 'Themed', icon: SwatchBookIcon },
];

export const STREAM_QUALITY_OPTIONS: {
	value: StreamQuality;
	label: string;
	icon: LucideIcon;
}[] = [
	{ value: 'low', label: 'Low', icon: DownloadIcon },
	{ value: 'medium', label: 'Medium', icon: DownloadIcon },
	{ value: 'high', label: 'High', icon: DownloadIcon },
];
