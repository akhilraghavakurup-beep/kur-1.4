import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Text, IconButton } from 'react-native-paper';
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	CircleIcon,
	LanguagesIcon,
	ListOrderedIcon,
	RefreshCwIcon,
	SettingsIcon,
} from 'lucide-react-native';
import { SettingsBottomSheet } from '@/src/components/settings/settings-bottom-sheet';
import { SettingsItem } from '@/src/components/settings/settings-item';
import { HomeLanguagePriorityPicker } from '@/src/components/settings/home-language-priority-picker';
import { useAppTheme, resolveDisplayFont } from '@/lib/theme';
import { homeFeedService } from '@/src/application/services/home-feed-service';
import { useActiveDownloadsCount } from '@/src/application/state/download-store';
import {
	useHomeContentPreferences,
	useHomeFeedPriority,
	useMoveHomeFeedPriorityDown,
	useMoveHomeFeedPriorityUp,
	useResetHomeContentPreferences,
	useResetHomeFeedPriority,
	useSetHomeContentPreferences,
	useToggleHomeContentPreference,
	useTabOrder,
	useEnabledTabs,
	type TabId,
	DEFAULT_TAB_ORDER,
} from '@/src/application/state/settings-store';
import { HOME_CONTENT_PREFERENCE_OPTIONS } from '@/lib/settings-config';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TAB_CONFIG, TAB_BAR_HEIGHT } from '@/lib/tab-config';
import { LottieTabIcon } from '@/src/components/ui/lottie-tab-icon';
import { StaticTabIcon } from '@/src/components/ui/static-tab-icon';
import { Icon } from '@/src/components/ui/icon';

const TAB_WIDTH = 72;
const TAB_GAP = 12;
const INDICATOR_WIDTH = 64;
const INDICATOR_HEIGHT = 32;
const INDICATOR_TOP = 11;

const TAB_SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.5 };
const HOME_FEED_PRIORITY_LABELS = {
	'trending-now': 'Trending Now',
	'top-charts': 'Top Charts',
	'new-releases': 'New Releases',
	'hot-in-thiruvananthapuram': "What's Hot In Thiruvananthapuram",
	'editorial-picks': 'Editorial Picks',
	'radio-stations': 'Radio Stations',
	'recommended-artist-stations': 'Recommended Artist Stations',
	'fresh-hits': 'Fresh Hits',
} as const;

// Lightweight pub/sub so the tab bar can notify the header of active tab
// changes without re-rendering the parent TabLayout (which would recreate
// Tabs.Screen children and trigger full screen unmount/remount).
type ActiveTabListener = (tabId: TabId) => void;
const activeTabListeners = new Set<ActiveTabListener>();

function emitActiveTab(tabId: TabId): void {
	activeTabListeners.forEach((fn) => fn(tabId));
}

function useActiveTabListener(initial: TabId): TabId {
	const [tabId, setTabId] = useState<TabId>(initial);

	useEffect(() => {
		activeTabListeners.add(setTabId);
		return () => {
			activeTabListeners.delete(setTabId);
		};
	}, []);

	return tabId;
}

