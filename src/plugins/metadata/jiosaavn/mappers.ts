import type { Album } from '@domain/entities/album';
import type { Artist, ArtistReference } from '@domain/entities/artist';
import type { FeedPlaylist } from '@domain/entities/feed-section';
import { createPlaylist, type Playlist } from '@domain/entities/playlist';
import type { CreateTrackParams, Track } from '@domain/entities/track';
import { createTrack } from '@domain/entities/track';
import { AlbumId } from '@domain/value-objects/album-id';
import type { Artwork } from '@domain/value-objects/artwork';
import { createStreamingSource } from '@domain/value-objects/audio-source';
import { Duration } from '@domain/value-objects/duration';
import { TrackId } from '@domain/value-objects/track-id';
import type {
	JioSaavnAlbum,
	JioSaavnArtist,
	JioSaavnArtistPageDetails,
	JioSaavnArtistCollection,
	JioSaavnArtistRef,
	JioSaavnArtwork,
	JioSaavnDownloadUrl,
	JioSaavnLegacyArtistCollection,
	JioSaavnPlaylist,
	JioSaavnRadioStation,
	JioSaavnSong,
} from './types';

const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&quot;': '"',
	'&#039;': "'",
	'&apos;': "'",
	'&lt;': '<',
	'&gt;': '>',
	'&nbsp;': ' ',
};

function decode(value?: string | null): string {
	return (value ?? '')
		.replace(/<[^>]+>/g, ' ')
		.replace(
			/&amp;|&quot;|&#039;|&apos;|&lt;|&gt;|&nbsp;/g,
			(entity) => ENTITIES[entity] ?? entity
		)
		.replace(/\s+/g, ' ')
		.trim();
}

function parseYear(value?: string | number | null): number | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const year = typeof value === 'number' ? value : parseInt(String(value).slice(0, 4), 10);
	return Number.isFinite(year) ? year : undefined;
}

function parseNumber(value?: string | number | null): number | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : undefined;
	}
	const parsed = Number(value.replace(/,/g, '').trim());
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseArtistBio(value?: string | null): string | undefined {
	const decoded = decode(value);
	if (!decoded) {
		return undefined;
	}

	if (!decoded.trim().startsWith('[')) {
		return decoded;
	}

	try {
		const parsed = JSON.parse(decoded) as Array<{ text?: string | null }>;
		const text = parsed
			.map((section) => decode(section?.text))
			.filter(Boolean)
			.join('\n\n');
		return text || decoded;
	} catch {
		return decoded;
	}
}

function nameOf(value: { name?: string | null; title?: string | null }): string {
	return decode(value.name ?? value.title);
}

function createArtistReferenceId(name: string, id?: string | null): string {
	if (id) {
		return `jiosaavn-artist:${id}`;
	}
	return `jiosaavn-artist:${name.toLowerCase().replace(/\s+/g, '-')}`;
}

function artistRef(artist: JioSaavnArtistRef): ArtistReference | null {
	const name = decode(artist.name);
	if (!name) {
		return null;
	}
	return {
		id: createArtistReferenceId(name, artist.id),
		name,
	};
}

function parseArtistNames(raw?: string | null): ArtistReference[] {
	if (!raw) {
		return [];
	}
	return raw
		.split(',')
		.map((name) => decode(name))
		.filter(Boolean)
		.map((name) => ({
			id: createArtistReferenceId(name),
			name,
		}));
}

function normalizeImages(images?: JioSaavnArtwork): Artwork[] {
	if (!images) {
		return [];
	}

	if (typeof images === 'string') {
		return images
			? [
					{
						url: images,
					},
				]
			: [];
	}

	return images
		.filter((image) => image?.url)
		.map((image) => {
			const size = image.quality.match(/(\d+)x(\d+)/i);
			return {
				url: image.url,
				width: size ? parseInt(size[1], 10) : undefined,
				height: size ? parseInt(size[2], 10) : undefined,
			};
		});
}

