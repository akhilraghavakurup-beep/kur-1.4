import type {
	FeedItem,
	FeedSection,
	HomeFeedData,
} from '@domain/entities/feed-section';
import type { Track } from '@domain/entities/track';
import type {
	HomeFeedOperations,
	PlaylistTracksPage,
} from '@plugins/core/interfaces/home-feed-provider';
import { err, ok, type Result } from '@shared/types/result';
import { useSettingsStore, type HomeContentPreference } from '@/src/application/state/settings-store';
import type {
	JioSaavnLaunchModule,
	JioSaavnAlbum,
	JioSaavnPlaylist,
	JioSaavnRadioStation,
	JioSaavnSong,
} from './types';
import type { JioSaavnClient } from './client';
import {
	mapAlbum,
	mapArtistStation,
	mapPlaylistFeed,
	mapSong,
	stripSourcePrefix,
} from './mappers';

export type {
	HomeFeedOperations,
	PlaylistTracksPage,
} from '@plugins/core/interfaces/home-feed-provider';

interface SectionDefinition {
	key: string;
	titleMatcher: (title: string) => boolean;
	mapItems: (items: unknown[]) => FeedItem[];
	subtitle?: string;
}

const PLAYLIST_FETCH_LIMIT = 200;

const matchesTitle =
	(...patterns: string[]) =>
	(title: string) =>
		patterns.some((pattern) => title.toLowerCase().includes(pattern));

function normalizeLanguageTokens(value?: string | null): string[] {
	if (!value) {
		return [];
	}

	return value
		.split(',')
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean);
}

function mapPreferenceToApiLanguage(preference: HomeContentPreference): string | null {
	switch (preference) {
		case 'Bollywood':
			return 'hindi';
		case 'Malayalam':
			return 'malayalam';
		case 'Tamil':
			return 'tamil';
		case 'Telugu':
			return 'telugu';
		case 'English':
			return 'english';
		case 'All languages':
		default:
			return null;
	}
}

function getPreferredLanguages(): string[] {
	const preferences = useSettingsStore.getState().homeContentPreferences;
	if (preferences.includes('All languages')) {
		return ['hindi', 'english', 'malayalam', 'tamil', 'telugu'];
	}

	const mapped = preferences
		.map(mapPreferenceToApiLanguage)
		.filter((value): value is string => !!value);

	return mapped.length > 0 ? mapped : ['hindi', 'malayalam', 'tamil'];
}

function getPreferredLanguageHeader(): string {
	return getPreferredLanguages().join(',');
}