export default function TabLayout() {
	const tabOrder = useTabOrder();
	const enabledTabs = useEnabledTabs();

	const validTabOrder = useMemo(() => {
		const safeTabOrder =
			Array.isArray(tabOrder) && tabOrder.length > 0 ? tabOrder : DEFAULT_TAB_ORDER;
		const safeEnabledTabs =
			Array.isArray(enabledTabs) && enabledTabs.length > 0 ? enabledTabs : DEFAULT_TAB_ORDER;

		const validTabs = safeTabOrder.filter((id) => id in TAB_CONFIG);
		if (validTabs.length !== DEFAULT_TAB_ORDER.length) {
			const filtered = DEFAULT_TAB_ORDER.filter((id) => safeEnabledTabs.includes(id));
			return filtered.length > 0 ? filtered : DEFAULT_TAB_ORDER;
		}
		const filtered = validTabs.filter((id) => safeEnabledTabs.includes(id));
		return filtered.length > 0 ? filtered : DEFAULT_TAB_ORDER;
	}, [tabOrder, enabledTabs]);

	const { colors } = useAppTheme();

	const screenOptions = useMemo(
		() => ({
			headerShown: false,
			animation: 'shift' as const,
			lazy: false,
			freezeOnBlur: true,
			sceneStyle: {
				borderTopLeftRadius: 48,
				borderTopRightRadius: 48,
				overflow: 'hidden' as const,
				backgroundColor: colors.background,
			},
		}),
		[colors.background]
	);

	// Stabilize the tabBar render callback so the navigator never receives a
	// new function reference on re-render.
	const renderTabBar = useCallback(
		(props: BottomTabBarProps) => (
			<CustomTabBar {...props} tabOrder={validTabOrder} onActiveTabChange={emitActiveTab} />
		),
		[validTabOrder]
	);

	return (
		<View style={styles.layoutRoot}>
			<TabHeader initialTabId={validTabOrder[0]} />
			<Tabs screenOptions={screenOptions} tabBar={renderTabBar}>
				<Tabs.Screen name={'index'} options={{ href: null }} />
				{validTabOrder.map((tabId) => {
					const config = TAB_CONFIG[tabId];
					if (!config) return null;
					return <Tabs.Screen key={tabId} name={tabId} options={config} />;
				})}
			</Tabs>
		</View>
	);
}

function TabHeader({ initialTabId }: { readonly initialTabId: TabId }) {
	const currentTabId = useActiveTabListener(initialTabId);
	const { colors } = useAppTheme();
	const insets = useSafeAreaInsets();
	const homeContentPreferences = useHomeContentPreferences();
	const homeFeedPriority = useHomeFeedPriority();
	const moveHomeFeedPriorityUp = useMoveHomeFeedPriorityUp();
	const moveHomeFeedPriorityDown = useMoveHomeFeedPriorityDown();
	const resetHomeContentPreferences = useResetHomeContentPreferences();
	const resetHomeFeedPriority = useResetHomeFeedPriority();
	const setHomeContentPreferences = useSetHomeContentPreferences();
	const toggleHomeContentPreference = useToggleHomeContentPreference();
	const [preferencesSheetOpen, setPreferencesSheetOpen] = useState(false);
	const title = TAB_CONFIG[currentTabId]?.title ?? '';

	return (
		<>
			<View
				style={[
					styles.tabHeader,
					{ paddingTop: insets.top, backgroundColor: colors.background },
				]}
			>
				<View style={styles.headerActions}>
					<IconButton
						icon={() => (
							<Icon as={LanguagesIcon} size={22} color={colors.onSurfaceVariant} />
						)}
						onPress={() => setPreferencesSheetOpen(true)}
						accessibilityLabel={'Home recommendation preferences'}
					/>
					<IconButton
						icon={() => <Icon as={SettingsIcon} size={22} color={colors.onSurfaceVariant} />}
						onPress={() => router.push('/settings')}
						accessibilityLabel={'Settings'}
					/>
				</View>
				<Text
					variant={'headlineMedium'}
					style={[
						styles.headerTitle,
						{ fontFamily: resolveDisplayFont('700'), color: colors.onSurface },
					]}
				>
					{title}
				</Text>
				<View style={styles.headerActionSpacer}>
					<IconButton
						icon={() => (
							<Icon as={RefreshCwIcon} size={20} color={colors.onSurfaceVariant} />
						)}
						onPress={() => homeFeedService.fetchHomeFeed({ force: true })}
						accessibilityLabel={'Refresh recommendations'}
					/>
				</View>
			</View>

			<SettingsBottomSheet
				isOpen={preferencesSheetOpen}
				onClose={() => setPreferencesSheetOpen(false)}
				portalName={'home-preferences-sheet'}
				title={'Home recommendations'}
			>
				<HomeLanguagePriorityPicker
					preferences={homeContentPreferences}
					onReorder={setHomeContentPreferences}
				/>
				<SettingsItem
					icon={RefreshCwIcon}
					title={'Reset to defaults'}
					subtitle={'Return to Bollywood, Malayalam, and Tamil focus'}
					onPress={resetHomeContentPreferences}
				/>
				{HOME_CONTENT_PREFERENCE_OPTIONS.map((option) => (
					<SettingsItem
						key={option.value}
						icon={option.icon}
						title={option.label}
						subtitle={
							option.value === 'All languages'
								? 'Use broad discovery across all supported languages'
								: `Boost ${option.label} suggestions on the home screen`
						}
						rightElement={
							<IconButton
								icon={() => (
									<Icon
										as={
											homeContentPreferences.includes(option.value)
												? CheckIcon
												: CircleIcon
										}
										size={18}
										color={
											homeContentPreferences.includes(option.value)
												? colors.primary
												: colors.onSurfaceVariant
										}
									/>
								)}
								onPress={() => toggleHomeContentPreference(option.value)}
								accessibilityLabel={option.label}
							/>
						}
						onPress={() => toggleHomeContentPreference(option.value)}
					/>
				))}
				<SettingsItem
					icon={ListOrderedIcon}
					title={'Reset home section priority'}
					subtitle={'Restore the default section order'}
					onPress={resetHomeFeedPriority}
				/>
				{homeFeedPriority.map((section, index) => (
					<SettingsItem
						key={section}
						icon={ListOrderedIcon}
						title={HOME_FEED_PRIORITY_LABELS[section]}
						subtitle={`Priority ${index + 1}`}
						rightElement={
							<View style={styles.priorityActions}>
								<IconButton
									icon={() => (
										<Icon
											as={ChevronUpIcon}
											size={18}
											color={index === 0 ? colors.outlineVariant : colors.onSurfaceVariant}
										/>
									)}
									disabled={index === 0}
									onPress={() => moveHomeFeedPriorityUp(section)}
									accessibilityLabel={`Move ${HOME_FEED_PRIORITY_LABELS[section]} up`}
								/>
								<IconButton
									icon={() => (
										<Icon
											as={ChevronDownIcon}
											size={18}
											color={
												index === homeFeedPriority.length - 1
													? colors.outlineVariant
													: colors.onSurfaceVariant
											}
										/>
									)}
									disabled={index === homeFeedPriority.length - 1}
									onPress={() => moveHomeFeedPriorityDown(section)}
									accessibilityLabel={`Move ${HOME_FEED_PRIORITY_LABELS[section]} down`}
								/>
							</View>
						}
					/>
				))}
			</SettingsBottomSheet>
		</>
	);
}

