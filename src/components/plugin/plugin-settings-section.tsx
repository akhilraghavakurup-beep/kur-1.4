/**
 * Plugin Settings Section Component
 *
 * Renders plugin configuration fields based on the plugin's configSchema.
 */

import { memo } from 'react';
import { SettingsSection } from '@/src/components/settings/settings-section';
import { PluginConfigField } from './plugin-config-field';
import { usePluginSettings } from '@/src/hooks/use-plugin-settings';

interface PluginSettingsSectionProps {
	readonly pluginId: string;
	readonly hiddenKeys?: string[];
}

export const PluginSettingsSection = memo(function PluginSettingsSection({
	pluginId,
	hiddenKeys = [],
}: PluginSettingsSectionProps) {
	const { configSchema, values, errors, handleChange, handleBlur } = usePluginSettings(pluginId);
	const visibleConfigSchema = configSchema.filter((schema) => !hiddenKeys.includes(schema.key));

	if (visibleConfigSchema.length === 0) {
		return null;
	}

	return (
		<SettingsSection title={'Configuration'}>
			{visibleConfigSchema.map((schema) => (
				<PluginConfigField
					key={schema.key}
					schema={schema}
					value={values[schema.key]}
					onChange={handleChange}
					onBlur={handleBlur}
					error={errors[schema.key]}
					pluginId={pluginId}
				/>
			))}
		</SettingsSection>
	);
});