function getItemLanguageSet(item: unknown): Set<string> {
	if (!item || typeof item !== 'object') {
		return new Set();
	}

	const candidate = item as {
		language?: string | null;
		dominantLanguage?: string | null;
		subtitle?: string | null;
		title?: string | null;
		name?: string | null;
		more_info?: { language?: string | null; query?: string | null } | null;
	};

	const languages = new Set<string>([
		...normalizeLanguageTokens(candidate.language),
		...normalizeLanguageTokens(candidate.dominantLanguage),
		...normalizeLanguageTokens(candidate.more_info?.language),
	]);

	const text = [
		candidate.subtitle,
		candidate.title,
		candidate.name,
		candidate.more_info?.query,
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();

	if (text.includes('bollywood')) {
		languages.add('hindi');
	}

	return languages;
}

function scoreItemForPreferences(item: unknown, preferredLanguages: string[]): number {
	const itemLanguages = getItemLanguageSet(item);
	if (itemLanguages.size === 0) {
		return 0;
	}

	return preferredLanguages.reduce((score, language, index) => {
		return itemLanguages.has(language) ? score + (preferredLanguages.length - index) * 10 : score;
	}, 0);
}

function sortItemsForPreferences(items: unknown[]): unknown[] {
	const preferredLanguages = getPreferredLanguages();
	return [...items].sort((left, right) => {
		const scoreDiff =
			scoreItemForPreferences(right, preferredLanguages) -
			scoreItemForPreferences(left, preferredLanguages);
		if (scoreDiff !== 0) {
			return scoreDiff;
		}
		return 0;
	});
}

function mapMixedFeedItems(items: unknown[]): FeedItem[] {
	const mapped: FeedItem[] = [];

	for (const item of items) {
		if (!item || typeof item !== 'object') {
			continue;
		}

		const candidate = item as JioSaavnSong | JioSaavnPlaylist;
		switch (candidate.type) {
			case 'song':
				{
					const track = mapSong(candidate as JioSaavnSong);
					if (track) {
						mapped.push({ type: 'track', data: track });
					}
				}
				break;
			case 'album':
				{
					const album = mapAlbum(candidate as JioSaavnAlbum);
					if (album) {
						mapped.push({ type: 'album', data: album });
					}
				}
				break;
			case 'playlist':
				{
					const playlist = mapPlaylistFeed(candidate as JioSaavnPlaylist);
					if (playlist) {
						mapped.push({ type: 'playlist', data: playlist });
					}
				}
				break;
			default:
				break;
		}
	}

	return mapped;
}

function mapPlaylistItems(items: unknown[]): FeedItem[] {
	return items
		.map((item) => mapPlaylistFeed(item as JioSaavnPlaylist))
		.filter((playlist): playlist is NonNullable<ReturnType<typeof mapPlaylistFeed>> => !!playlist)
		.map((playlist) => ({ type: 'playlist' as const, data: playlist }));
}

function mapArtistStationItems(items: unknown[]): FeedItem[] {
	return items
		.map((item) => mapArtistStation(item as JioSaavnRadioStation))
		.filter((artist): artist is NonNullable<ReturnType<typeof mapArtistStation>> => !!artist)
		.map((artist) => ({ type: 'artist' as const, data: artist }));
}

const SECTION_DEFINITIONS: SectionDefinition[] = [
	{
		key: 'new_trending',
		titleMatcher: matchesTitle('trending now', 'trending'),
		mapItems: mapMixedFeedItems,
		subtitle: 'What is moving fastest right now',
	},
	{
		key: 'charts',
		titleMatcher: matchesTitle('top charts', 'superhits', 'chartbusters'),
		mapItems: mapPlaylistItems,
		subtitle: 'The biggest chart playlists on JioSaavn',
	},
	{
		key: 'new_albums',
		titleMatcher: matchesTitle('new releases', 'new release'),
		mapItems: mapMixedFeedItems,
		subtitle: 'Fresh songs and albums just added',
	},
	{
		key: 'top_playlists',
		titleMatcher: matchesTitle('editorial picks', 'editor picks'),
		mapItems: mapPlaylistItems,
		subtitle: 'Curated playlists from JioSaavn editors',
	},
	{
		key: 'artist_recos',
		titleMatcher: matchesTitle('recommended artist stations', 'artist stations'),
		mapItems: mapArtistStationItems,
		subtitle: 'Open an artist to start their station',
	},
	{
		key: 'promo:fresh-hits',
		titleMatcher: matchesTitle('fresh hits'),
		mapItems: mapMixedFeedItems,
		subtitle: 'More new favorites to explore',
	},
	{
		key: 'promo:genres',
		titleMatcher: matchesTitle('top genres', 'genres & moods'),
		mapItems: mapPlaylistItems,
		subtitle: 'Jump into genres, moods, and starter collections',
	},
];

function createSection(
	key: string,
	title: string,
	items: FeedItem[],
	subtitle?: string
): FeedSection | null {
	if (items.length === 0) {
		return null;
	}

	return {
		id: `jiosaavn-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
		title,
		subtitle,
		items,
		source: 'remote',
	};
}

function getModuleOrder(modules?: Record<string, JioSaavnLaunchModule>): string[] {
	if (!modules) {
		return [];
	}

	return Object.entries(modules)
		.sort(([, left], [, right]) => (left.position ?? 999) - (right.position ?? 999))
		.map(([key]) => key);
}

async function buildHomeFeed(client: JioSaavnClient): Promise<HomeFeedData> {
	const launchData = await client.getLaunchData(getPreferredLanguageHeader());
	const sections: FeedSection[] = [];

	for (const moduleKey of getModuleOrder(launchData.modules)) {
		const module = launchData.modules?.[moduleKey];
		const title = module?.title?.trim();
		const items = launchData[moduleKey];

		if (!title || !Array.isArray(items) || items.length === 0) {
			continue;
		}

		const definition = SECTION_DEFINITIONS.find(
			(candidate) =>
				(candidate.key === moduleKey || candidate.key.startsWith('promo:')) &&
				candidate.titleMatcher(title)
		);
		if (!definition) {
			continue;
		}

		const scopedItems = sortItemsForPreferences(items);
		const mappedItems = definition.mapItems(scopedItems);
		const section = createSection(moduleKey, title, mappedItems, definition.subtitle ?? module.subtitle);
		if (section) {
			sections.push(section);
		}
	}

	return {
		sections,
		filterChips: [],
		hasContinuation: false,
	};
}

export function createHomeFeedOperations(client: JioSaavnClient): HomeFeedOperations {
	return {
		async getHomeFeed(): Promise<Result<HomeFeedData, Error>> {
			try {
				return ok(await buildHomeFeed(client));
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},

		async applyFilter(_chipText: string): Promise<Result<HomeFeedData, Error>> {
			try {
				return ok(await buildHomeFeed(client));
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},

		async loadMore(): Promise<Result<HomeFeedData, Error>> {
			return ok({
				sections: [],
				filterChips: [],
				hasContinuation: false,
			});
		},

		async getPlaylistTracks(playlistId: string): Promise<Result<PlaylistTracksPage, Error>> {
			try {
				const playlist = await client.getPlaylist(stripSourcePrefix(playlistId), PLAYLIST_FETCH_LIMIT);
				const tracks = (playlist.songs ?? [])
					.map(mapSong)
					.filter((track): track is Track => !!track);
				return ok({
					tracks,
					hasMore: false,
				});
			} catch (error) {
				return err(
					error instanceof Error
						? error
						: new Error(`Failed to fetch playlist tracks: ${String(error)}`)
				);
			}
		},

		async loadMorePlaylistTracks(): Promise<Result<PlaylistTracksPage, Error>> {
			return ok({ tracks: [], hasMore: false });
		},
	};
}
