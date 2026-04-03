import type { PluginConfig } from '@plugins/core/interfaces/base-plugin';
import type { PluginModule } from '@plugins/core/interfaces/plugin-module';
import type { MetadataProvider } from '@plugins/core/interfaces/metadata-provider';
import { DEFAULT_CONFIG, PLUGIN_MANIFEST, type JioSaavnConfig } from './config';
import { JioSaavnProvider } from './jiosaavn-provider';

export const JioSaavnPluginModule: PluginModule<MetadataProvider> = {
	manifest: PLUGIN_MANIFEST,
	defaultConfig: DEFAULT_CONFIG as PluginConfig,
	async create(config?: PluginConfig) {
		return new JioSaavnProvider(config as JioSaavnConfig);
	},
	async validate() {
		// No extra validation required for the public API.
	},
};

export default JioSaavnPluginModule;
