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

interface PreferredSectionDefinition {
	preference: Exclude<HomeContentPreference, 'All languages'>;
	query: string;
	title: string;
	subtitle: string;
}

interface SearchSectionQueryDefinition {
	preference: Exclude<HomeContentPreference, 'All languages'>;
	queries: string[];
}

interface CachedHomeFeedEntry {
	data: HomeFeedData;
	cachedAt: number;
}

const PLAYLIST_FETCH_LIMIT = 200;
const HOME_FEED_CACHE_TTL_MS = 10 * 60 * 1000;
const HOME_FEED_CACHE_VERSION = 'v2';

const PREFERRED_SECTIONS: PreferredSectionDefinition[] = [
	{
		preference: 'Bollywood',
		query: 'Bollywood Hits',
		title: 'Bollywood Picks',
		subtitle: 'Popular Hindi and Bollywood playlists picked for your home feed',
	},
	{
		preference: 'Malayalam',
		query: 'Malayalam Hits',
		title: 'Malayalam Picks',
		subtitle: 'Fresh Malayalam playlists and staples to start from',
	},
	{
		preference: 'Tamil',
		query: 'Tamil Hits',
		title: 'Tamil Picks',
		subtitle: 'Tamil favorites and trending playlist shortcuts',
	},
	{
		preference: 'Telugu',
		query: 'Telugu Hits',
		title: 'Telugu Picks',
		subtitle: 'Telugu playlists shaped by your listening preference',
	},
	{
		preference: 'English',
		query: 'English Hits',
		title: 'English Picks',
		subtitle: 'English playlists to balance your home feed',
	},
];

const LOCALIZED_CHART_QUERIES: SearchSectionQueryDefinition[] = [
	{
		preference: 'Bollywood',
		queries: ['Hindi: India Superhits Top 50', 'Bollywood Top 50', 'Hindi Top Charts'],
	},
	{
		preference: 'Malayalam',
		queries: ['Malayalam Superhits Top 50', 'Malayalam Top Charts', 'Malayalam Hits'],
	},
	{
		preference: 'Tamil',
		queries: ['Tamil Superhits Top 50', 'Tamil Top Charts', 'Tamil Hits'],
	},
	{
		preference: 'Telugu',
		queries: ['Telugu Superhits Top 50', 'Telugu Top Charts', 'Telugu Hits'],
	},
	{
		preference: 'English',
		queries: ['English Superhits Top 50', 'English Top Charts', 'English Hits'],
	},
];

const LOCALIZED_EDITORIAL_QUERIES: SearchSectionQueryDefinition[] = [
	{
		preference: 'Bollywood',
		queries: ['Bollywood Dance Hits', 'Bollywood Love Songs', 'Bollywood Essentials'],
	},
	{
		preference: 'Malayalam',
		queries: ['Malayalam Hits', 'Malayalam Love Songs', 'Malayalam Essentials'],
	},
	{
		preference: 'Tamil',
		queries: ['Tamil Hits', 'Tamil Love Songs', 'Tamil Essentials'],
	},
	{
		preference: 'Telugu',
		queries: ['Telugu Hits', 'Telugu Love Songs', 'Telugu Essentials'],
	},
	{
		preference: 'English',
		queries: ['English Hits', 'English Pop Hits', 'English Essentials'],
	},
];

const LOCALIZED_NEW_RELEASE_QUERIES: SearchSectionQueryDefinition[] = [
	{
		preference: 'Bollywood',
		queries: ['Hindi New Releases', 'Bollywood New Releases', 'New Hindi Songs'],
	},
	{
		preference: 'Malayalam',
		queries: ['Malayalam New Releases', 'New Malayalam Songs', 'Latest Malayalam'],
	},
	{
		preference: 'Tamil',
		queries: ['Tamil New Releases', 'New Tamil Songs', 'Latest Tamil'],
	},
	{
		preference: 'Telugu',
		queries: ['Telugu New Releases', 'New Telugu Songs', 'Latest Telugu'],
	},
	{
		preference: 'English',
		queries: ['English New Releases', 'New English Songs', 'Latest English'],
	},
];

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

