import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHomeFeedOperations } from '@/src/plugins/metadata/jiosaavn/home-feed-operations';
import {
	DEFAULT_HOME_CONTENT_PREFERENCES,
	useSettingsStore,
} from '@/src/application/state/settings-store';
import type { JioSaavnClient } from '@/src/plugins/metadata/jiosaavn/client';
import type { JioSaavnLaunchData } from '@/src/plugins/metadata/jiosaavn/types';

function createLaunchData(items: JioSaavnLaunchData['new_trending']): JioSaavnLaunchData {
	return {
		modules: {
			new_trending: {
				source: 'test',
				position: 1,
				title: 'Trending Now',
				subtitle: 'What is moving fastest right now',
			},
		},
		new_trending: items,
	};
}

function createSong(id: string, name: string, language: string) {
	return {
		id,
		name,
		type: 'song',
		language,
		duration: 180,
		subtitle: 'Artist Name',
	};
}

function createClientMock(): JioSaavnClient {
	const launchDataByLanguage: Record<string, JioSaavnLaunchData> = {
		'malayalam,english': createLaunchData([createSong('mixed', 'Mixed Trend', 'hindi')]),
		english: createLaunchData([createSong('english-1', 'English Trend', 'english')]),
		malayalam: createLaunchData([createSong('malayalam-1', 'Malayalam Trend', 'malayalam')]),
	};

	return {
		getLaunchData: vi.fn(async (language?: string) => {
			return launchDataByLanguage[language ?? 'english,malayalam'] ?? createLaunchData([]);
		}),
		searchPlaylists: vi.fn().mockResolvedValue({ results: [] }),
		searchPlaylistsWeb: vi.fn().mockResolvedValue({ results: [] }),
		searchAlbumsWeb: vi.fn().mockResolvedValue({ results: [] }),
		getPlaylist: vi.fn(),
	} as unknown as JioSaavnClient;
}

describe('createHomeFeedOperations', () => {
	beforeEach(() => {
		useSettingsStore.setState({
			homeContentPreferences: DEFAULT_HOME_CONTENT_PREFERENCES,
		});
	});

	it('should prioritize language-specific trending items when preferences are selected', async () => {
		// Arrange
		useSettingsStore.setState({
			homeContentPreferences: ['Malayalam', 'English'],
		});
		const client = createClientMock();
		const operations = createHomeFeedOperations(client);

		// Act
		const result = await operations.getHomeFeed();

		// Assert
		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}

		const trendingSection = result.data.sections.find(
			(section) => section.id === 'jiosaavn-new-trending'
		);
		expect(trendingSection?.items.map((item) => item.type === 'track' && item.data.title)).toEqual([
			'Malayalam Trend',
			'English Trend',
			'Mixed Trend',
		]);
		expect(client.getLaunchData).toHaveBeenCalledWith('malayalam,english');
		expect(client.getLaunchData).toHaveBeenCalledWith('malayalam');
		expect(client.getLaunchData).toHaveBeenCalledWith('english');
	});
});
