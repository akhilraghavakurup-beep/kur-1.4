/**
 * PlayerContent Component
 *
 * The inner content of the floating player: artwork, track info, and controls.
 */

import React, { useCallback, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { IconButton, Text } from 'react-native-paper';
import { Play, Pause, SkipBack, SkipForward, ListMusic } from 'lucide-react-native';
import { AudioWaveform } from '@/src/components/ui/audio-waveform';
import { useAppTheme, M3Shapes } from '@/lib/theme';
import type { PlayerContentProps } from './types';

export const PlayerContent = React.memo(function PlayerContent({
	artworkUrl,
	trackId,
	title,
	artistNames,
	isPlaying,
	showLoadingIndicator,
	isLoading,
	onPlayPause,
	onSkipPrevious,
	onSkipNext,
	onOpenQueue,
}: PlayerContentProps) {
	const { colors } = useAppTheme();
	const titleStyle = useMemo(() => ({ color: colors.onSurface }), [colors.onSurface]);
	const subtitleStyle = useMemo(
		() => ({ color: colors.onSurfaceVariant }),
		[colors.onSurfaceVariant]
	);

	const playPauseIcon = useCallback(
		({ size, color }: { size: number; color: string }) =>
			isPlaying ? (
				<Pause size={size} color={color} fill={color} strokeWidth={0} />
			) : (
				<Play size={size} color={color} fill={color} strokeWidth={0} />
			),
		[isPlaying]
	);

	const skipBackIcon = useCallback(
		({ size, color }: { size: number; color: string }) => (
			<SkipBack size={size} color={color} fill={color} />
		),
		[]
	);

	const skipForwardIcon = useCallback(
		({ size, color }: { size: number; color: string }) => (
			<SkipForward size={size} color={color} fill={color} />
		),
		[]
	);

	const queueIcon = useCallback(
		({ size, color }: { size: number; color: string }) => (
			<ListMusic size={size} color={color} />
		),
		[]
	);

	return (
		<View style={styles.content}>
			<View style={styles.artworkContainer}>
				<Image
					source={{ uri: artworkUrl }}
					style={styles.artwork}
					contentFit={'contain'}
					transition={200}
					cachePolicy={'memory-disk'}
					recyclingKey={trackId}
				/>
				{isPlaying && <AudioWaveform />}
				{showLoadingIndicator && (
					<View style={styles.loadingOverlay}>
						<ActivityIndicator size={'small'} color={'white'} />
					</View>
				)}
			</View>

			<View style={styles.trackInfo}>
				<Text variant={'titleMedium'} numberOfLines={1} style={[styles.title, titleStyle]}>
					{title}
				</Text>
				<Text
					variant={'bodySmall'}
					numberOfLines={1}
					style={[styles.subtitle, subtitleStyle]}
				>
					{artistNames}
				</Text>
			</View>

			<View style={styles.controls}>
				<IconButton
					icon={queueIcon}
					size={18}
					onPress={onOpenQueue}
					accessibilityLabel={'Open queue'}
					style={styles.controlButton}
				/>
				<IconButton
					icon={skipBackIcon}
					size={18}
					onPress={onSkipPrevious}
					accessibilityLabel={'Skip to previous track'}
					style={styles.controlButton}
				/>
				<IconButton
					icon={playPauseIcon}
					size={22}
					onPress={onPlayPause}
					disabled={isLoading}
					style={[styles.controlButton, styles.primaryControlButton]}
				/>
				<IconButton
					icon={skipForwardIcon}
					size={18}
					onPress={onSkipNext}
					accessibilityLabel={'Skip to next track'}
					style={styles.controlButton}
				/>
			</View>
		</View>
	);
});

const styles = StyleSheet.create({
	content: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 14,
		paddingTop: 10,
		paddingBottom: 6,
	},
	artworkContainer: {
		position: 'relative',
		overflow: 'hidden',
		borderRadius: M3Shapes.small,
	},
	artwork: {
		width: 44,
		height: 44,
		borderRadius: M3Shapes.small,
	},
	loadingOverlay: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(0,0,0,0.3)',
		borderRadius: M3Shapes.small,
	},
	trackInfo: {
		flex: 1,
		minWidth: 0,
		marginHorizontal: 12,
		paddingRight: 6,
		justifyContent: 'center',
	},
	title: {
		fontWeight: '600',
	},
	subtitle: {
		marginTop: 1,
	},
	controls: {
		flexDirection: 'row',
		alignItems: 'center',
		flexShrink: 0,
		marginRight: -4,
	},
	controlButton: {
		margin: 0,
	},
	primaryControlButton: {
		marginHorizontal: -2,
	},
});
