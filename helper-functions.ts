import SkillTreePlugin from "main";
import { TFile, Notice } from "obsidian";

export function fileNameFromPath(path: string): string {
    return `${path.split('/').pop()?.split('.').first()}`;
}

export async function removeFromPlayerConditionals(plugin: SkillTreePlugin, child: string, file: TFile): Promise<boolean> {
    const playerConditionals = plugin.app.vault.getFileByPath(plugin.settings.playerConditionalsPath);
    if (!playerConditionals) {
        new Notice(`Player Conditionals file not found; manual intervention required for file ${file.name}`, 0);
        return false;
    }
    let returnVal = false;
    await plugin.app.fileManager.processFrontMatter(playerConditionals, fm => {
        let data: string[] = fm[child] ? fm[child] as string[] : [];
        const element = `[[${file.path}|${fileNameFromPath(file.path)}]]`;
        if (data.includes(element)) {
            data.remove(element);
            fm[child] = data;
            returnVal = true;
        }
    });
    return returnVal;
}

export async function addToPlayerConditionals(plugin: SkillTreePlugin, child: string, file: TFile): Promise<void> {
    const playerConditionals = plugin.app.vault.getFileByPath(plugin.settings.playerConditionalsPath);
    if (!playerConditionals) {
        new Notice(`Player Conditionals file not found; manual intervention required for file ${file.name}`, 0);
        return;
    }
    await plugin.app.fileManager.processFrontMatter(playerConditionals, fm => {
        let data: string[] = fm[child] ? fm[child] as string[] : [];
        const element = `[[${file.path}|${fileNameFromPath(file.path)}]]`;
        if (!data.includes(element)) {
            data.push(element);
            fm[child] = data;
        }
    });
}