interface CustomTabBarProps extends BottomTabBarProps {
	readonly tabOrder: TabId[];
	readonly onActiveTabChange: (tabId: TabId) => void;
}

function CustomTabBar({ state, navigation, tabOrder, onActiveTabChange }: CustomTabBarProps) {
	const { colors } = useAppTheme();
	const insets = useSafeAreaInsets();
	const activeDownloadsCount = useActiveDownloadsCount();
	const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;

	const currentRouteName = state.routes[state.index]?.name as TabId;
	const visualIndex = tabOrder.indexOf(currentRouteName);
	const initialX =
		Math.max(0, visualIndex) * (TAB_WIDTH + TAB_GAP) + (TAB_WIDTH - INDICATOR_WIDTH) / 2;

	const indicatorX = useSharedValue(initialX);

	useEffect(() => {
		onActiveTabChange(currentRouteName);
		const newVisualIndex = tabOrder.indexOf(currentRouteName);
		if (newVisualIndex >= 0) {
			const newX = newVisualIndex * (TAB_WIDTH + TAB_GAP) + (TAB_WIDTH - INDICATOR_WIDTH) / 2;
			indicatorX.value = withSpring(newX, {
				damping: 25,
				stiffness: 180,
				mass: 0.5,
			});
		}
	}, [currentRouteName, tabOrder, indicatorX, onActiveTabChange]);

	const animatedIndicatorStyle = useAnimatedStyle(() => {
		return {
			transform: [{ translateX: indicatorX.value }],
		};
	});

	const handleTabPress = useCallback(
		(visualIdx: number, routeIndex: number, routeName: string) => {
			const newX = visualIdx * (TAB_WIDTH + TAB_GAP) + (TAB_WIDTH - INDICATOR_WIDTH) / 2;
			indicatorX.value = withSpring(newX, {
				damping: 25,
				stiffness: 180,
				mass: 0.5,
			});

			const event = navigation.emit({
				type: 'tabPress',
				target: state.routes[routeIndex].key,
				canPreventDefault: true,
			});

			if (!event.defaultPrevented) {
				navigation.navigate(routeName);
			}
		},
		[navigation, state.routes, indicatorX]
	);

	return (
		<View style={styles.tabBarContainer}>
			<View
				style={[
					styles.tabBar,
					{
						backgroundColor: colors.surfaceContainer,
						height: tabBarHeight,
						paddingBottom: insets.bottom,
					},
				]}
			>
				<View style={styles.tabsContainer}>
					<Animated.View
						style={[
							styles.indicator,
							{ backgroundColor: colors.secondaryContainer, top: INDICATOR_TOP },
							animatedIndicatorStyle,
						]}
					/>

					{tabOrder.map((tabId, visualIdx) => {
						const config = TAB_CONFIG[tabId];
						if (!config) return null;
						const route = state.routes.find((r) => r.name === tabId);
						if (!route) return null;
						const routeIndex = state.routes.indexOf(route);
						const isFocused = state.index === routeIndex;
						const isDownloadsTab = tabId === 'downloads';
						const downloadBadgeCount = isDownloadsTab
							? activeDownloadsCount || undefined
							: undefined;

						return (
							<Pressable
								key={tabId}
								onPress={() => handleTabPress(visualIdx, routeIndex, tabId)}
								style={styles.tabButton}
								accessibilityRole={'tab'}
								accessibilityLabel={config.title}
								accessibilityState={{ selected: isFocused }}
							>
								{config.lottieSource ? (
									<LottieTabIcon
										source={config.lottieSource}
										isFocused={isFocused}
										focusedColor={colors.primary}
										inactiveColor={colors.onSurfaceVariant}
										badgeCount={downloadBadgeCount}
									/>
								) : (
									<StaticTabIcon
										icon={config.icon}
										isFocused={isFocused}
										focusedColor={colors.primary}
										inactiveColor={colors.onSurfaceVariant}
									/>
								)}
								<TabLabel
									label={config.title ?? ''}
									isFocused={isFocused}
									color={colors.primary}
								/>
							</Pressable>
						);
					})}
				</View>
			</View>
		</View>
	);
}

