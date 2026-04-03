import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text, Switch, Chip, Button } from 'react-native-paper';
import { Image } from 'expo-image';
import CookieManager from '@react-native-cookies/cookies';
import { Icon } from '@/src/components/ui/icon';
import { PageLayout } from '@/src/components/ui/page-layout';
import { PlayerAwareScrollView } from '@/src/components/ui/player-aware-scroll-view';
import { EmptyState } from '@/src/components/ui/empty-state';
import { SettingsSection } from '@/src/components/settings/settings-section';
import { SettingsItem } from '@/src/components/settings/settings-item';
import { ConfirmationDialog } from '@/src/components/ui/confirmation-dialog';
import { PluginSettingsSection } from '@/src/components/plugin/plugin-settings-section';
import { LibraryImportSection } from '@/src/components/plugin/library-import-section';
import { LockIcon, Trash2Icon, LinkIcon } from 'lucide-react-native';
import { togglePluginRuntime } from '@/src/application/services/plugin-lifecycle-service';
import { getPluginRegistry } from '@/src/plugins/core/registry/plugin-registry';
import { useAppTheme } from '@/lib/theme';
import { useToast } from '@/src/hooks/use-toast';
import { Input } from '@/src/components/ui/input';
import { usePluginConfig, useSetPluginConfig } from '@/src/application/state/plugin-settings-store';
import {
	categoryIcons,
	categoryLabels,
	usePluginDisplayStatus,
	usePluginById,
	DEFAULT_PLUGIN_ICON,
} from '@/src/hooks/use-plugin-display';

