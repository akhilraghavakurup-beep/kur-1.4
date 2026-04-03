export interface JioSaavnImage {
	quality: string;
	url: string;
}

export type JioSaavnArtwork = JioSaavnImage[] | string | null | undefined;

export interface JioSaavnDownloadUrl {
	quality: string;
	url: string;
}

export interface JioSaavnArtistRef {
	id?: string | null;
	name: string;
	role?: string;
	type?: string;
	image?: JioSaavnImage[];
	url?: string;
}

export interface JioSaavnArtistCollection {
	primary?: JioSaavnArtistRef[] | null;
	featured?: JioSaavnArtistRef[] | null;
	all?: JioSaavnArtistRef[] | null;
}

export interface JioSaavnAlbumRef {
	id?: string | null;
	name?: string | null;
	url?: string | null;
}

export interface JioSaavnSong {
	id: string;
	name?: string | null;
	title?: string | null;
	type?: string | null;
	year?: string | number | null;
	releaseDate?: string | null;
	duration?: number | string | null;
	label?: string | null;
	explicitContent?: boolean | string | null;
	playCount?: number | string | null;
	play_count?: number | string | null;
	language?: string | null;
	hasLyrics?: boolean;
	lyricsId?: string | null;
	url?: string | null;
	perma_url?: string | null;
	copyright?: string | null;
	album?: JioSaavnAlbumRef | string | null;
	artists?: JioSaavnArtistCollection | null;
	image?: JioSaavnArtwork;
	downloadUrl?: JioSaavnDownloadUrl[] | null;
	primaryArtists?: string | null;
	singers?: string | null;
	description?: string | null;
	subtitle?: string | null;
	more_info?: {
		music?: string | null;
		album_id?: string | null;
		album?: string | null;
		duration?: string | number | null;
		release_date?: string | null;
		encrypted_media_url?: string | null;
		artistMap?: JioSaavnArtistCollection | JioSaavnLegacyArtistCollection | null;
	} | null;
}

export interface JioSaavnAlbum {
	id: string;
	name?: string | null;
	title?: string | null;
	description?: string | null;
	year?: number | string | null;
	type?: string | null;
	playCount?: number | null;
	language?: string | null;
	explicitContent?: boolean;
	songCount?: number | string | null;
	url?: string | null;
	perma_url?: string | null;
	image?: JioSaavnArtwork;
	artists?: JioSaavnArtistCollection | null;
	songs?: JioSaavnSong[] | null;
	subtitle?: string | null;
	more_info?: {
		release_date?: string | null;
		song_count?: string | number | null;
		artistMap?: JioSaavnArtistCollection | JioSaavnLegacyArtistCollection | null;
	} | null;
}

export interface JioSaavnArtist {
	id: string;
	name?: string | null;
	title?: string | null;
	url?: string | null;
	perma_url?: string | null;
	type?: string | null;
	description?: string | null;
	image?: JioSaavnArtwork;
	followerCount?: number | string | null;
	fanCount?: number | string | null;
	isVerified?: boolean;
	dominantLanguage?: string | null;
	dominantType?: string | null;
	bio?: string | null;
	topSongs?: JioSaavnSong[] | null;
	topAlbums?: JioSaavnAlbum[] | null;
	singles?: JioSaavnAlbum[] | null;
	similarArtists?: JioSaavnArtist[] | null;
}

export interface JioSaavnPlaylist {
	id: string;
	name?: string | null;
	title?: string | null;
	description?: string | null;
	year?: number | string | null;
	type?: string | null;
	playCount?: number | null;
	language?: string | null;
	explicitContent?: boolean;
	songCount?: number | string | null;
	url?: string | null;
	perma_url?: string | null;
	image?: JioSaavnArtwork;
	songs?: JioSaavnSong[] | null;
	artists?: JioSaavnArtistRef[] | null;
	subtitle?: string | null;
	count?: number | string | null;
	more_info?: {
		listid?: string | null;
		listname?: string | null;
		song_count?: string | number | null;
		firstname?: string | null;
		follower_count?: string | number | null;
		fan_count?: string | number | null;
	} | null;
}

export interface JioSaavnApiResponse<T> {
	success: boolean;
	data: T;
}

export interface JioSaavnSongSearchResponse {
	total?: number;
	start?: number;
	results: JioSaavnSong[];
}

export interface JioSaavnAlbumSearchResponse {
	total?: number;
	start?: number;
	results: JioSaavnAlbum[];
}

export interface JioSaavnArtistSearchResponse {
	total?: number;
	start?: number;
	results: JioSaavnArtist[];
}

export interface JioSaavnPlaylistSearchResponse {
	total?: number;
	start?: number;
	results: JioSaavnPlaylist[];
}

export interface JioSaavnSearchSection<T> {
	results: T[];
	position?: number;
}

export interface JioSaavnGlobalSearchResponse {
	albums: JioSaavnSearchSection<JioSaavnAlbum>;
	songs: JioSaavnSearchSection<JioSaavnSong>;
	artists: JioSaavnSearchSection<JioSaavnArtist>;
	playlists: JioSaavnSearchSection<JioSaavnPlaylist>;
	topQuery?: JioSaavnSearchSection<
		JioSaavnSong | JioSaavnAlbum | JioSaavnArtist | JioSaavnPlaylist
	>;
}

export interface JioSaavnPagedResults<T> {
	total?: number;
	results: T[];
}

export interface JioSaavnLegacyArtistCollection {
	primary_artists?: JioSaavnArtistRef[] | null;
	featured_artists?: JioSaavnArtistRef[] | null;
	artists?: JioSaavnArtistRef[] | null;
}

export interface JioSaavnLaunchModule {
	source: string;
	position?: number;
	title?: string;
	subtitle?: string;
}

export interface JioSaavnRadioStation {
	id: string;
	title?: string | null;
	subtitle?: string | null;
	type?: 'radio_station' | string | null;
	image?: string | null;
	perma_url?: string | null;
	more_info?: {
		description?: string | null;
		featured_station_type?: 'featured' | 'artist' | 'entity' | string | null;
		query?: string | null;
		color?: string | null;
		language?: string | null;
		station_display_text?: string | null;
	} | null;
}

export interface JioSaavnLaunchData {
	modules?: Record<string, JioSaavnLaunchModule>;
	history?: unknown[];
	new_trending?: Array<JioSaavnSong | JioSaavnAlbum | JioSaavnPlaylist>;
	charts?: JioSaavnPlaylist[];
	new_albums?: Array<JioSaavnSong | JioSaavnAlbum>;
	top_playlists?: JioSaavnPlaylist[];
	radio?: JioSaavnRadioStation[];
	artist_recos?: JioSaavnRadioStation[];
	[key: string]:
		| Record<string, JioSaavnLaunchModule>
		| unknown[]
		| JioSaavnLaunchModule
		| undefined;
}

export interface JioSaavnRadioStationResponse {
	stationid?: string;
	error?: string;
}

export interface JioSaavnRadioSongEntry {
	song?: JioSaavnSong;
}

export interface JioSaavnRadioSongsResponse {
	stationid?: string;
	error?: string;
	[key: string]: string | JioSaavnRadioSongEntry | undefined;
}
