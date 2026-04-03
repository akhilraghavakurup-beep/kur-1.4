import type { Album } from '@domain/entities/album';
import type { Artist } from '@domain/entities/artist';
import type { Playlist } from '@domain/entities/playlist';
import type { Track } from '@domain/entities/track';
import {
	createSearchResults,
	type SearchOptions,
	type SearchResults,
} from '@plugins/core/interfaces/metadata-provider';
import type { Result } from '@shared/types/result';
import { err, ok } from '@shared/types/result';
import type { JioSaavnClient } from './client';
import { mapAlbum, mapArtist, mapPlaylist, mapSong } from './mappers';

export interface SearchOperations {
	searchTracks(
		query: string,
		options?: SearchOptions
	): Promise<Result<SearchResults<Track>, Error>>;
	searchAlbums(
		query: string,
		options?: SearchOptions
	): Promise<Result<SearchResults<Album>, Error>>;
	searchArtists(
		query: string,
		options?: SearchOptions
	): Promise<Result<SearchResults<Artist>, Error>>;
	searchPlaylists(
		query: string,
		options?: SearchOptions
	): Promise<Result<SearchResults<Playlist>, Error>>;
}

function getPaging(options?: SearchOptions) {
	const limit = options?.limit ?? 20;
	const offset = options?.offset ?? 0;
	const page = Math.floor(offset / Math.max(limit, 1));
	return { limit, offset, page };
}

export function createSearchOperations(client: JioSaavnClient): SearchOperations {
	return {
		async searchTracks(query, options) {
			try {
				const { limit, offset, page } = getPaging(options);
				const response = await client.searchSongs(query, page, limit, options?.signal);
				const items = response.results.map(mapSong).filter((track): track is Track => !!track);
				return ok(
					createSearchResults(items, {
						total: response.total ?? items.length,
						offset,
						limit,
						hasMore: (response.total ?? items.length) > offset + items.length,
					})
				);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},

		async searchAlbums(query, options) {
			try {
				const { limit, offset, page } = getPaging(options);
				const response = await client.searchAlbums(query, page, limit, options?.signal);
				const items = response.results.map(mapAlbum).filter((album): album is Album => !!album);
				return ok(
					createSearchResults(items, {
						total: response.total ?? items.length,
						offset,
						limit,
						hasMore: (response.total ?? items.length) > offset + items.length,
					})
				);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},

		async searchArtists(query, options) {
			try {
				const { limit, offset, page } = getPaging(options);
				const response = await client.searchArtists(query, page, limit, options?.signal);
				const items = response.results
					.map(mapArtist)
					.filter((artist): artist is Artist => !!artist);
				return ok(
					createSearchResults(items, {
						total: response.total ?? items.length,
						offset,
						limit,
						hasMore: (response.total ?? items.length) > offset + items.length,
					})
				);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},

		async searchPlaylists(query, options) {
			try {
				const { limit, offset, page } = getPaging(options);
				const response = await client.searchPlaylists(query, page, limit, options?.signal);
				const items = response.results
					.map(mapPlaylist)
					.filter((playlist): playlist is Playlist => !!playlist);
				return ok(
					createSearchResults(items, {
						total: response.total ?? items.length,
						offset,
						limit,
						hasMore: (response.total ?? items.length) > offset + items.length,
					})
				);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
	};
}
