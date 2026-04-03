import type { Album } from '@domain/entities/album';
import type { Artist } from '@domain/entities/artist';
import type { Playlist } from '@domain/entities/playlist';
import type { Track } from '@domain/entities/track';
import type { AudioStream } from '@domain/value-objects/audio-stream';
import type { TrackId } from '@domain/value-objects/track-id';
import type { PluginInitContext, PluginStatus } from '@plugins/core/interfaces/base-plugin';
import type { HomeFeedOperations } from '@plugins/core/interfaces/home-feed-provider';
import {
	type MetadataCapability,
	type MetadataProvider,
	type RecommendationParams,
	type RecommendationSeed,
	type SearchOptions,
	type SearchResults,
} from '@plugins/core/interfaces/metadata-provider';
import {
	type AudioSourceCapability,
	type AudioSourceProvider,
	type AvailableFormat,
	type StreamOptions,
} from '@plugins/core/interfaces/audio-source-provider';
import type { Result } from '@shared/types/result';
import { err, ok } from '@shared/types/result';
import {
	AUDIO_CAPABILITIES,
	CONFIG_SCHEMA,
	DEFAULT_CONFIG,
	type JioSaavnConfig,
	METADATA_CAPABILITIES,
	PLUGIN_MANIFEST,
} from './config';
import { createJioSaavnClient, type JioSaavnClient } from './client';
import { createHomeFeedOperations } from './home-feed-operations';
import { createInfoOperations, type InfoOperations } from './info';
import { mapSong } from './mappers';
import { createSearchOperations, type SearchOperations } from './search';
import { createStreamingOperations, type StreamingOperations } from './streaming';

export class JioSaavnProvider implements MetadataProvider, AudioSourceProvider {
	readonly manifest = PLUGIN_MANIFEST;
	readonly configSchema = CONFIG_SCHEMA;
	readonly capabilities = new Set<MetadataCapability>(METADATA_CAPABILITIES);
	readonly audioCapabilities = new Set<AudioSourceCapability>(AUDIO_CAPABILITIES);
	status: PluginStatus = 'uninitialized';

	private client: JioSaavnClient | null = null;
	private searchOps: SearchOperations | null = null;
	private infoOps: InfoOperations | null = null;
	private streamingOps: StreamingOperations | null = null;
	private homeFeedOps: HomeFeedOperations | null = null;
	private config: JioSaavnConfig;

	constructor(config: JioSaavnConfig = DEFAULT_CONFIG) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	get homeFeed(): HomeFeedOperations {
		if (!this.homeFeedOps) {
			throw new Error('JioSaavn provider not initialized');
		}
		return this.homeFeedOps;
	}

	async onInit(context: PluginInitContext): Promise<Result<void, Error>> {
		try {
			this.status = 'initializing';
			const config: JioSaavnConfig = { ...this.config, ...context.config };
			this.client = createJioSaavnClient({
				baseUrl: config.baseUrl ?? DEFAULT_CONFIG.baseUrl ?? 'https://saavn.sumit.co',
			});
			this.searchOps = createSearchOperations(this.client);
			this.infoOps = createInfoOperations(this.client);
			this.streamingOps = createStreamingOperations(this.client);
			this.homeFeedOps = createHomeFeedOperations(this.client);
			this.status = 'ready';
			return ok(undefined);
		} catch (error) {
			this.status = 'error';
			return err(error instanceof Error ? error : new Error(String(error)));
		}
	}

	async onActivate(): Promise<Result<void, Error>> {
		this.status = 'active';
		return ok(undefined);
	}

	async onDeactivate(): Promise<Result<void, Error>> {
		this.status = 'ready';
		return ok(undefined);
	}

	async onDestroy(): Promise<Result<void, Error>> {
		this.client = null;
		this.searchOps = null;
		this.infoOps = null;
		this.streamingOps = null;
		this.homeFeedOps = null;
		this.status = 'uninitialized';
		return ok(undefined);
	}

