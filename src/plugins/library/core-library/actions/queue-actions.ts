import type { TrackAction, TrackActionContext } from '../../../../domain/actions/track-action';
import type { TrackActionResult } from '../../../../application/events/track-action-events';
import { CORE_ACTION_IDS } from '../../../../domain/actions/track-action';
import { usePlayerStore } from '../../../../application/state/player-store';
import type { Track } from '../../../../domain/entities/track';

interface PlayNextQueueState {
	readonly queue: Track[];
	readonly queueIndex: number;
	readonly originalQueue: Track[];
	readonly currentTrack: Track | null;
}

function findTrackIndex(queue: readonly Track[], track: Track): number {
	return queue.findIndex((item) => item.id.value === track.id.value);
}

function buildQueueWithTrackNext(state: PlayNextQueueState, track: Track): Track[] {
	const existingIndex = findTrackIndex(state.queue, track);
	if (existingIndex === state.queueIndex + 1) {
		return state.queue;
	}

	const queueWithoutTrack =
		existingIndex === -1 ? [...state.queue] : state.queue.filter((item) => item.id.value !== track.id.value);
	const insertIndex = Math.max(0, Math.min(state.queueIndex + 1, queueWithoutTrack.length));
	return [
		...queueWithoutTrack.slice(0, insertIndex),
		track,
		...queueWithoutTrack.slice(insertIndex),
	];
}

function buildOriginalQueue(state: PlayNextQueueState, track: Track): Track[] {
	const withoutTrack = state.originalQueue.filter((item) => item.id.value !== track.id.value);
	return [...withoutTrack, track];
}

function getCurrentQueueIndex(queue: readonly Track[], currentTrack: Track | null): number {
	if (!currentTrack) {
		return -1;
	}

	return queue.findIndex((item) => item.id.value === currentTrack.id.value);
}

export function getQueueActions(_context: TrackActionContext): TrackAction[] {
	return [
		{
			id: CORE_ACTION_IDS.PLAY_NEXT,
			label: 'Play Next',
			icon: 'ListStart',
			group: 'primary',
			priority: 20,
			enabled: true,
		},
		{
			id: CORE_ACTION_IDS.ADD_TO_QUEUE,
			label: 'Add to Queue',
			icon: 'ListEnd',
			group: 'primary',
			priority: 10,
			enabled: true,
		},
		...(_context.track.id.sourceType === 'jiosaavn'
			? [
					{
						id: CORE_ACTION_IDS.PLAY_NEXT_FROM_JIOSAAVN,
						label: 'Play Next from JioSaavn',
						icon: 'Sparkles',
						group: 'primary' as const,
						priority: 15,
						enabled: true,
					},
				]
			: []),
	];
}

export async function executeQueueAction(
	actionId: string,
	context: TrackActionContext
): Promise<TrackActionResult> {
	const { track } = context;

	switch (actionId) {
		case CORE_ACTION_IDS.PLAY_NEXT: {
			const store = usePlayerStore.getState();
			const queue = buildQueueWithTrackNext(store, track);
			if (queue === store.queue) {
				return {
					handled: true,
					success: true,
					feedback: { message: 'Already playing next', description: track.title },
				};
			}

			usePlayerStore.setState({
				queue,
				originalQueue: buildOriginalQueue(store, track),
				queueIndex: getCurrentQueueIndex(queue, store.currentTrack),
			});
			return {
				handled: true,
				success: true,
				feedback: { message: 'Playing next', description: track.title },
			};
		}

		case CORE_ACTION_IDS.ADD_TO_QUEUE: {
			usePlayerStore.getState().appendToQueue(track);
			return {
				handled: true,
				success: true,
				feedback: { message: 'Added to queue', description: track.title },
			};
		}

		default:
			return { handled: false };
	}
}
