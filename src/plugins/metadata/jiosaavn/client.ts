import { getLogger } from '@shared/services/logger';
import type {
	JioSaavnAlbum,
	JioSaavnAlbumSearchResponse,
	JioSaavnApiResponse,
	JioSaavnArtist,
	JioSaavnArtistPageDetails,
	JioSaavnArtistSearchResponse,
	JioSaavnGlobalSearchResponse,
	JioSaavnLaunchData,
	JioSaavnPagedResults,
	JioSaavnPlaylist,
	JioSaavnPlaylistSearchResponse,
	JioSaavnRadioSongsResponse,
	JioSaavnRadioStationResponse,
	JioSaavnSong,
	JioSaavnSongDetailsResponse,
	JioSaavnSongSearchResponse,
} from './types';

const logger = getLogger('JioSaavnClient');

export interface JioSaavnClientConfig {
	baseUrl: string;
}

const WEB_API_BASE_URL = 'https://www.jiosaavn.com';
const WEB_API_PATH = '/api.php?_format=json&_marker=0&api_version=4&ctx=web6dot0';

export class JioSaavnClient {
	private readonly baseUrl: string;

	constructor(config: JioSaavnClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/+$/, '');
	}

	searchAll(query: string, signal?: AbortSignal) {
		if (this._usesDirectWebApi()) {
			return this._webGet<JioSaavnGlobalSearchResponse>(
				'search.getResults',
				{ q: query, p: 1, n: 20 },
				{ signal }
			);
		}
		return this._get<JioSaavnGlobalSearchResponse>('/api/search', { query }, signal);
	}

	searchSongs(query: string, page = 0, limit = 20, signal?: AbortSignal) {
		if (this._usesDirectWebApi()) {
			return this._webGet<JioSaavnSongSearchResponse>(
				'search.getResults',
				{ q: query, p: page + 1, n: limit },
				{ signal }
			);
		}
		return this._get<JioSaavnSongSearchResponse>('/api/search/songs', { query, page, limit }, signal);
	}

	searchAlbums(query: string, page = 0, limit = 20, signal?: AbortSignal) {
		if (this._usesDirectWebApi()) {
			return this.searchAlbumsWeb(query, page + 1, limit, undefined, signal);
		}
		return this._get<JioSaavnAlbumSearchResponse>('/api/search/albums', { query, page, limit }, signal);
	}

	searchArtists(query: string, page = 0, limit = 20, signal?: AbortSignal) {
		if (this._usesDirectWebApi()) {
			return this._webGet<JioSaavnArtistSearchResponse>(
				'search.getArtistResults',
				{ q: query, p: page + 1, n: limit },
				{ signal }
			);
		}
		return this._get<JioSaavnArtistSearchResponse>('/api/search/artists', { query, page, limit }, signal);
	}

	searchPlaylists(query: string, page = 0, limit = 20, signal?: AbortSignal) {
		if (this._usesDirectWebApi()) {
			return this.searchPlaylistsWeb(query, page + 1, limit, undefined, signal);
		}
		return this._get<JioSaavnPlaylistSearchResponse>(
			'/api/search/playlists',
			{ query, page, limit },
			signal
		);
	}

	searchAlbumsWeb(query: string, page = 1, limit = 20, language?: string, signal?: AbortSignal) {
		return this._webGet<JioSaavnAlbumSearchResponse>(
			'search.getAlbumResults',
			{ q: query, p: page, n: limit },
			{ language, signal }
		);
	}

	searchPlaylistsWeb(
		query: string,
		page = 1,
		limit = 20,
		language?: string,
		signal?: AbortSignal
	) {
		return this._webGet<JioSaavnPlaylistSearchResponse>(
			'search.getPlaylistResults',
			{ q: query, p: page, n: limit },
			{ language, signal }
		);
	}

	getSongSuggestions(songId: string, limit = 20, signal?: AbortSignal) {
		if (this._usesDirectWebApi()) {
			return this._webGet<JioSaavnSong[]>('reco.getreco', { pid: songId }, { signal });
		}
		return this._get<JioSaavnSong[]>(`/api/songs/${songId}/suggestions`, { limit }, signal);
	}

	async getSong(songId: string, signal?: AbortSignal): Promise<JioSaavnSong> {
		if (this._usesDirectWebApi()) {
			const data = await this._webGet<JioSaavnSongDetailsResponse>(
				'song.getDetails',
				{ pids: songId },
				{ signal }
			);
			const first = data.songs?.[0];
			if (!first) {
				throw new Error(`Song "${songId}" was not found`);
			}
			return first;
		}

		const data = await this._get<JioSaavnSong[] | JioSaavnSong>(`/api/songs/${songId}`, {}, signal);
		if (Array.isArray(data)) {
			const first = data[0];
			if (!first) {
				throw new Error(`Song "${songId}" was not found`);
			}
			return first;
		}
		return data;
	}

	getAlbum(albumId: string, signal?: AbortSignal): Promise<JioSaavnAlbum> {
		if (this._usesDirectWebApi()) {
			return this._webGet<JioSaavnAlbum>('content.getAlbumDetails', { cc: 'in', albumid: albumId }, { signal }).then(
				(album) => ({
					...album,
					songCount: album.songCount ?? album.list_count,
					songs: album.songs ?? album.list,
				})
			);
		}
		return this._get<JioSaavnAlbum>('/api/albums', { id: albumId }, signal);
	}

	getArtist(artistId: string, signal?: AbortSignal): Promise<JioSaavnArtist> {
		if (this._usesDirectWebApi()) {
			return this.getArtistPageDetails(artistId, undefined, signal);
		}
		return this._get<JioSaavnArtist>('/api/artists', { id: artistId }, signal);
	}

	getArtistPageDetails(
		artistId: string,
		language?: string,
		signal?: AbortSignal
	): Promise<JioSaavnArtistPageDetails> {
		return this._webGet<JioSaavnArtistPageDetails>(
			'artist.getArtistPageDetails',
			{ artistId },
			{ language, signal }
		);
	}

	getArtistAlbums(
		artistId: string,
		page = 1,
		signal?: AbortSignal
	): Promise<JioSaavnPagedResults<JioSaavnAlbum>> {
		if (this._usesDirectWebApi()) {
			return this.getArtistPageDetails(artistId, undefined, signal).then((artist) => {
				const results = [...(artist.topAlbums ?? []), ...(artist.singles ?? [])];
				return { total: results.length, results };
			});
		}
		return this._get<JioSaavnPagedResults<JioSaavnAlbum>>(
			`/api/artists/${artistId}/albums`,
			{ page },
			signal
		);
	}

	getPlaylist(playlistId: string, limit = 200, signal?: AbortSignal): Promise<JioSaavnPlaylist> {
		if (this._usesDirectWebApi()) {
			return this._webGet<JioSaavnPlaylist>(
				'playlist.getDetails',
				{ cc: 'in', listid: playlistId },
				{ signal }
			).then((playlist) => ({
				...playlist,
				songCount: playlist.songCount ?? playlist.list_count,
				count: playlist.count ?? playlist.list_count,
				songs: playlist.songs ?? playlist.list?.slice(0, limit),
			}));
		}
		return this._get<JioSaavnPlaylist>('/api/playlists', { id: playlistId, limit }, signal);
	}

	getLaunchData(language?: string, signal?: AbortSignal): Promise<JioSaavnLaunchData> {
		return this._webGet<JioSaavnLaunchData>('webapi.getLaunchData', {}, { language, signal });
	}

	async createArtistStation(
		artistName: string,
		language?: string,
		signal?: AbortSignal
	): Promise<string> {
		const payload = await this._webGet<JioSaavnRadioStationResponse>(
			'webradio.createArtistStation',
			{
				name: artistName,
				query: artistName,
				language,
			},
			{ language, signal }
		);

		if (!payload.stationid) {
			throw new Error(payload.error || 'JioSaavn artist station was not found');
		}

		return payload.stationid;
	}

	async getRadioSongs(
		stationId: string,
		count = 20,
		next = 1,
		language?: string,
		signal?: AbortSignal
	): Promise<JioSaavnSong[]> {
		const payload = await this._webGet<JioSaavnRadioSongsResponse>(
			'webradio.getSong',
			{ stationid: stationId, k: count, next },
			{ language, signal }
		);

		if (payload.error) {
			throw new Error(payload.error);
		}

		const songs: JioSaavnSong[] = [];
		for (let index = 0; index < count; index += 1) {
			const entry = payload[String(index)];
			if (typeof entry === 'object' && entry && 'song' in entry && entry.song) {
				songs.push(entry.song);
			}
		}
		return songs;
	}

	private async _get<T>(
		path: string,
		params: Record<string, string | number | undefined>,
		signal?: AbortSignal
	): Promise<T> {
		const url = new URL(`${this.baseUrl}${path}`);
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null && value !== '') {
				url.searchParams.set(key, String(value));
			}
		}

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: { Accept: 'application/json' },
			signal,
		});

		if (!response.ok) {
			throw new Error(`JioSaavn API request failed: ${response.status}`);
		}

		const payload = (await response.json()) as JioSaavnApiResponse<T>;
		if (!payload.success) {
			logger.warn(`JioSaavn request returned unsuccessful payload for ${path}`);
			throw new Error('JioSaavn API returned an unsuccessful response');
		}

		return payload.data;
	}

	private async _webGet<T>(
		call: string,
		params: Record<string, string | number | undefined>,
		options: { language?: string; signal?: AbortSignal } = {}
	): Promise<T> {
		const url = new URL(`${WEB_API_BASE_URL}${WEB_API_PATH}`);
		url.searchParams.set('__call', call);

		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null && value !== '') {
				url.searchParams.set(key, String(value));
			}
		}

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				Accept: 'application/json, text/plain, */*',
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
				cookie: this._buildLanguageCookie(options.language),
			},
			signal: options.signal,
		});

		if (!response.ok) {
			throw new Error(`JioSaavn web API request failed: ${response.status}`);
		}

		return (await response.json()) as T;
	}

	private _buildLanguageCookie(language?: string): string {
		const normalized = (language ?? 'hindi')
			.split(',')
			.map((value) => value.trim().toLowerCase())
			.filter(Boolean);

		return `L=${encodeURIComponent(normalized.join(','))}`;
	}

	private _usesDirectWebApi(): boolean {
		return this.baseUrl.toLowerCase().includes('jiosaavn.com');
	}
}

export function createJioSaavnClient(config: JioSaavnClientConfig): JioSaavnClient {
	return new JioSaavnClient(config);
}
