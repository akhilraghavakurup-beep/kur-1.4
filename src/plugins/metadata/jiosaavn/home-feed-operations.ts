import type {
	FeedFilterChip,
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

interface BrowsePreset {
	label: string;
	language: string;
}

interface SectionDefinition {
	key: string;
	titleMatcher: (title: string) => boolean;
	mapItems: (items: unknown[]) => FeedItem[];
	subtitle?: string;
}

const BROWSE_PRESETS: BrowsePreset[] = [
	{ label: 'All', language: 'hindi,english' },
	{ label: 'Hindi', language: 'hindi' },
	{ label: 'English', language: 'english' },
	{ label: 'Malayalam', language: 'malayalam' },
	{ label: 'Tamil', language: 'tamil' },
	{ label: 'Telugu', language: 'telugu' },
];

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

function itemMatchesLanguage(item: unknown, language: string): boolean {
	if (!item || typeof item !== 'object') {
		return false;
	}

	const candidate = item as {
		language?: string | null;
		dominantLanguage?: string | null;
		more_info?: { language?: string | null } | null;
	};

	const languages = [
		...normalizeLanguageTokens(candidate.language),
		...normalizeLanguageTokens(candidate.dominantLanguage),
		...normalizeLanguageTokens(candidate.more_info?.language),
	];

	if (languages.length === 0) {
		return false;
	}

	return languages.includes(language);
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

function findPreset(chipText?: string): BrowsePreset {
	if (!chipText) {
		return BROWSE_PRESETS[0];
	}
	return (
		BROWSE_PRESETS.find((preset) => preset.label.toLowerCase() === chipText.toLowerCase()) ??
		BROWSE_PRESETS[0]
	);
}

function buildFilterChips(selected: string): FeedFilterChip[] {
	return BROWSE_PRESETS.map((preset) => ({
		text: preset.label,
		isSelected: preset.label === selected,
	}));
}

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

async function buildHomeFeed(client: JioSaavnClient, preset: BrowsePreset): Promise<HomeFeedData> {
	const launchData = await client.getLaunchData(preset.language);
	const sections: FeedSection[] = [];
	const singleLanguage = preset.language.includes(',') ? null : preset.language;

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

		const scopedItems =
			singleLanguage === null ? items : items.filter((item) => itemMatchesLanguage(item, singleLanguage));
		const mappedItems = definition.mapItems(scopedItems);
		const section = createSection(moduleKey, title, mappedItems, definition.subtitle ?? module.subtitle);
		if (section) {
			sections.push(section);
		}
	}

	return {
		sections,
		filterChips: buildFilterChips(preset.label),
		hasContinuation: false,
	};
}

export function createHomeFeedOperations(client: JioSaavnClient): HomeFeedOperations {
	let selectedFilter = BROWSE_PRESETS[0].label;

	return {
		async getHomeFeed(): Promise<Result<HomeFeedData, Error>> {
			try {
				selectedFilter = BROWSE_PRESETS[0].label;
				return ok(await buildHomeFeed(client, findPreset(selectedFilter)));
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},

		async applyFilter(chipText: string): Promise<Result<HomeFeedData, Error>> {
			try {
				selectedFilter = findPreset(chipText).label;
				return ok(await buildHomeFeed(client, findPreset(selectedFilter)));
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},

		async loadMore(): Promise<Result<HomeFeedData, Error>> {
			return ok({
				sections: [],
				filterChips: buildFilterChips(selectedFilter),
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