export default function PluginDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { colors } = useAppTheme();
	const plugin = usePluginById(id);
	const { isEnabled, statusInfo, StatusIcon, statusColor } = usePluginDisplayStatus(plugin);
	const pluginConfig = usePluginConfig(id);
	const setPluginConfig = useSetPluginConfig();

	const { success: toastSuccess } = useToast();
	const [clearCacheDialogVisible, setClearCacheDialogVisible] = useState(false);
	const [apiUrlDraft, setApiUrlDraft] = useState('');

	useEffect(() => {
		if (plugin?.id === 'jiosaavn') {
			setApiUrlDraft(
				String(pluginConfig.baseUrl ?? 'https://saavn.sumit.co')
			);
		}
	}, [plugin?.id, pluginConfig.baseUrl]);

	const handleToggle = useCallback(() => {
		if (plugin && !plugin.isRequired) {
			togglePluginRuntime(plugin.id);
		}
	}, [plugin]);

	const handleClearCache = useCallback(() => {
		setClearCacheDialogVisible(true);
	}, []);

	const confirmClearCache = useCallback(async () => {
		setClearCacheDialogVisible(false);
		if (!plugin) return;

		// Clear all browser cookies (shared cookie store)
		await CookieManager.clearAll();

		// Logout the plugin's auth manager if it exposes logout()
		const registry = getPluginRegistry();
		const instance = registry.getPlugin(plugin.id);
		if (instance && 'logout' in instance && typeof instance.logout === 'function') {
			await (instance as { logout: () => Promise<unknown> }).logout();
		}

		toastSuccess('Cache cleared', 'Cookies and auth credentials have been reset');
	}, [plugin, toastSuccess]);

	const normalizedApiUrl = useMemo(() => apiUrlDraft.trim(), [apiUrlDraft]);
	const savedApiUrl = String(pluginConfig.baseUrl ?? 'https://saavn.sumit.co');
	const canSaveApiUrl =
		plugin?.id === 'jiosaavn' &&
		normalizedApiUrl.length > 0 &&
		normalizedApiUrl !== savedApiUrl;

	const handleSaveApiUrl = useCallback(() => {
		if (!plugin || plugin.id !== 'jiosaavn' || !normalizedApiUrl) {
			return;
		}

		setPluginConfig(plugin.id, {
			...pluginConfig,
			baseUrl: normalizedApiUrl,
		});
		toastSuccess(
			'API URL saved',
			isEnabled ? 'Restart the app or toggle the plugin to apply it.' : 'Saved for next start.'
		);
	}, [plugin, normalizedApiUrl, pluginConfig, setPluginConfig, toastSuccess, isEnabled]);

	if (!plugin) {
		return (
			<PageLayout header={{ title: 'Plugin', showBack: true }}>
				<EmptyState
					icon={DEFAULT_PLUGIN_ICON}
					title={'Plugin not found'}
					description={'This plugin may have been removed'}
				/>
			</PageLayout>
		);
	}

	const headerRightActions = (
		<Switch value={isEnabled} onValueChange={handleToggle} disabled={plugin.isRequired} />
	);

	return (
		<PageLayout
			header={{
				title: plugin.name,
				showBack: true,
				rightActions: headerRightActions,
			}}
		>
			<PlayerAwareScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
			>
				<View style={styles.detailHeader}>
					<View
						style={[
							styles.detailIcon,
							{ backgroundColor: colors.surfaceContainerHighest },
						]}
					>
						{plugin.iconUrl ? (
							<Image
								source={{ uri: plugin.iconUrl }}
								style={styles.detailIconImage}
								contentFit={'contain'}
								cachePolicy={'memory-disk'}
							/>
						) : (
							<Icon
								as={categoryIcons[plugin.category] || DEFAULT_PLUGIN_ICON}
								size={40}
								color={colors.onSurface}
							/>
						)}
					</View>
					<Text
						variant={'headlineSmall'}
						style={[styles.detailTitle, { color: colors.onSurface }]}
					>
						{plugin.name}
					</Text>
					<Text variant={'bodyMedium'} style={{ color: colors.onSurfaceVariant }}>
						Version {plugin.version}
					</Text>
					<View style={styles.detailStatusRow}>
						<Icon as={StatusIcon} size={16} color={statusColor} />
						<Text variant={'bodySmall'} style={{ color: statusColor }}>
							{isEnabled && !plugin.isLoaded
								? 'Restart app to load'
								: statusInfo.label}
						</Text>
					</View>
					{plugin.isRequired && (
						<Chip icon={LockIcon} compact style={styles.requiredBadge}>
							Required plugin
						</Chip>
					)}
				</View>

				{plugin.description && (
					<SettingsSection title={'Description'}>
						<View style={styles.detailCard}>
							<Text variant={'bodyMedium'} style={{ color: colors.onSurface }}>
								{plugin.description}
							</Text>
						</View>
					</SettingsSection>
				)}

				<SettingsSection title={'Category'}>
					<View style={styles.detailCard}>
						<Text variant={'bodyMedium'} style={{ color: colors.onSurface }}>
							{categoryLabels[plugin.category] || plugin.category}
						</Text>
					</View>
				</SettingsSection>

				{plugin.requiresAuth && (
					<SettingsSection title={'Authentication'}>
						<View style={styles.detailCard}>
							<View style={styles.authRow}>
								<Icon as={LockIcon} size={16} color={colors.onSurfaceVariant} />
								<Text variant={'bodyMedium'} style={{ color: colors.onSurface }}>
									This plugin requires authentication to use
								</Text>
							</View>
						</View>
					</SettingsSection>
				)}

				{plugin.capabilities.length > 0 && (
					<SettingsSection title={'Capabilities'}>
						<View style={styles.detailCard}>
							<View style={styles.capabilitiesContainer}>
								{plugin.capabilities.map((cap) => (
									<Chip key={cap} compact>
										{cap.replace(/-/g, ' ')}
									</Chip>
								))}
							</View>
						</View>
					</SettingsSection>
				)}

				{plugin.id === 'jiosaavn' && (
					<SettingsSection title={'API Endpoint'}>
						<View style={styles.detailCard}>
							<Input
								label={'JioSaavn API URL'}
								value={apiUrlDraft}
								onChangeText={setApiUrlDraft}
								autoCapitalize={'none'}
								autoCorrect={false}
								autoComplete={'off'}
								keyboardType={'url'}
								placeholder={'https://saavn.sumit.co'}
							/>
							<Text
								variant={'bodySmall'}
								style={[styles.apiHelp, { color: colors.onSurfaceVariant }]}
							>
								Use any saavn.dev-compatible API URL. It saves on device, so you can
								switch endpoints without recompiling.
							</Text>
							<Button
								mode={'contained'}
								icon={() => <Icon as={LinkIcon} size={18} color={colors.onPrimary} />}
								onPress={handleSaveApiUrl}
								disabled={!canSaveApiUrl}
								style={styles.apiButton}
							>
								Save API URL
							</Button>
						</View>
					</SettingsSection>
				)}

				<PluginSettingsSection
					pluginId={plugin.id}
					hiddenKeys={plugin.id === 'jiosaavn' ? ['baseUrl'] : undefined}
				/>
				<LibraryImportSection pluginId={plugin.id} />

				{plugin.requiresAuth && (
					<SettingsSection title={'Troubleshooting'}>
						<SettingsItem
							icon={Trash2Icon}
							title={'Clear cache'}
							subtitle={`This will sign you out of ${plugin.name}`}
							onPress={handleClearCache}
							destructive
						/>
					</SettingsSection>
				)}

				<ConfirmationDialog
					visible={clearCacheDialogVisible}
					title={'Clear cache?'}
					message={
						'This will clear all browser cookies and sign you out. You will need to sign in again.'
					}
					confirmLabel={'Clear'}
					onConfirm={confirmClearCache}
					onCancel={() => setClearCacheDialogVisible(false)}
					destructive
				/>
			</PlayerAwareScrollView>
		</PageLayout>
	);
}

const styles = StyleSheet.create({
	scrollView: {
		flex: 1,
		paddingHorizontal: 8,
	},
	scrollContent: {
		paddingBottom: 32,
	},
	detailHeader: {
		alignItems: 'center',
		paddingVertical: 32,
	},
	detailIcon: {
		width: 80,
		height: 80,
		borderRadius: 40,
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
		marginBottom: 16,
	},
	detailIconImage: {
		width: 56,
		height: 56,
	},
	detailTitle: {
		fontWeight: '700',
	},
	detailStatusRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: 8,
	},
	requiredBadge: {
		marginTop: 12,
	},
	detailCard: {
		padding: 16,
	},
	authRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	capabilitiesContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	apiHelp: {
		marginTop: 8,
		lineHeight: 18,
	},
	apiButton: {
		marginTop: 12,
		alignSelf: 'flex-start',
	},
});
