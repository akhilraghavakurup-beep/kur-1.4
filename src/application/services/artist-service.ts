import type { MetadataProvider } from '../../plugins/core/interfaces/metadata-provider';
import { useArtistStore } from '../state/artist-store';
import { ok, err, type Result } from '../../shared/types/result';
import { getLogger } from '../../shared/services/logger';
import { CachedService } from '../../shared/cache';
import type { Track } from '../../domain/entities/track';
import type { Album } from '../../domain/entities/album';
import type { Artist } from '../../domain/entities/artist';

const logger = getLogger('ArtistService');

interface ArtistStationCapableProvider extends MetadataProvider {
	getArtistStationTracks(
		artistId: string,
		artistName: string,
		limit?: number
	): Promise<Result<Track[], Error>>;
}

export interface ArtistDetailResult {
	artist: Artist | null;
	topTracks: Track[];
	stationTracks: Track[];
	albums: Album[];
}

const CACHE_TTL_MS = 10 * 60 * 1000;

export class ArtistService {
	private metadataProviders: MetadataProvider[] = [];
	private readonly _cachedService = new CachedService<string, ArtistDetailResult>({
		ttlMs: CACHE_TTL_MS,
		logger,
		name: 'ArtistService',
	});

	setMetadataProviders(providers: MetadataProvider[]): void {
		this.metadataProviders = providers;
		this.clearCache();
	}

	addMetadataProvider(provider: MetadataProvider): void {
		if (!this.metadataProviders.includes(provider)) {
			this.metadataProviders = [...this.metadataProviders, provider];
			this.clearCache();
		}
	}

	removeMetadataProvider(providerId: string): void {
		this.metadataProviders = this.metadataProviders.filter((p) => p.manifest.id !== providerId);
		this.clearCache();
	}

	clearCache(): void {
		this._cachedService.clearCache();
	}

	async getArtistDetail(
		artistId: string,
		fallbackName?: string
	): Promise<Result<ArtistDetailResult, Error>> {
		const store = useArtistStore.getState();
		const cacheKey = fallbackName ? `${artistId}::${fallbackName}` : artistId;

		return this._cachedService.getOrFetch(
			cacheKey,
			() => this._fetchArtistDetail(artistId, fallbackName),
			(result) =>
				store.setArtistDetail(
					artistId,
					result.artist,
					result.topTracks,
					result.stationTracks,
					result.albums
				)
		);
	}

	private async _fetchArtistDetail(
		artistId: string,
		fallbackName?: string
	): Promise<Result<ArtistDetailResult, Error>> {
		const store = useArtistStore.getState();
		store.setLoading(artistId, true);

		if (this.metadataProviders.length === 0) {
			const error = new Error('No metadata providers available');
			store.setError(artistId, error.message);
			return err(error);
		}

		const [providerPrefix, rawId] = this._parseArtistId(artistId);
		const targetProviders = providerPrefix
			? this.metadataProviders.filter((p) => p.manifest.id === providerPrefix)
			: this.metadataProviders;

		if (targetProviders.length === 0) {
			const error = new Error(`No provider found for artist ID: ${artistId}`);
			store.setError(artistId, error.message);
			return err(error);
		}

		for (const provider of targetProviders) {
			try {
				let idToUse = rawId || artistId;
				logger.debug(`Fetching artist ${idToUse} from ${provider.manifest.id}`);

				let artistInfoResult = provider.hasCapability('get-artist-info')
					? await provider.getArtistInfo(idToUse)
					: { success: false as const, error: new Error('Not supported') };
				let artistFromSearch: Artist | null = null;

				if (
					!artistInfoResult.success &&
					fallbackName &&
					provider.hasCapability('search-artists')
				) {
					const searchResult = await provider.searchArtists(fallbackName, { limit: 5 });
					if (searchResult.success && searchResult.data.items.length > 0) {
						const matchedArtist = this._pickBestArtistMatch(
							searchResult.data.items,
							fallbackName
						);
						if (matchedArtist) {
							artistFromSearch = matchedArtist;
							idToUse = this._extractProviderArtistId(matchedArtist.id) ?? idToUse;
							if (provider.hasCapability('get-artist-info')) {
								artistInfoResult = await provider.getArtistInfo(idToUse);
							}
						}
					}
				}

				const albumsResult = provider.hasCapability('get-artist-albums')
					? await provider.getArtistAlbums(idToUse, { limit: 20 })
					: {
							success: true as const,
							data: { items: [], offset: 0, limit: 0, hasMore: false },
						};

				if (!artistInfoResult.success && !albumsResult.success) {
					logger.warn(`Failed to fetch artist data from ${provider.manifest.id}`);
					continue;
				}

				const artist = artistInfoResult.success ? artistInfoResult.data : artistFromSearch;
				const albums = albumsResult.success ? albumsResult.data.items : [];
				const topTracks =
					artist && provider.hasCapability('search-tracks')
						? await provider
								.searchTracks(artist.name, { limit: 10 })
								.then((result) => (result.success ? result.data.items : []))
						: [];
				const stationTracks =
					artist && this._hasArtistStationTracks(provider)
						? await provider
								.getArtistStationTracks(idToUse, artist.name, 15)
								.then((result) => (result.success ? result.data : []))
						: [];

				const result: ArtistDetailResult = {
					artist,
					topTracks,
					stationTracks,
					albums,
				};

				store.setArtistDetail(artistId, artist, topTracks, stationTracks, albums);
				return ok(result);
			} catch (error) {
				logger.warn(
					`Error fetching artist from ${provider.manifest.id}`,
					error instanceof Error ? error : undefined
				);
			}
		}

		const error = new Error('Failed to fetch artist from any provider');
		store.setError(artistId, error.message);
		return err(error);
	}

	private _parseArtistId(artistId: string): [string | null, string | null] {
		const colonIndex = artistId.indexOf(':');
		if (colonIndex === -1) {
			return [null, null];
		}

		const prefix = artistId.substring(0, colonIndex);
		const rawId = artistId.substring(colonIndex + 1);

		if (prefix === 'jiosaavn-artist') {
			return ['jiosaavn', rawId];
		}

		const isKnownProvider = this.metadataProviders.some((p) => p.manifest.id === prefix);
		if (isKnownProvider) {
			return [prefix, rawId];
		}

		return [null, null];
	}

	private _hasArtistStationTracks(
		provider: MetadataProvider
	): provider is ArtistStationCapableProvider {
		return typeof (provider as ArtistStationCapableProvider).getArtistStationTracks === 'function';
	}

	private _extractProviderArtistId(artistId: string): string | null {
		const [, rawId] = this._parseArtistId(artistId);
		return rawId ?? artistId;
	}

	private _pickBestArtistMatch(artists: Artist[], targetName: string): Artist | null {
		if (artists.length === 0) {
			return null;
		}

		const normalizedTarget = this._normalizeArtistName(targetName);
		return (
			artists.find((artist) => this._normalizeArtistName(artist.name) === normalizedTarget) ??
			artists.find((artist) =>
				this._normalizeArtistName(artist.name).includes(normalizedTarget)
			) ??
			artists[0]
		);
	}

	private _normalizeArtistName(value: string): string {
		return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
	}
}

export const artistService = new ArtistService();
