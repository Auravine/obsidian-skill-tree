import SkillTreePlugin from "main";
import { PluginSettingTab, App, Setting } from "obsidian";


export interface SkillTreePluginSettings {
	primaryFilepaths: string[],
	childVaults: ChildVault[],
	treePath: string,
	playerConditionalsPath: string,
}

export interface ChildVault {
	name: string,
	path: string,
}

export const DEFAULT_SETTINGS: SkillTreePluginSettings = {
	primaryFilepaths: [],
	childVaults: [],
	treePath: '',
	playerConditionalsPath: '',
}

export class SkillTreeSettingTab extends PluginSettingTab {
	plugin: SkillTreePlugin;

	constructor(app: App, plugin: SkillTreePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		// Primary files
        this.containerEl.createEl('h2', { text: 'Primary Files' });
        new Setting(this.containerEl)
            .addButton((btn) =>
                btn
                    .setButtonText('Add File')
                    .setCta()
                    .onClick(() => {
                        this.plugin.settings.primaryFilepaths.push('');
                        this.plugin.saveSettings();
                        this.display(); // Refresh the settings UI
                    })
            );
        const primaryFilesContainer = this.containerEl.createEl('div');
        this.plugin.settings.primaryFilepaths.forEach((filepath, index) => {
			new Setting(primaryFilesContainer)
            .addText((text) =>
                text
                    .setPlaceholder(`Enter a file path...`)
                    .setValue(filepath)
                    .onChange(async (newValue) => {
                        this.plugin.settings.primaryFilepaths[index] = newValue;
                        await this.plugin.saveSettings();
                    })
            )
            .addExtraButton((btn) =>
                btn
                    .setIcon('cross')
                    .setTooltip('Remove')
                    .onClick(async () => {
                        this.plugin.settings.primaryFilepaths.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display(); // Refresh the settings UI
                    })
            );
        });

		// Child Vaults
        this.containerEl.createEl('h2', { text: 'Child Vaults' });
        new Setting(this.containerEl)
            .addButton((btn) =>
                btn
                    .setButtonText('Add Child Vault')
                    .setCta()
                    .onClick(() => {
                        this.plugin.settings.childVaults.push({name: '', path: ''});
                        this.plugin.saveSettings();
                        this.display(); // Refresh the settings UI
                    })
            );
        const childVaultsContainer = this.containerEl.createEl('div');
        this.plugin.settings.childVaults.forEach((vault, index) => {
			new Setting(childVaultsContainer)
            .addText((text) =>
                text
                    .setPlaceholder(`Enter a name...`)
                    .setValue(vault.name)
                    .onChange(async (newValue) => {
                        this.plugin.settings.childVaults[index] = { name: newValue, path: this.plugin.settings.childVaults[index].path };
                        await this.plugin.saveSettings();
                    })
            )
            .addText((text) =>
                text
                    .setPlaceholder(`Enter a folder path...`)
                    .setValue(vault.path)
                    .onChange(async (newValue) => {
                        this.plugin.settings.childVaults[index] = { name: this.plugin.settings.childVaults[index].name, path: newValue };
                        await this.plugin.saveSettings();
                    })
            )
            .addExtraButton((btn) =>
                btn
                    .setIcon('cross')
                    .setTooltip('Remove')
                    .onClick(async () => {
                        this.plugin.settings.childVaults.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display(); // Refresh the settings UI
                    })
            );
        });

		// Skill Tree
        this.containerEl.createEl('h2', { text: 'Skill Tree' });
        new Setting(this.containerEl)
            .addText((text) =>
                text
                    .setPlaceholder('Enter a file path...')
                    .setValue(this.plugin.settings.treePath)
                    .onChange(async (newValue) => {
                        this.plugin.settings.treePath = newValue;
                        await this.plugin.saveSettings();
                    })
            )

		// Player Conditionals
        this.containerEl.createEl('h2', { text: 'Player Conditionals' });
        new Setting(this.containerEl)
            .addText((text) =>
                text
                    .setPlaceholder('Enter a file path...')
                    .setValue(this.plugin.settings.playerConditionalsPath)
                    .onChange(async (newValue) => {
                        this.plugin.settings.playerConditionalsPath = newValue;
                        await this.plugin.saveSettings();
                    })
            )
    }
}