function normalizeArtistCollection(
	artists?: JioSaavnArtistCollection | JioSaavnLegacyArtistCollection | null
): JioSaavnArtistRef[] {
	if (!artists) {
		return [];
	}

	return (
		artists.primary ??
		artists.primary_artists ??
		artists.all ??
		artists.artists ??
		artists.featured ??
		artists.featured_artists ??
		[]
	);
}

function mapAlbumReference(song: JioSaavnSong): { id: string; name: string } | undefined {
	if (song.album) {
		if (typeof song.album === 'string') {
			const name = decode(song.album);
			return name ? { id: `jiosaavn-album:${song.id}`, name } : undefined;
		}

		const id = song.album.id ? AlbumId.create('jiosaavn', song.album.id).value : undefined;
		const name = decode(song.album.name);
		return name ? { id: id ?? `jiosaavn-album:${song.id}`, name } : undefined;
	}

	const albumId = song.more_info?.album_id;
	const albumName = decode(song.more_info?.album);
	if (!albumName) {
		return undefined;
	}

	return {
		id: albumId ? AlbumId.create('jiosaavn', albumId).value : `jiosaavn-album:${song.id}`,
		name: albumName,
	};
}

function playlistId(id: string): string {
	return `jiosaavn-playlist:${id}`;
}

function playlistSubtitle(playlist: JioSaavnPlaylist): string | undefined {
	const count =
		parseNumber(playlist.songCount) ??
		parseNumber(playlist.count) ??
		parseNumber(playlist.more_info?.song_count);
	const followers =
		parseNumber(playlist.more_info?.follower_count) ?? parseNumber(playlist.more_info?.fan_count);
	const language = decode(playlist.language);

	if (count && followers) {
		return `${count} songs | ${followers.toLocaleString()} followers`;
	}
	if (count && language) {
		return `${count} songs | ${language}`;
	}
	if (count) {
		return `${count} songs`;
	}
	if (followers) {
		return `${followers.toLocaleString()} followers`;
	}
	if (language) {
		return language;
	}
	if (playlist.subtitle) {
		return decode(playlist.subtitle);
	}
	return undefined;
}

export function mapImages(images?: JioSaavnArtwork): Artwork[] {
	return normalizeImages(images);
}

export function mapArtistReferences(song: JioSaavnSong): ArtistReference[] {
	const mapped = normalizeArtistCollection(song.artists ?? song.more_info?.artistMap)
		.map(artistRef)
		.filter((artist): artist is ArtistReference => !!artist);

	if (mapped.length > 0) {
		return mapped;
	}

	const fallbackNames = decode(song.subtitle).split('-')[0]?.trim();
	return parseArtistNames(song.primaryArtists ?? song.singers ?? fallbackNames);
}

export function mapSong(song: JioSaavnSong): Track | null {
	if (!song.id) {
		return null;
	}

	const title = nameOf(song);
	if (!title) {
		return null;
	}

	const artwork = mapImages(song.image);
	const params: CreateTrackParams = {
		id: TrackId.create('jiosaavn', song.id),
		title,
		artists: mapArtistReferences(song),
		album: mapAlbumReference(song),
		duration: Duration.fromSeconds(parseNumber(song.duration ?? song.more_info?.duration) ?? 0),
		artwork: artwork.length > 0 ? artwork : undefined,
		source: createStreamingSource('jiosaavn', song.id),
		metadata: {
			year: parseYear(song.year ?? song.more_info?.release_date),
			genre: song.language ? decode(song.language) : undefined,
			popularity: parseNumber(song.playCount ?? song.play_count),
			explicit: song.explicitContent === true || song.explicitContent === '1',
		},
	};

	return createTrack(params);
}

