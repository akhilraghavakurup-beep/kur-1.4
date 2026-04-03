import type { Track } from '@domain/entities/track';
import type { AudioFormat, AudioStream } from '@domain/value-objects/audio-stream';
import { createAudioStream } from '@domain/value-objects/audio-stream';
import type { StreamQuality } from '@domain/value-objects/audio-source';
import type { TrackId } from '@domain/value-objects/track-id';
import type { AvailableFormat, StreamOptions } from '@plugins/core/interfaces/audio-source-provider';
import type { AsyncResult } from '@shared/types/result';
import { err, ok } from '@shared/types/result';
import { sortDownloadUrls } from './mappers';
import type { JioSaavnClient } from './client';
import type { JioSaavnDownloadUrl } from './types';

const STREAM_URL_TTL_MS = 30 * 60 * 1000;
const labelFor = (quality: StreamQuality) => quality === 'low' ? '48kbps' : quality === 'medium' ? '96kbps' : '320kbps';
const bitrateFor = (download: JioSaavnDownloadUrl) => parseInt(download.quality, 10) || 0;
const qualityFor = (bitrate: number): StreamQuality => bitrate >= 320 ? 'high' : bitrate >= 96 ? 'medium' : 'low';
const formatFor = (url: string): AudioFormat => url.toLowerCase().includes('.m3u8') ? 'hls' : url.toLowerCase().includes('.mp3') ? 'mp3' : url.toLowerCase().includes('.aac') ? 'aac' : url.toLowerCase().includes('.wav') ? 'wav' : url.toLowerCase().includes('.ogg') ? 'ogg' : url.toLowerCase().includes('.flac') ? 'flac' : 'm4a';
const targetBitrateFor = (quality: StreamQuality) => quality === 'low' ? 48 : quality === 'medium' ? 96 : 320;

function selectDownloadUrl(
	downloads: JioSaavnDownloadUrl[],
	quality: StreamQuality
): JioSaavnDownloadUrl | undefined {
	const exact = downloads.find((download) => download.quality === labelFor(quality));
	if (exact) {
		return exact;
	}

	const targetBitrate = targetBitrateFor(quality);
	const ranked = [...downloads].sort(
		(left, right) =>
			Math.abs(bitrateFor(left) - targetBitrate) - Math.abs(bitrateFor(right) - targetBitrate)
	);
	return ranked[0];
}

export interface StreamingOperations {
	supportsTrack(track: Track): boolean;
	getStreamUrl(track: Track, options?: StreamOptions): AsyncResult<AudioStream, Error>;
	getAvailableFormats(trackId: TrackId): AsyncResult<AvailableFormat[], Error>;
}

export function createStreamingOperations(client: JioSaavnClient): StreamingOperations {
	return {
		supportsTrack(track) { return track.id.sourceType === 'jiosaavn'; },
		async getStreamUrl(track, options) {
			if (track.id.sourceType !== 'jiosaavn') return err(new Error(`Unsupported source type: ${track.id.sourceType}`));
			try {
				const song = await client.getSong(track.id.sourceId);
				const downloads = sortDownloadUrls(song.downloadUrl);
				const selected = selectDownloadUrl(downloads, options?.quality ?? 'high');
				if (!selected?.url) return err(new Error('No playable download URL was returned by JioSaavn'));
				const bitrate = bitrateFor(selected);
				return ok(createAudioStream({ url: selected.url, format: formatFor(selected.url), quality: qualityFor(bitrate), bitrate: bitrate || undefined, expiresAt: Date.now() + STREAM_URL_TTL_MS }));
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
		async getAvailableFormats(trackId) {
			if (trackId.sourceType !== 'jiosaavn') return err(new Error(`Unsupported source type: ${trackId.sourceType}`));
			try {
				const song = await client.getSong(trackId.sourceId);
				return ok(sortDownloadUrls(song.downloadUrl).map((download, index) => { const bitrate = bitrateFor(download); return { format: formatFor(download.url), quality: qualityFor(bitrate), bitrate: bitrate || undefined, label: download.quality, isDefault: index === 0 } satisfies AvailableFormat; }));
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
	};
}
