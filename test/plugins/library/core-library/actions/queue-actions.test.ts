import { beforeEach, describe, expect, it } from 'vitest';
import { Duration } from '@domain/value-objects/duration';
import { TrackId } from '@domain/value-objects/track-id';
import { createStreamingSource } from '@domain/value-objects/audio-source';
import type { Track } from '@domain/entities/track';
import { CORE_ACTION_IDS } from '@/src/domain/actions/track-action';
import { usePlayerStore } from '@/src/application/state/player-store';
import { executeQueueAction } from '@/src/plugins/library/core-library/actions/queue-actions';

function createTestTrack(id: string): Track {
	return {
		id: TrackId.create('jiosaavn', id),
		title: `Track ${id}`,
		artists: [{ id: `artist-${id}`, name: `Artist ${id}` }],
		duration: Duration.fromSeconds(180),
		source: createStreamingSource('jiosaavn', id),
		metadata: {},
		playCount: 0,
		isFavorite: false,
	};
}

describe('executeQueueAction', () => {
	beforeEach(() => {
		const store = usePlayerStore.getState();
		store.stop();
		usePlayerStore.setState({
			queue: [],
			queueIndex: -1,
			originalQueue: [],
			repeatMode: 'off',
			isShuffled: false,
			volume: 1,
			isMuted: false,
		});
	});

	it('should not duplicate a track when it is already next in queue', async () => {
		// Arrange
		const firstTrack = createTestTrack('1');
		const nextTrack = createTestTrack('2');
		usePlayerStore.getState().setQueue([firstTrack, nextTrack], 0);

		// Act
		const result = await executeQueueAction(CORE_ACTION_IDS.PLAY_NEXT, {
			track: nextTrack,
			source: 'queue',
		});

		// Assert
		expect(result.success).toBe(true);
		expect(result.feedback?.message).toBe('Already playing next');
		expect(usePlayerStore.getState().queue.map((item) => item.id.value)).toEqual([
			firstTrack.id.value,
			nextTrack.id.value,
		]);
	});

	it('should move an existing queued track to next when it already exists later in queue', async () => {
		// Arrange
		const firstTrack = createTestTrack('1');
		const middleTrack = createTestTrack('2');
		const lastTrack = createTestTrack('3');
		usePlayerStore.getState().setQueue([firstTrack, middleTrack, lastTrack], 0);

		// Act
		const result = await executeQueueAction(CORE_ACTION_IDS.PLAY_NEXT, {
			track: lastTrack,
			source: 'queue',
		});

		// Assert
		expect(result.success).toBe(true);
		expect(usePlayerStore.getState().queue.map((item) => item.id.value)).toEqual([
			firstTrack.id.value,
			lastTrack.id.value,
			middleTrack.id.value,
		]);
		expect(
			usePlayerStore.getState().queue.filter((item) => item.id.value === lastTrack.id.value)
		).toHaveLength(1);
	});
});