export function mapAlbum(album: JioSaavnAlbum): Album | null {
	if (!album.id) {
		return null;
	}

	const name = nameOf(album);
	if (!name) {
		return null;
	}

	const artists = normalizeArtistCollection(album.artists ?? album.more_info?.artistMap)
		.map(artistRef)
		.filter((artist): artist is ArtistReference => !!artist);
	const artwork = mapImages(album.image);
	const year = parseYear(album.year ?? album.more_info?.release_date);

	return {
		id: AlbumId.create('jiosaavn', album.id),
		name,
		artists,
		artwork: artwork.length > 0 ? artwork : undefined,
		releaseDate: album.more_info?.release_date ?? (year ? `${year}` : undefined),
		trackCount: parseNumber(album.songCount ?? album.more_info?.song_count),
		albumType: album.type === 'single' ? 'single' : 'album',
	};
}

export function mapArtist(artist: JioSaavnArtist | JioSaavnArtistPageDetails): Artist | null {
	const id = artist.id ?? artist.artistId;
	if (!id) {
		return null;
	}

	const name = nameOf(artist);
	if (!name) {
		return null;
	}

	const artwork = mapImages(artist.image);
	const bio = parseArtistBio(artist.bio ?? artist.description);
	const jiosaavnUrl =
		artist.url ?? artist.perma_url ?? artist.urls?.overview ?? artist.urls?.songs ?? artist.urls?.albums;

	return {
		id: `jiosaavn-artist:${id}`,
		name,
		artwork: artwork.length > 0 ? artwork : undefined,
		bio: bio || undefined,
		monthlyListeners: parseNumber(
			artist.followerCount ?? artist.fanCount ?? artist.follower_count ?? artist.fan_count
		),
		externalUrls: jiosaavnUrl ? { jiosaavn: jiosaavnUrl } : undefined,
	};
}

export function mapArtistStation(station: JioSaavnRadioStation): Artist | null {
	if (!station.id) {
		return null;
	}

	const name = decode(
		station.more_info?.station_display_text ?? station.more_info?.query ?? station.title
	);
	if (!name) {
		return null;
	}

	const artwork = mapImages(station.image);

	return {
		id: `jiosaavn-artist:${station.id}`,
		name,
		artwork: artwork.length > 0 ? artwork : undefined,
		bio: decode(station.subtitle) || undefined,
		externalUrls: station.perma_url ? { jiosaavn: station.perma_url } : undefined,
	};
}

export function mapPlaylistFeed(playlist: JioSaavnPlaylist): FeedPlaylist | null {
	if (!playlist.id) {
		return null;
	}

	const name = nameOf(playlist) || decode(playlist.more_info?.listname);
	if (!name) {
		return null;
	}

	const artwork = mapImages(playlist.image);
	return {
		id: playlistId(playlist.more_info?.listid ?? playlist.id),
		name,
		artwork: artwork.length > 0 ? artwork : undefined,
		subtitle: playlistSubtitle(playlist),
	};
}

export function mapPlaylist(playlist: JioSaavnPlaylist): Playlist | null {
	if (!playlist.id) {
		return null;
	}

	const name = nameOf(playlist) || decode(playlist.more_info?.listname);
	if (!name) {
		return null;
	}

	const artwork = mapImages(playlist.image);
	const tracks = (playlist.songs ?? []).map(mapSong).filter((track): track is Track => !!track);
	const mapped = createPlaylist({
		id: playlistId(playlist.more_info?.listid ?? playlist.id),
		name,
		description: decode(playlist.description) || undefined,
		artwork: artwork.length > 0 ? artwork : undefined,
		tracks,
	});

	return {
		...mapped,
		source: 'jiosaavn',
	};
}

export function stripSourcePrefix(value: string): string {
	const index = value.indexOf(':');
	return index === -1 ? value : value.slice(index + 1);
}

export function sortDownloadUrls(downloadUrls?: JioSaavnDownloadUrl[] | null): JioSaavnDownloadUrl[] {
	return [...(downloadUrls ?? [])].sort(
		(left, right) => (parseInt(right.quality, 10) || 0) - (parseInt(left.quality, 10) || 0)
	);
}