function getPreferredSearchDefinitions(
	definitions: SearchSectionQueryDefinition[]
): SearchSectionQueryDefinition[] {
	const selected = getSelectedPreferences();
	return definitions.filter((definition) => selected.includes(definition.preference));
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

function getSelectedPreferences(): Exclude<HomeContentPreference, 'All languages'>[] {
	const preferences = useSettingsStore
		.getState()
		.homeContentPreferences.filter(
			(preference): preference is Exclude<HomeContentPreference, 'All languages'> =>
				preference !== 'All languages'
		);

	return preferences.length > 0 ? preferences : ['Bollywood', 'Malayalam', 'Tamil'];
}

function getPreferredLanguageHeader(): string {
	return getPreferredLanguages().join(',');
}

function getPreferenceSignature(): string {
	const preferences = useSettingsStore.getState().homeContentPreferences;
	return `${HOME_FEED_CACHE_VERSION}:${preferences.join('|')}`;
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

function interleaveBuckets<T>(buckets: T[][], limit: number): T[] {
	const queue = buckets.map((bucket) => [...bucket]);
	const results: T[] = [];

	while (results.length < limit) {
		let moved = false;
		for (const bucket of queue) {
			const next = bucket.shift();
			if (!next) {
				continue;
			}

			results.push(next);
			moved = true;
			if (results.length >= limit) {
				break;
			}
		}

		if (!moved) {
			break;
		}
	}

	return results;
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

function mapAnyFeedItems(items: unknown[]): FeedItem[] {
	const mapped: FeedItem[] = [];

	for (const item of items) {
		if (!item || typeof item !== 'object') {
			continue;
		}

		const candidate = item as
			| JioSaavnSong
			| JioSaavnAlbum
			| JioSaavnPlaylist
			| JioSaavnRadioStation;

		if (candidate.type === 'radio_station') {
			const artist = mapArtistStation(candidate as JioSaavnRadioStation);
			if (artist) {
				mapped.push({ type: 'artist', data: artist });
			}
			continue;
		}

		const mixed = mapMixedFeedItems([candidate]);
		if (mixed.length > 0) {
			mapped.push(...mixed);
			continue;
		}

		const playlist = mapPlaylistFeed(candidate as JioSaavnPlaylist);
		if (playlist) {
			mapped.push({ type: 'playlist', data: playlist });
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
	{
		key: 'radio',
		titleMatcher: matchesTitle('radio stations', 'radio'),
		mapItems: mapArtistStationItems,
		subtitle: 'Lean back with artist and station-based recommendations',
	},
	{
		key: 'promo:podcasts',
		titleMatcher: matchesTitle('trending podcasts', 'podcasts'),
		mapItems: mapAnyFeedItems,
		subtitle: 'Popular spoken-audio recommendations from JioSaavn',
	},
	{
		key: 'city_mod',
		titleMatcher: matchesTitle(`what's hot`, 'trending this week', 'hot in'),
		mapItems: mapAnyFeedItems,
		subtitle: 'Regional momentum and what is trending around you',
	},
	{
		key: 'promo:classics',
		titleMatcher: matchesTitle('best of 90s', '90s', 'retro'),
		mapItems: mapAnyFeedItems,
		subtitle: 'Throwback recommendations and catalog favorites',
	},
	{
		key: 'promo:new-release-focus',
		titleMatcher: matchesTitle('new releases pop', 'new releases', 'pop -'),
		mapItems: mapAnyFeedItems,
		subtitle: 'More focused release shelves directly from JioSaavn promos',
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

	const ordered = Object.entries(modules)
		.sort(([, left], [, right]) => (left.position ?? 999) - (right.position ?? 999))
		.map(([key]) => key);

	const cityModuleIndex = ordered.indexOf('city_mod');
	if (cityModuleIndex > 4) {
		const [cityModule] = ordered.splice(cityModuleIndex, 1);
		ordered.splice(4, 0, cityModule);
	}

	return ordered;
}

async function buildPreferredSections(client: JioSaavnClient): Promise<FeedSection[]> {
	const preferences = getSelectedPreferences();
	const sections = await Promise.all(
		PREFERRED_SECTIONS.filter((section) => preferences.includes(section.preference)).map(
			async (section) => {
				try {
					const response = await client.searchPlaylists(section.query, 0, 8);
					const items = response.results
						.map(mapPlaylistFeed)
						.filter((playlist): playlist is NonNullable<ReturnType<typeof mapPlaylistFeed>> => !!playlist)
						.map((playlist) => ({ type: 'playlist' as const, data: playlist }));

					if (items.length === 0) {
						return null;
					}

					return createSection(
						`preferred-${section.preference.toLowerCase()}`,
						section.title,
						items,
						section.subtitle
					);
				} catch {
					return null;
				}
			}
		)
	);

	return sections.filter((section): section is FeedSection => !!section);
}

async function buildLocalizedPlaylistSection(
	client: JioSaavnClient,
	key: string,
	title: string,
	subtitle: string,
	definitions: SearchSectionQueryDefinition[],
	limit = 12
): Promise<FeedSection | null> {
	const buckets = await Promise.all(
		getPreferredSearchDefinitions(definitions).map(async (definition) => {
			for (const query of definition.queries) {
				try {
					const response = await client.searchPlaylistsWeb(
						query,
						1,
						6,
						mapPreferenceToApiLanguage(definition.preference) ?? getPreferredLanguageHeader()
					);
					const items = response.results
						.map(mapPlaylistFeed)
						.filter((playlist): playlist is NonNullable<ReturnType<typeof mapPlaylistFeed>> => !!playlist)
						.map((playlist) => ({ type: 'playlist' as const, data: playlist }));

					if (items.length > 0) {
						return items;
					}
				} catch {
					continue;
				}
			}

			return [];
		})
	);

	return createSection(key, title, interleaveBuckets(buckets, limit), subtitle);
}

async function buildLocalizedAlbumSection(
	client: JioSaavnClient,
	key: string,
	title: string,
	subtitle: string,
	definitions: SearchSectionQueryDefinition[],
	limit = 12
): Promise<FeedSection | null> {
	const buckets = await Promise.all(
		getPreferredSearchDefinitions(definitions).map(async (definition) => {
			for (const query of definition.queries) {
				try {
					const response = await client.searchAlbumsWeb(
						query,
						1,
						6,
						mapPreferenceToApiLanguage(definition.preference) ?? getPreferredLanguageHeader()
					);
					const items = response.results
						.map(mapAlbum)
						.filter((album): album is NonNullable<ReturnType<typeof mapAlbum>> => !!album)
						.map((album) => ({ type: 'album' as const, data: album }));

					if (items.length > 0) {
						return items;
					}
				} catch {
					continue;
				}
			}

			return [];
		})
	);

	return createSection(key, title, interleaveBuckets(buckets, limit), subtitle);
}

function itemDedupKey(item: FeedItem): string {
	switch (item.type) {
		case 'track':
			return `track:${item.data.id.value}`;
		case 'album':
			return `album:${item.data.id.value}`;
		case 'artist':
			return `artist:${item.data.id}`;
		case 'playlist':
			return `playlist:${item.data.id}`;
	}
}

function dedupeSections(sections: FeedSection[]): FeedSection[] {
	const seenItems = new Set<string>();
	const seenSectionTitles = new Set<string>();
	const deduped: FeedSection[] = [];

	for (const section of sections) {
		const titleKey = section.title.trim().toLowerCase();
		if (seenSectionTitles.has(titleKey)) {
			continue;
		}

		const items = section.items.filter((item) => {
			const key = itemDedupKey(item);
			if (seenItems.has(key)) {
				return false;
			}
			seenItems.add(key);
			return true;
		});

		if (items.length === 0) {
			continue;
		}

		seenSectionTitles.add(titleKey);
		deduped.push({
			...section,
			items,
		});
	}

	return deduped;
}

async function buildHomeFeed(client: JioSaavnClient): Promise<HomeFeedData> {
	const launchData = await client.getLaunchData(getPreferredLanguageHeader());
	const sections = await buildPreferredSections(client);
	const localizedSections = (
		await Promise.all([
			buildLocalizedPlaylistSection(
				client,
				'localized-charts',
				'Top Charts',
				'Chart playlists blended from your selected languages',
				LOCALIZED_CHART_QUERIES
			),
			buildLocalizedAlbumSection(
				client,
				'localized-new-releases',
				'New Releases',
				'Fresh releases pulled across your selected languages',
				LOCALIZED_NEW_RELEASE_QUERIES
			),
			buildLocalizedPlaylistSection(
				client,
				'localized-editorial-picks',
				'Editorial Picks',
				'Curated playlists mixed from the languages you selected',
				LOCALIZED_EDITORIAL_QUERIES
			),
		])
	).filter((section): section is FeedSection => !!section);
	sections.push(...localizedSections);

	for (const moduleKey of getModuleOrder(launchData.modules)) {
		const module = launchData.modules?.[moduleKey];
		const title = module?.title?.trim();
		const items = launchData[moduleKey];

		if (!title || !Array.isArray(items) || items.length === 0) {
			continue;
		}

		if (title === 'Top Charts' || title === 'New Releases' || title === 'Editorial Picks') {
			continue;
		}

		const definition = SECTION_DEFINITIONS.find(
			(candidate) =>
				(candidate.key === moduleKey || candidate.key.startsWith('promo:')) &&
				candidate.titleMatcher(title)
		);

		const scopedItems = definition?.key === 'new_trending' ? sortItemsForPreferences(items) : items;
		const mappedItems = definition ? definition.mapItems(scopedItems) : mapAnyFeedItems(scopedItems);
		const section = createSection(
			moduleKey,
			title,
			mappedItems,
			definition?.subtitle ?? module.subtitle
		);
		if (section) {
			sections.push(section);
		}
	}

	return {
		sections: dedupeSections(sections),
		filterChips: [],
		hasContinuation: false,
	};
}

export function createHomeFeedOperations(client: JioSaavnClient): HomeFeedOperations {
	const cache = new Map<string, CachedHomeFeedEntry>();

	return {
		async getHomeFeed(): Promise<Result<HomeFeedData, Error>> {
			try {
				const signature = getPreferenceSignature();
				const cached = cache.get(signature);
				if (cached && Date.now() - cached.cachedAt < HOME_FEED_CACHE_TTL_MS) {
					return ok(cached.data);
				}

				const data = await buildHomeFeed(client);
				cache.set(signature, { data, cachedAt: Date.now() });
				return ok(data);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},

		async applyFilter(_chipText: string): Promise<Result<HomeFeedData, Error>> {
			try {
				const data = await buildHomeFeed(client);
				cache.set(getPreferenceSignature(), { data, cachedAt: Date.now() });
				return ok(data);
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