interface TabLabelProps {
	label: string;
	isFocused: boolean;
	color: string;
}

const TabLabel = memo(function TabLabel({ label, isFocused, color }: TabLabelProps) {
	const opacity = useSharedValue(isFocused ? 1 : 0);
	const translateY = useSharedValue(isFocused ? 0 : 4);

	useEffect(() => {
		opacity.value = withSpring(isFocused ? 1 : 0, TAB_SPRING_CONFIG);
		translateY.value = withSpring(isFocused ? 0 : 4, TAB_SPRING_CONFIG);
	}, [isFocused, opacity, translateY]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ translateY: translateY.value }],
	}));

	return (
		<Animated.Text numberOfLines={1} style={[styles.tabLabel, { color }, animatedStyle]}>
			{label}
		</Animated.Text>
	);
});

const styles = StyleSheet.create({
	layoutRoot: {
		flex: 1,
	},
	tabHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 4,
		paddingBottom: 4,
	},
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
		width: 112,
	},
	headerActionSpacer: {
		width: 112,
		alignItems: 'flex-end',
	},
	headerTitle: {
		flex: 1,
		textAlign: 'center',
	},
	priorityActions: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	tabBarContainer: {
		position: 'relative',
	},
	tabBar: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		borderTopWidth: 0,
		elevation: 0,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -1 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	tabsContainer: {
		flexDirection: 'row',
		gap: TAB_GAP,
	},
	indicator: {
		position: 'absolute',
		left: 0,
		width: INDICATOR_WIDTH,
		height: INDICATOR_HEIGHT,
		borderRadius: 16,
	},
	tabButton: {
		width: 72,
		alignItems: 'center',
		justifyContent: 'center',
		height: TAB_BAR_HEIGHT,
		gap: 6,
	},
	tabLabel: {
		fontSize: 11,
		fontWeight: '500',
		width: '100%',
		textAlign: 'center',
	},
});
