import { addToPlayerConditionals, fileNameFromPath } from "helper-functions";
import SkillTreePlugin from "main";
import { Modal, Setting, Notice } from "obsidian";
import { DataviewApi } from "obsidian-dataview";

export class VisibleNodeInitializationModal extends Modal {
    constructor(plugin: SkillTreePlugin, dv: DataviewApi) {
        super(plugin.app);
        this.setTitle('Initialize Visible Nodes')

        let child = '';
        new Setting(this.contentEl)
            .setName('Child Vault Name')
            .addText((text) =>
            text.onChange((value) => {
                child = value;
            }));
    
        new Setting(this.contentEl)
          .addButton((btn) =>
            btn
              .setButtonText('Initialize')
              .setCta()
              .onClick(async () => {
                let childPath;
                plugin.settings.childVaults.forEach(c => {
                    if (c.name == child) {
                        childPath = c.path;
                    }
                });
                if (!childPath) {
                    new Notice(`Child vault not found for name ${child}`);
                    return;
                }
                const masterDirectory = plugin.settings.treePath;
                const childDirectory = `${childPath}/${masterDirectory}`
                if (!plugin.app.vault.getFolderByPath(childDirectory)) {
                    await plugin.app.vault.createFolder(childDirectory);
                }
                const treeFiles = plugin.app.vault.getMarkdownFiles()
                    .filter(f => f.path.startsWith(masterDirectory));
                const noViewRequirementsFiles = (await Promise.all(treeFiles
                    .map(async (f, i) => {
                        let noViewRequirements = false;
                        await plugin.app.fileManager.processFrontMatter(f, fm => {
                            noViewRequirements = fm['view-reqs'] === undefined || fm['view-reqs'] === null || fm['view-reqs'].length === 0;
                        })
                        return noViewRequirements ? f : null;
                    }))).filter(f => f != null);
                noViewRequirementsFiles.forEach(async f => {
                    if (f == null) {
                        new Notice('File issue 1', 0);
                        return;
                    }
                    const copyPath = `${childDirectory}/${fileNameFromPath(f.path)}.md`;
                    const copy = plugin.app.vault.getFileByPath(copyPath);
                    if (copy != null) {
                        await plugin.app.vault.delete(copy);
                    }
                    await plugin.app.vault.copy(f, copyPath)
                });
                const linklessViewRequirementsFiles = (await Promise.all(treeFiles
                    .filter(f => !noViewRequirementsFiles.contains(f))
                    .map(async f => {
                        let linklessViewRequirements = true;
                        await plugin.app.fileManager.processFrontMatter(f, fm => {
                            fm['view-reqs'].forEach((req: any) => {
                                let str: string = `${req}`;
                                if (str.includes('[')) {
                                    linklessViewRequirements = false;
                                }
                            });
                        })
                        return linklessViewRequirements ? f : null;
                    }))).filter(f => f != null);
                linklessViewRequirementsFiles.forEach(async f => {
                    if (f == null) {
                        new Notice('File issue 2', 0);
                        return;
                    }
                    await addToPlayerConditionals(plugin, child, f);
                });
                new Notice(`Synced ${noViewRequirementsFiles.length} files, and ensured ${linklessViewRequirementsFiles.length} files in Player Conditionals`);
                this.close();
              }));
    }
}