	getRecommendations(
		seed: RecommendationSeed,
		_params?: RecommendationParams,
		limit = 10
	): Promise<Result<Track[], Error>> {
		if (!this.client) {
			return Promise.resolve(err(new Error('JioSaavn provider not initialized')));
		}

		const seedTrack = seed.tracks?.[0];
		if (!seedTrack || seedTrack.sourceType !== 'jiosaavn') {
			return Promise.resolve(err(new Error('JioSaavn recommendations require a JioSaavn track')));
		}

		return this.client
			.getSongSuggestions(seedTrack.sourceId, limit)
			.then((songs) =>
				ok(
					songs
						.map(mapSong)
						.filter((track): track is Track => !!track && track.id.value !== seedTrack.value)
				)
			)
			.catch((error) => err(error instanceof Error ? error : new Error(String(error))));
	}

	async getArtistStationTracks(
		_artistId: string,
		artistName: string,
		limit = 20
	): Promise<Result<Track[], Error>> {
		if (!this.client) {
			return err(new Error('JioSaavn provider not initialized'));
		}

		if (!artistName.trim()) {
			return err(new Error('Artist name is required for station playback'));
		}

		try {
			const stationId = await this.client.createArtistStation(artistName, 'hindi,english');
			const songs = await this.client.getRadioSongs(stationId, limit, 1, 'hindi,english');
			return ok(songs.map(mapSong).filter((track): track is Track => !!track));
		} catch (error) {
			return err(error instanceof Error ? error : new Error(String(error)));
		}
	}

	hasCapability(capability: MetadataCapability): boolean {
		return this.capabilities.has(capability);
	}

	hasAudioCapability(capability: AudioSourceCapability): boolean {
		return this.audioCapabilities.has(capability);
	}

	supportsTrack(track: Track): boolean {
		return this._streaming().supportsTrack(track);
	}

	searchTracks(query: string, options?: SearchOptions): Promise<Result<SearchResults<Track>, Error>> {
		return this._search().searchTracks(query, options);
	}

	searchAlbums(query: string, options?: SearchOptions): Promise<Result<SearchResults<Album>, Error>> {
		return this._search().searchAlbums(query, options);
	}

	searchArtists(query: string, options?: SearchOptions): Promise<Result<SearchResults<Artist>, Error>> {
		return this._search().searchArtists(query, options);
	}

	searchPlaylists(
		query: string,
		options?: SearchOptions
	): Promise<Result<SearchResults<Playlist>, Error>> {
		return this._search().searchPlaylists(query, options);
	}

	getTrackInfo(trackId: TrackId): Promise<Result<Track, Error>> {
		return this._info().getTrackInfo(trackId);
	}

	getAlbumInfo(albumId: string): Promise<Result<Album, Error>> {
		return this._info().getAlbumInfo(albumId);
	}

	getArtistInfo(artistId: string): Promise<Result<Artist, Error>> {
		return this._info().getArtistInfo(artistId);
	}

	getPlaylistInfo(playlistId: string): Promise<Result<Playlist, Error>> {
		return this._info().getPlaylistInfo(playlistId);
	}

	getAlbumTracks(
		albumId: string,
		options?: Pick<SearchOptions, 'limit' | 'offset'>
	): Promise<Result<SearchResults<Track>, Error>> {
		return this._info().getAlbumTracks(albumId, options);
	}

	getArtistAlbums(
		artistId: string,
		options?: Pick<SearchOptions, 'limit' | 'offset'>
	): Promise<Result<SearchResults<Album>, Error>> {
		return this._info().getArtistAlbums(artistId, options);
	}

	getStreamUrl(track: Track, options?: StreamOptions): Promise<Result<AudioStream, Error>> {
		return this._streaming().getStreamUrl(track, options);
	}

	getAvailableFormats(trackId: TrackId): Promise<Result<AvailableFormat[], Error>> {
		return this._streaming().getAvailableFormats(trackId);
	}

	private _search(): SearchOperations {
		if (!this.searchOps) {
			throw new Error('JioSaavn provider not initialized');
		}
		return this.searchOps;
	}

	private _info(): InfoOperations {
		if (!this.infoOps) {
			throw new Error('JioSaavn provider not initialized');
		}
		return this.infoOps;
	}

	private _streaming(): StreamingOperations {
		if (!this.streamingOps) {
			throw new Error('JioSaavn provider not initialized');
		}
		return this.streamingOps;
	}
}

export function createJioSaavnProvider(config?: JioSaavnConfig): JioSaavnProvider {
	return new JioSaavnProvider(config);
}
