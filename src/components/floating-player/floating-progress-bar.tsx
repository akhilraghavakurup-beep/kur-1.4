/**
 * FloatingProgressBar Component
 *
 * Compact waveform-inspired progress track for the floating mini player.
 * Uses an animated clipped overlay so progress updates stay smooth without
 * re-rendering the whole floating player subtree.
 */

import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useAnimatedProgress } from '@/src/hooks/use-animated-progress';
import { useAppTheme } from '@/lib/theme';

const BAR_PATTERN = [5, 8, 11, 7, 10, 6, 12, 8, 5, 9, 12, 7, 10, 6, 11, 8] as const;

export const FloatingProgressBar = memo(function FloatingProgressBar() {
	const progress = useAnimatedProgress();
	const { colors } = useAppTheme();

	const progressStyle = useAnimatedStyle(() => ({
		width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
	}));

	return (
		<View style={styles.container}>
			<WaveformBars color={colors.primaryContainer} opacity={0.75} />
			<Animated.View style={[styles.activeOverlay, progressStyle]}>
				<WaveformBars color={colors.primary} opacity={1} />
			</Animated.View>
		</View>
	);
});

const WaveformBars = memo(function WaveformBars({
	color,
	opacity,
}: {
	readonly color: string;
	readonly opacity: number;
}) {
	return (
		<View style={styles.barRow}>
			{BAR_PATTERN.map((height, index) => (
				<View
					key={`wave-${index}`}
					style={[
						styles.bar,
						{
							height,
							backgroundColor: color,
							opacity,
						},
					]}
				/>
			))}
		</View>
	);
});

const styles = StyleSheet.create({
	container: {
		height: 12,
		justifyContent: 'center',
		overflow: 'hidden',
		paddingHorizontal: 10,
	},
	barRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 3,
	},
	bar: {
		width: 4,
		borderRadius: 999,
	},
	activeOverlay: {
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 0,
		overflow: 'hidden',
		paddingHorizontal: 10,
	},
});
