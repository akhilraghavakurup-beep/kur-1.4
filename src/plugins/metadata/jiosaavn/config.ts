import type { PluginConfigSchema, PluginManifest } from '@plugins/core/interfaces/base-plugin';
import type { MetadataCapability } from '@plugins/core/interfaces/metadata-provider';
import type { AudioSourceCapability } from '@plugins/core/interfaces/audio-source-provider';

export interface JioSaavnConfig {
	baseUrl?: string;
	preferredQuality?: string;
}

export const DIRECT_JIOSAAVN_WEB_API_URL =
	'https://www.jiosaavn.com/api.php?_format=json&_marker=0&api_version=4&ctx=web6dot0';

export const DEFAULT_CONFIG: JioSaavnConfig = {
	baseUrl: process.env.EXPO_PUBLIC_JIOSAAVN_API_BASE_URL ?? DIRECT_JIOSAAVN_WEB_API_URL,
	preferredQuality: '320kbps',
};

export const PLUGIN_MANIFEST: PluginManifest = {
	id: 'jiosaavn',
	name: 'JioSaavn',
	shortName: 'JS',
	description: 'Browse, search, and stream music from JioSaavn using the direct web API or a compatible proxy',
	version: '1.0.0',
	author: 'Aria',
	category: 'metadata-provider',
	homepage: 'https://www.jiosaavn.com',
	iconUrl:
		'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/JioSaavn_logo.svg/512px-JioSaavn_logo.svg.png',
	capabilities: [
		'search-tracks',
		'search-albums',
		'search-artists',
		'search-playlists',
		'get-track-info',
		'get-album-info',
		'get-artist-info',
		'get-playlist-info',
		'get-album-tracks',
		'get-artist-albums',
	],
	capabilitiesDetail: {
		canSearch: true,
		canStream: true,
		requiresAuth: false,
		supportsCaching: true,
		supportsBatch: false,
	},
};

export const CONFIG_SCHEMA: PluginConfigSchema[] = [
	{
		key: 'baseUrl',
		type: 'string',
		label: 'API Base URL',
		description: 'Direct JioSaavn web API URL or a compatible proxy base URL',
		defaultValue: DEFAULT_CONFIG.baseUrl,
	},
	{
		key: 'preferredQuality',
		type: 'select',
		label: 'Preferred Quality',
		description: 'Default stream quality when multiple download URLs are available',
		defaultValue: DEFAULT_CONFIG.preferredQuality,
		options: [
			{ label: '48 kbps', value: '48kbps' },
			{ label: '96 kbps', value: '96kbps' },
			{ label: '160 kbps', value: '160kbps' },
			{ label: '320 kbps', value: '320kbps' },
		],
	},
];

export const METADATA_CAPABILITIES: MetadataCapability[] = [
	'search-tracks',
	'search-albums',
	'search-artists',
	'search-playlists',
	'get-track-info',
	'get-album-info',
	'get-artist-info',
	'get-playlist-info',
	'get-album-tracks',
	'get-artist-albums',
];

export const AUDIO_CAPABILITIES: AudioSourceCapability[] = [
	'get-stream-url',
	'get-formats',
	'quality-selection',
	'format-selection',
];
