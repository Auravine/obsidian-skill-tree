import { NodeRevealModal } from 'node-reveal-modal';
import { NodeUnlockModal } from 'node-unlock-modal';
import { Notice, Plugin } from 'obsidian';
import { getAPI } from "obsidian-dataview";
import { SkillTreePluginSettings, SkillTreeSettingTab, DEFAULT_SETTINGS } from 'plugin-settings';
import { VisibleNodeInitializationModal } from 'visible-node-initialization-modal';

export default class SkillTreePlugin extends Plugin {
	settings!: SkillTreePluginSettings;

	async onload() {
		
		await this.loadSettings();

		let dv = getAPI(this.app);
		if (!dv) {
			new Notice('Dataview failed to load; aborting Skill Tree loading');
			return;
		}

		// Ribbon button to sync primary files
		this.addRibbonIcon('book-up', 'Sync Primary Files', async (evt: MouseEvent) => {
			this.settings.primaryFilepaths.forEach(async (primaryFilepath) => {
				const base = this.app.vault.getFileByPath(primaryFilepath)
				if (base == null || base == undefined) {
					new Notice(`${primaryFilepath} not found in master vault`);
					return;
				}
				this.settings.childVaults.forEach(async childVault => {
					const copyPath = `${childVault.path}/${primaryFilepath}`;
					const copy = this.app.vault.getFileByPath(copyPath);
					if (copy) {
						await this.app.vault.delete(copy);
					}
					await this.app.vault.copy(base, copyPath);
				});
			});
			new Notice(`Synced ${this.settings.primaryFilepaths.length} files across ${this.settings.childVaults.length} child vaults`);
		});

		// Ribbon button to make nodes with no view conditions viewable
		this.addRibbonIcon('book-plus', 'Initialize Visible Nodes', async (evt: MouseEvent) => {
			new VisibleNodeInitializationModal(this, dv).open();
		});

		this.addRibbonIcon('book-lock', 'Reveal Node', async (evt: MouseEvent) => {
			new NodeRevealModal(this).open();
		});

		// Ribbon button to unlock node
		this.addRibbonIcon('book-key', 'Unlock Node', async (evt: MouseEvent) => {
			new NodeUnlockModal(this, dv).open();
		});

		// Settings menu
		this.addSettingTab(new SkillTreeSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}