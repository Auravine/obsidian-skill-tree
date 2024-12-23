import { addToPlayerConditionals, fileNameFromPath, removeFromPlayerConditionals } from "helper-functions";
import SkillTreePlugin from "main";
import { Modal, Notice, Setting, TFile } from "obsidian";
import { DataviewApi } from "obsidian-dataview";

interface UnlockReturnData {
    approved: TFile[],
    denied: TFile[],
    unclear: UnlockVerificationData[]
}

interface UnlockVerificationData {
    file: TFile,
    viewRequirements: string[],
}

enum ViewConditionsState {
    approved,
    denied,
    unclear
}

export class NodeUnlockModal extends Modal {
    constructor(plugin: SkillTreePlugin, dv: DataviewApi) {
        super(plugin.app);
        this.setTitle('Unlock Node')

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

        let verificationList : HTMLDivElement;
        let pending: number = -1;
        let approved: TFile[] = [];
        let denied: TFile[] = [];
    
        new Setting(this.contentEl)
          .addButton((btn) =>
            btn
              .setButtonText('Unlock')
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
                let unlockData = await this.onUnlock(plugin, dv, node, childPath);
                btn.setDisabled(true);
                approved.push(...unlockData.approved);
                denied.push(...unlockData.denied);
                pending = unlockData.unclear.length;
                if (pending == 0) {
                    await this.finalizeDecisions(plugin, dv, child, childPath, approved, denied);
                }
                unlockData.unclear.forEach(verificationData => {
                    let verificationSetting = new Setting(verificationList)
                        .setName(fileNameFromPath(verificationData.file.path))
                        .setDesc(verificationData.viewRequirements.join(' '))
                        .addButton((btn) => btn
                            .setButtonText('Approve')
                            .setCta()
                            .onClick(async () => {
                                verificationList.removeChild(verificationSetting.settingEl);
                                approved.push(verificationData.file);
                                pending--;
                                if (pending == 0) {
                                    await this.finalizeDecisions(plugin, dv, child, childPath, approved, denied);
                                }
                            }))
                        .addButton((btn) => btn
                            .setButtonText('Deny')
                            .onClick(async () => {
                                verificationList.removeChild(verificationSetting.settingEl);
                                denied.push(verificationData.file);
                                pending--;
                                if (pending == 0) {
                                    await this.finalizeDecisions(plugin, dv, child, childPath, approved, denied);
                                }
                            }))
                });
              }));

        verificationList = this.contentEl.createDiv()
    }

    async onUnlock(plugin: SkillTreePlugin, dv: DataviewApi, node: string, child: string): Promise<UnlockReturnData> {
        let returnData: UnlockReturnData = { approved: [], denied: [], unclear: [] };
        const nodePath = `${plugin.settings.treePath}/${node}.md`;
        const nodeFile = plugin.app.vault.getFileByPath(nodePath)
        if (nodeFile == null) {
            new Notice(`Node ${node} not found in master vault`);
            return returnData;
        }
        const nodePage = dv.page(nodePath)
        if (nodePage == null) {
            new Notice(`Node ${node} page creation failed in master vault`);
            return returnData;
        }
        const childPath = `${child}/${nodePath}`;
        const childFile = plugin.app.vault.getFileByPath(childPath)
        if (childFile == null) {
            new Notice(`Node ${node} not found in child vault`);
            return returnData;
        }
        await plugin.app.fileManager.processFrontMatter(childFile, fm => {
            let data: boolean = fm['unlocked'] ? fm['unlocked'] as boolean : false;
            if (data) {
                new Notice(`Node ${node} already unlocked; proceeding regardless`);
            }
            else {
                data = true;
                fm['unlocked'] = data;
            }
        });
        for (let backlink of nodePage.file.inlinks) {
            const childBacklinkPath = `${child}/${backlink.path}`;
            if (backlink.path.startsWith(plugin.settings.treePath)) {
                if (plugin.app.vault.getFileByPath(childBacklinkPath)) {
                    returnData.approved.push(backlink);
                }
                else {
                    let backlinkPage = dv.page(backlink.path);
                    if (backlinkPage) {
                        if (backlinkPage["view-reqs"]) {
                            let viewRequirements: any[] = backlinkPage["view-reqs"];
                            const viewConditionsState = await this.checkViewRequirements(plugin, child, viewRequirements)
                            if (viewConditionsState == ViewConditionsState.approved) {
                                returnData.approved.push(backlink);
                            } else if (viewConditionsState == ViewConditionsState.denied) {
                                returnData.denied.push(backlink);
                            } else {
                                viewRequirements = viewRequirements.map((str) => {
                                    str = `${str}`;
                                    if (!str.includes('[') || !str.includes('|')) {
                                        return str;
                                    }
                                    return `[[${str.slice(2, -2).split('|').pop()}]]`;
                                })
                                returnData.unclear.push({ file: backlink, viewRequirements });
                            }
                        }
                        else {
                            returnData.approved.push(backlink);
                        }
                    }
                    else {
                        new Notice(`Backlink ${backlink} page creation failed in master vault; manual intervention required`, 0);
                    }
                }
            }
        }
        return returnData;
    }

    async checkViewRequirements(plugin: SkillTreePlugin, child: string, viewRequirements: any[]): Promise<ViewConditionsState> {
        let anyTrueRequirement = 0;
        let anyTrueCounter = 0;
        for (const requirement of viewRequirements) {
            const str = `${requirement}`
            const match = str.match(/Any (\d+) of the following/);
            if (match) {
                anyTrueRequirement = parseInt(match[1], 10);
            }
            else {
                if (!str.includes('[')) {
                    if (anyTrueRequirement == 0) {
                        return ViewConditionsState.unclear;
                    }
                    else {
                        continue;
                    }
                }
                let fileName = str
                    .replace('[[', '')
                    .replace(']]', '')
                    .replace('\"', '')
                    .split('|')
                    .pop();
                if (fileName?.includes('/')) {
                    fileName = fileName.split("/").pop();
                }
                if (!fileName) {
                    new Notice(`Filename parsing for ${str} failed; moved for manual approval`);
                    return ViewConditionsState.unclear;
                }
                const requirementFilePath = `${child}/${plugin.settings.treePath}/${fileName}.md`;
                const requirementFile = plugin.app.vault.getFileByPath(requirementFilePath);
                if (!requirementFile) {
                    if (anyTrueRequirement == 0) {
                        return ViewConditionsState.denied;
                    }
                    else {
                        continue;
                    }
                }
                let unlocked = false
                await plugin.app.fileManager.processFrontMatter(requirementFile, fm => {
                    unlocked = fm['unlocked'];
                })
                if (!unlocked) {
                    if (anyTrueRequirement == 0) {
                        return ViewConditionsState.denied;
                    }
                    else {
                        continue;
                    }
                }
                if (anyTrueCounter < anyTrueRequirement) {
                    anyTrueCounter++;
                    if (anyTrueCounter == anyTrueRequirement) {
                        return ViewConditionsState.approved;
                    }
                }
            }
        }
        return anyTrueCounter == anyTrueRequirement ? ViewConditionsState.approved : ViewConditionsState.denied;
    }

    async finalizeDecisions(plugin: SkillTreePlugin, dv: DataviewApi, child: string, childPath: string, approved: TFile[], denied: TFile[]): Promise<void> {
        let additionalSyncedFiles = 0;
        for (const f of approved) {
            const copyPath = `${childPath}/${plugin.settings.treePath}/${fileNameFromPath(f.path)}.md`;
            const copy = plugin.app.vault.getFileByPath(copyPath);
            if (copy) {
                await plugin.app.vault.delete(copy);
            }
            await plugin.app.vault.copy(f, copyPath)
            additionalSyncedFiles += await this.copyLinkedFiles(plugin, dv, f, childPath);
            await removeFromPlayerConditionals(plugin, child, f);
        }
        for (const f of denied) {
            await addToPlayerConditionals(plugin, child, f);
        }
        new Notice(`Synced ${approved.length}+${additionalSyncedFiles} files, and ensured ${denied.length} files in Player Conditionals`);
        this.close();
    }

    async copyLinkedFiles(plugin: SkillTreePlugin, dv: DataviewApi, file: TFile, childPath: string): Promise<number> {
        let syncedFiles = 0;
        const outlinks = dv.page(file.path)?.file?.outlinks ?? [];
        for (const link of outlinks) {
            const linkStr = `${link}`.slice(2, -2).split('|').first();
            let linkedFile;
            if (linkStr) {
                linkedFile = plugin.app.metadataCache.getFirstLinkpathDest(linkStr, file.path)
            }
            if (linkedFile) {
                if (!linkedFile.path.startsWith(plugin.settings.treePath)) {
                    const newPath = `${childPath}/${linkedFile.path}`;
                    if (plugin.app.vault.getFileByPath(newPath)) {
                        new Notice(`Linked file ${fileNameFromPath(newPath)} already exists in child vault; skipping file creation and proceeding regardless`, 0);
                    }
                    else {
                        const clipIndex = newPath.lastIndexOf('/');
                        const folderPath = newPath.substring(0, clipIndex);
                        if (clipIndex != -1 && !plugin.app.vault.getFolderByPath(folderPath)) {
                            await plugin.app.vault.createFolder(folderPath);
                        }
                        syncedFiles++;
                        const content = await plugin.app.vault.cachedRead(linkedFile);
                        await plugin.app.vault.create(newPath, content);
                    }
                }
            }
            else {
                new Notice(`Linked file ${link} not found; proceeding regardless`, 0);
            }
        }
        return syncedFiles;
    }
}