import type { Album } from '@domain/entities/album';
import type { Artist } from '@domain/entities/artist';
import type { Playlist } from '@domain/entities/playlist';
import type { Track } from '@domain/entities/track';
import type { TrackId } from '@domain/value-objects/track-id';
import {
	createSearchResults,
	type SearchOptions,
	type SearchResults,
} from '@plugins/core/interfaces/metadata-provider';
import type { Result } from '@shared/types/result';
import { err, ok } from '@shared/types/result';
import type { JioSaavnClient } from './client';
import { mapAlbum, mapArtist, mapPlaylist, mapSong, stripSourcePrefix } from './mappers';

export interface InfoOperations {
	getTrackInfo(trackId: TrackId): Promise<Result<Track, Error>>;
	getAlbumInfo(albumId: string): Promise<Result<Album, Error>>;
	getArtistInfo(artistId: string): Promise<Result<Artist, Error>>;
	getPlaylistInfo(playlistId: string): Promise<Result<Playlist, Error>>;
	getAlbumTracks(
		albumId: string,
		options?: Pick<SearchOptions, 'limit' | 'offset'>
	): Promise<Result<SearchResults<Track>, Error>>;
	getArtistAlbums(
		artistId: string,
		options?: Pick<SearchOptions, 'limit' | 'offset'>
	): Promise<Result<SearchResults<Album>, Error>>;
}

function sliceResults<T>(items: T[], options?: Pick<SearchOptions, 'limit' | 'offset'>) {
	const offset = options?.offset ?? 0;
	const limit = options?.limit ?? items.length;
	return {
		offset,
		limit,
		items: items.slice(offset, offset + limit),
		hasMore: items.length > offset + limit,
	};
}

export function createInfoOperations(client: JioSaavnClient): InfoOperations {
	return {
		async getTrackInfo(trackId) {
			try {
				const song = await client.getSong(trackId.sourceId);
				const track = mapSong(song);
				if (!track) {
					return err(new Error(`Track "${trackId.value}" could not be mapped`));
				}
				return ok(track);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
		async getAlbumInfo(albumId) {
			try {
				const album = await client.getAlbum(stripSourcePrefix(albumId));
				const mapped = mapAlbum(album);
				if (!mapped) {
					return err(new Error(`Album "${albumId}" could not be mapped`));
				}
				return ok(mapped);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
		async getArtistInfo(artistId) {
			try {
				const normalizedId = stripSourcePrefix(artistId);
				let artist;
				try {
					artist = await client.getArtist(normalizedId);
				} catch {
					artist = await client.getArtistPageDetails(normalizedId, 'hindi,english');
				}
				const mapped = mapArtist(artist);
				if (!mapped) {
					return err(new Error(`Artist "${artistId}" could not be mapped`));
				}
				return ok(mapped);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
		async getPlaylistInfo(playlistId) {
			try {
				const playlist = await client.getPlaylist(stripSourcePrefix(playlistId));
				const mapped = mapPlaylist(playlist);
				if (!mapped) {
					return err(new Error(`Playlist "${playlistId}" could not be mapped`));
				}
				return ok(mapped);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
		async getAlbumTracks(albumId, options) {
			try {
				const album = await client.getAlbum(stripSourcePrefix(albumId));
				const tracks = (album.songs ?? []).map(mapSong).filter((track): track is Track => !!track);
				const sliced = sliceResults(tracks, options);
				return ok(
					createSearchResults(sliced.items, {
						total: tracks.length,
						offset: sliced.offset,
						limit: sliced.limit,
						hasMore: sliced.hasMore,
					})
				);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
		async getArtistAlbums(artistId, options) {
			try {
				const normalizedId = stripSourcePrefix(artistId);
				const offset = options?.offset ?? 0;
				const limit = options?.limit ?? 20;
				const page = Math.floor(offset / Math.max(limit, 1)) + 1;
				let albums: Album[] = [];
				let total = 0;

				try {
					const response = await client.getArtistAlbums(normalizedId, page);
					albums = response.results.map(mapAlbum).filter((album): album is Album => !!album);
					total = response.total ?? albums.length;
				} catch {
					const artistPage = await client.getArtistPageDetails(normalizedId, 'hindi,english');
					const fallbackAlbums = (artistPage.topAlbums ?? artistPage.singles ?? [])
						.map(mapAlbum)
						.filter((album): album is Album => !!album);
					const sliced = sliceResults(fallbackAlbums, options);
					albums = sliced.items;
					total = fallbackAlbums.length;
				}

				return ok(
					createSearchResults(albums, {
						total,
						offset,
						limit,
						hasMore: total > offset + albums.length,
					})
				);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
	};
}
