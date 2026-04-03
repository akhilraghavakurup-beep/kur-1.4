import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StreamQuality } from '@/src/domain/value-objects/audio-source';

export type ThemePreference = 'system' | 'light' | 'dark';
export type TabId = 'feed' | 'library' | 'downloads' | 'search';
export type DefaultTab = TabId;
export type LibraryTabId = 'songs' | 'playlists' | 'artists' | 'albums';
export type ProgressBarStyle =
	| 'expressive'
	| 'expressive-variant'
	| 'basic'
	| 'waveform'
	| 'beats'
	| 'glow-line';
export type PlayerBackground = 'artwork-blur' | 'artwork-solid' | 'theme-color';
export type HomeContentPreference =
	| 'All languages'
	| 'Bollywood'
	| 'Malayalam'
	| 'Tamil'
	| 'Telugu'
	| 'English'
	| 'Kannada'
	| 'Punjabi'
	| 'Marathi'
	| 'Bengali'
	| 'Gujarati';

export const DEFAULT_HOME_CONTENT_PREFERENCES: HomeContentPreference[] = [
	'Bollywood',
	'Malayalam',
	'Tamil',
];

export const DEFAULT_TAB_ORDER: TabId[] = ['feed', 'library', 'search', 'downloads'];
export const DEFAULT_ENABLED_TABS: TabId[] = ['feed', 'library', 'search', 'downloads'];
export const REQUIRED_TABS: TabId[] = [];

interface SettingsState {
	themePreference: ThemePreference;
	defaultTab: DefaultTab;
	homeContentPreferences: HomeContentPreference[];
	defaultLibraryTab: LibraryTabId;
	accentColor: string | null;
	tabOrder: TabId[];
	enabledTabs: TabId[];
	openPlayerOnTrackClick: boolean;
	showProviderLabel: boolean;
	progressBarStyle: ProgressBarStyle;
	playerBackground: PlayerBackground;
	preferredStreamQuality: StreamQuality;

	setThemePreference: (preference: ThemePreference) => void;
	setDefaultTab: (tab: DefaultTab) => void;
	setHomeContentPreferences: (preferences: HomeContentPreference[]) => void;
	toggleHomeContentPreference: (preference: HomeContentPreference) => void;
	selectAllHomeContentPreferences: () => void;
	resetHomeContentPreferences: () => void;
	setDefaultLibraryTab: (tab: LibraryTabId) => void;
	setAccentColor: (color: string | null) => void;
	setTabOrder: (order: TabId[]) => void;
	resetTabOrder: () => void;
	setEnabledTabs: (tabs: TabId[]) => void;
	toggleTab: (tabId: TabId) => void;
	resetEnabledTabs: () => void;
	setOpenPlayerOnTrackClick: (enabled: boolean) => void;
	setShowProviderLabel: (enabled: boolean) => void;
	setProgressBarStyle: (style: ProgressBarStyle) => void;
	setPlayerBackground: (background: PlayerBackground) => void;
	setPreferredStreamQuality: (quality: StreamQuality) => void;
	resetAllSettings: () => void;
}

const customStorage = {
	getItem: async (name: string): Promise<string | null> => {
		return AsyncStorage.getItem(name);
	},
	setItem: async (name: string, value: string): Promise<void> => {
		await AsyncStorage.setItem(name, value);
	},
	removeItem: async (name: string): Promise<void> => {
		await AsyncStorage.removeItem(name);
	},
};

