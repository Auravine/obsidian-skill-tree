import { removeFromPlayerConditionals } from "helper-functions";
import SkillTreePlugin from "main";
import { Modal, Setting, Notice } from "obsidian";


export class NodeRevealModal extends Modal {
    constructor(plugin: SkillTreePlugin) {
        super(plugin.app);
        this.setTitle('Reveal Node')

        let child = '';
        new Setting(this.contentEl)
            .setName('Child Vault Name')
            .addText((text) =>
            text.onChange((value) => {
                child = value;
            }));

        let node = '';
        new Setting(this.contentEl)
          .setName('Node Name')
          .addText((text) =>
            text.onChange((value) => {
              node = value;
            }));
    
        new Setting(this.contentEl)
          .addButton((btn) =>
            btn
              .setButtonText('Reveal')
              .setCta()
              .onClick(async () => {
                let childPath = '';
                plugin.settings.childVaults.forEach(c => {
                    if (c.name == child) {
                        childPath = c.path;
                    }
                });
                if (childPath == '') {
                    new Notice(`Child vault not found for name ${child}`);
                    return;
                }
                this.onReveal(plugin, node, childPath, child);
                this.close();
              }));
    }

    async onReveal(plugin: SkillTreePlugin, node: string, child: string, childName: string): Promise<void> {
        const nodePath = `${plugin.settings.treePath}/${node}.md`;
        const childPath = `${child}/${nodePath}`;
        const nodeFile = plugin.app.vault.getFileByPath(nodePath)
        if (nodeFile == null) {
            new Notice(`Node ${node} not found in master vault`);
            return;
        }
        if (await removeFromPlayerConditionals(plugin, childName, nodeFile)) {
            const copy = plugin.app.vault.getFileByPath(childPath);
            if (copy) {
                await plugin.app.vault.delete(copy);
            }
            await plugin.app.vault.copy(nodeFile, childPath)
            new Notice('Synced 1 files');
        }
        else {
            new Notice(`File ${nodeFile.name} not found in Player Conditionals; reveal aborted`);
        }
    }
}