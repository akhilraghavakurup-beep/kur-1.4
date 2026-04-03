import { memo, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import DraggableFlatList, {
	type DragEndParams,
	type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GripVerticalIcon, LanguagesIcon } from 'lucide-react-native';
import { Text } from 'react-native-paper';
import { useAppTheme, M3Shapes } from '@/lib/theme';
import { HOME_CONTENT_PREFERENCE_OPTIONS } from '@/lib/settings-config';
import type { HomeContentPreference } from '@/src/application/state/settings-store';
import { Icon } from '@/src/components/ui/icon';

type SelectedLanguagePreference = Exclude<HomeContentPreference, 'All languages'>;

interface HomeLanguagePriorityPickerProps {
	readonly preferences: HomeContentPreference[];
	readonly onReorder: (preferences: SelectedLanguagePreference[]) => void;
}

const LANGUAGE_LABELS = new Map(
	HOME_CONTENT_PREFERENCE_OPTIONS.filter((option) => option.value !== 'All languages').map(
		(option) => [option.value, option.label]
	)
);

export const HomeLanguagePriorityPicker = memo(function HomeLanguagePriorityPicker({
	preferences,
	onReorder,
}: HomeLanguagePriorityPickerProps) {
	const { colors } = useAppTheme();
	const selectedPreferences = useMemo(
		() =>
			preferences.filter(
				(preference): preference is SelectedLanguagePreference => preference !== 'All languages'
			),
		[preferences]
	);
	const isAllLanguagesSelected = preferences.includes('All languages');

	const keyExtractor = useCallback((item: SelectedLanguagePreference) => item, []);

	const handleDragEnd = useCallback(
		({ data }: DragEndParams<SelectedLanguagePreference>) => {
			onReorder(data);
		},
		[onReorder]
	);

	const renderItem = useCallback(
		({ item, drag, isActive }: RenderItemParams<SelectedLanguagePreference>) => {
			const label = LANGUAGE_LABELS.get(item) ?? item;

			return (
				<Pressable
					onLongPress={drag}
					delayLongPress={120}
					style={[
						styles.priorityRow,
						{
							backgroundColor: isActive
								? colors.secondaryContainer
								: colors.surfaceContainerHighest,
						},
					]}
				>
					<View style={styles.priorityText}>
						<Text variant={'labelLarge'} style={[styles.priorityLabel, { color: colors.onSurface }]}>
							{label}
						</Text>
						<Text variant={'bodySmall'} style={{ color: colors.onSurfaceVariant }}>
							Long press and drag to change priority
						</Text>
					</View>
					<Icon as={GripVerticalIcon} size={18} color={colors.onSurfaceVariant} />
				</Pressable>
			);
		},
		[colors]
	);

	if (isAllLanguagesSelected) {
		return (
			<View
				style={[
					styles.helperCard,
					{ backgroundColor: colors.surfaceContainerHighest },
				]}
			>
				<Icon as={LanguagesIcon} size={18} color={colors.onSurfaceVariant} />
				<View style={styles.helperText}>
					<Text variant={'labelLarge'} style={{ color: colors.onSurface }}>
						All languages is enabled
					</Text>
					<Text variant={'bodySmall'} style={{ color: colors.onSurfaceVariant }}>
						Turn it off below to drag and prioritize specific languages.
					</Text>
				</View>
			</View>
		);
	}

	if (selectedPreferences.length <= 1) {
		return (
			<View
				style={[
					styles.helperCard,
					{ backgroundColor: colors.surfaceContainerHighest },
				]}
			>
				<Icon as={LanguagesIcon} size={18} color={colors.onSurfaceVariant} />
				<View style={styles.helperText}>
					<Text variant={'labelLarge'} style={{ color: colors.onSurface }}>
						Selected languages
					</Text>
					<Text variant={'bodySmall'} style={{ color: colors.onSurfaceVariant }}>
						Select at least two languages below to reorder their priority.
					</Text>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text variant={'titleSmall'} style={{ color: colors.onSurface }}>
				Selected languages
			</Text>
			<Text variant={'bodySmall'} style={{ color: colors.onSurfaceVariant }}>
				Drag to decide which languages the home feed should favor first.
			</Text>
			<DraggableFlatList
				data={selectedPreferences}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				onDragEnd={handleDragEnd}
				scrollEnabled={false}
				activationDistance={8}
				containerStyle={styles.list}
				contentContainerStyle={styles.listContent}
			/>
		</View>
	);
});

const styles = StyleSheet.create({
	container: {
		gap: 8,
		marginBottom: 12,
	},
	list: {
		flexGrow: 0,
	},
	listContent: {
		gap: 8,
	},
	priorityRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderRadius: M3Shapes.medium,
	},
	priorityText: {
		flex: 1,
		gap: 2,
	},
	priorityLabel: {
		fontWeight: '600',
	},
	helperCard: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderRadius: M3Shapes.medium,
		marginBottom: 12,
	},
	helperText: {
		flex: 1,
		marginLeft: 12,
		gap: 2,
	},
});