export const useSettingsStore = create<SettingsState>()(
	persist(
		(set, get) => ({
			themePreference: 'system',
			defaultTab: 'feed',
			homeContentPreferences: DEFAULT_HOME_CONTENT_PREFERENCES,
			defaultLibraryTab: 'songs',
			accentColor: null,
			tabOrder: DEFAULT_TAB_ORDER,
			enabledTabs: DEFAULT_ENABLED_TABS,
			openPlayerOnTrackClick: false,
			showProviderLabel: true,
			progressBarStyle: 'expressive',
			playerBackground: 'artwork-blur',
			preferredStreamQuality: 'high',

			setThemePreference: (preference: ThemePreference) => {
				set({ themePreference: preference });
			},
			setDefaultTab: (tab: DefaultTab) => {
				set({ defaultTab: tab });
			},
			setHomeContentPreferences: (preferences: HomeContentPreference[]) => {
				const normalized = Array.from(new Set(preferences));
				set({
					homeContentPreferences: normalized.includes('All languages')
						? ['All languages']
						: normalized.filter((item) => item !== 'All languages'),
				});
			},
			toggleHomeContentPreference: (preference: HomeContentPreference) => {
				const { homeContentPreferences } = get();

				if (preference === 'All languages') {
					set({
						homeContentPreferences: homeContentPreferences.includes('All languages')
							? DEFAULT_HOME_CONTENT_PREFERENCES
							: ['All languages'],
					});
					return;
				}

				const withoutAll = homeContentPreferences.filter((item) => item !== 'All languages');
				const nextPreferences = withoutAll.includes(preference)
					? withoutAll.filter((item) => item !== preference)
					: [...withoutAll, preference];

				set({
					homeContentPreferences:
						nextPreferences.length > 0 ? nextPreferences : DEFAULT_HOME_CONTENT_PREFERENCES,
				});
			},
			selectAllHomeContentPreferences: () => {
				set({ homeContentPreferences: ['All languages'] });
			},
			resetHomeContentPreferences: () => {
				set({ homeContentPreferences: DEFAULT_HOME_CONTENT_PREFERENCES });
			},
			setDefaultLibraryTab: (tab: LibraryTabId) => {
				set({ defaultLibraryTab: tab });
			},
			setAccentColor: (color: string | null) => {
				set({ accentColor: color });
			},
			setTabOrder: (order: TabId[]) => {
				set({ tabOrder: order });
			},
			resetTabOrder: () => {
				set({ tabOrder: DEFAULT_TAB_ORDER });
			},
			setEnabledTabs: (tabs: TabId[]) => {
				const withRequired = Array.from(new Set([...tabs, ...REQUIRED_TABS]));
				set({ enabledTabs: withRequired });
			},
			toggleTab: (tabId: TabId) => {
				if (REQUIRED_TABS.includes(tabId)) return;
				const { enabledTabs, defaultTab } = get();
				const isEnabled = enabledTabs.includes(tabId);
				if (isEnabled) {
					const newEnabledTabs = enabledTabs.filter((id) => id !== tabId);
					const updates: Partial<SettingsState> = { enabledTabs: newEnabledTabs };
					if (defaultTab === tabId) {
						updates.defaultTab = newEnabledTabs[0];
					}
					set(updates);
				} else {
					set({ enabledTabs: [...enabledTabs, tabId] });
				}
			},
			resetEnabledTabs: () => {
				set({ enabledTabs: DEFAULT_ENABLED_TABS });
			},
			setOpenPlayerOnTrackClick: (enabled: boolean) => {
				set({ openPlayerOnTrackClick: enabled });
			},
			setShowProviderLabel: (enabled: boolean) => {
				set({ showProviderLabel: enabled });
			},
			setProgressBarStyle: (style: ProgressBarStyle) => {
				set({ progressBarStyle: style });
			},
			setPlayerBackground: (background: PlayerBackground) => {
				set({ playerBackground: background });
			},
			setPreferredStreamQuality: (quality: StreamQuality) => {
				set({ preferredStreamQuality: quality });
			},
			resetAllSettings: () => {
				set({
					themePreference: 'system',
					defaultTab: 'feed',
					homeContentPreferences: DEFAULT_HOME_CONTENT_PREFERENCES,
					defaultLibraryTab: 'songs',
					accentColor: null,
					tabOrder: DEFAULT_TAB_ORDER,
					enabledTabs: DEFAULT_ENABLED_TABS,
					openPlayerOnTrackClick: false,
					showProviderLabel: true,
					progressBarStyle: 'expressive',
					playerBackground: 'artwork-blur',
					preferredStreamQuality: 'high',
				});
			},
		}),
		{
			name: 'aria-settings-storage',
			storage: createJSONStorage(() => customStorage),
		}
	)
);

export const useThemePreference = () => useSettingsStore((state) => state.themePreference);

export const useSetThemePreference = () => useSettingsStore((state) => state.setThemePreference);

export const useDefaultTab = () => useSettingsStore((state) => state.defaultTab);

export const useSetDefaultTab = () => useSettingsStore((state) => state.setDefaultTab);

export const useHomeContentPreferences = () =>
	useSettingsStore((state) => state.homeContentPreferences);

export const useSetHomeContentPreferences = () =>
	useSettingsStore((state) => state.setHomeContentPreferences);

export const useToggleHomeContentPreference = () =>
	useSettingsStore((state) => state.toggleHomeContentPreference);

export const useSelectAllHomeContentPreferences = () =>
	useSettingsStore((state) => state.selectAllHomeContentPreferences);

export const useResetHomeContentPreferences = () =>
	useSettingsStore((state) => state.resetHomeContentPreferences);

export const useAccentColor = () => useSettingsStore((state) => state.accentColor);

export const useSetAccentColor = () => useSettingsStore((state) => state.setAccentColor);

export const useTabOrder = () => useSettingsStore((state) => state.tabOrder);

export const useSetTabOrder = () => useSettingsStore((state) => state.setTabOrder);

export const useResetTabOrder = () => useSettingsStore((state) => state.resetTabOrder);

export const useEnabledTabs = () => useSettingsStore((state) => state.enabledTabs);

export const useSetEnabledTabs = () => useSettingsStore((state) => state.setEnabledTabs);

export const useToggleTab = () => useSettingsStore((state) => state.toggleTab);

export const useResetEnabledTabs = () => useSettingsStore((state) => state.resetEnabledTabs);

export const useResetAllSettings = () => useSettingsStore((state) => state.resetAllSettings);

export const useDefaultLibraryTab = () => useSettingsStore((state) => state.defaultLibraryTab);

export const useSetDefaultLibraryTab = () =>
	useSettingsStore((state) => state.setDefaultLibraryTab);

export const useOpenPlayerOnTrackClick = () =>
	useSettingsStore((state) => state.openPlayerOnTrackClick);

export const useSetOpenPlayerOnTrackClick = () =>
	useSettingsStore((state) => state.setOpenPlayerOnTrackClick);

export const useShowProviderLabel = () => useSettingsStore((state) => state.showProviderLabel);

export const useSetShowProviderLabel = () =>
	useSettingsStore((state) => state.setShowProviderLabel);

export const useProgressBarStyle = () => useSettingsStore((state) => state.progressBarStyle);

export const useSetProgressBarStyle = () => useSettingsStore((state) => state.setProgressBarStyle);

export const usePlayerBackground = () => useSettingsStore((state) => state.playerBackground);

export const useSetPlayerBackground = () => useSettingsStore((state) => state.setPlayerBackground);

export const usePreferredStreamQuality = () =>
	useSettingsStore((state) => state.preferredStreamQuality);

export const useSetPreferredStreamQuality = () =>
	useSettingsStore((state) => state.setPreferredStreamQuality);
