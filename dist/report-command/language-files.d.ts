import { LanguageFile, I18NLanguage, I18NItem } from '../types';
export declare class LanguageFileUpdater {
    languageFiles: LanguageFile[];
    hasChanges: boolean;
    constructor(languageFiles: string);
    addMissingKeys(missingKeys: I18NItem[]): void;
    removeUnusedKeys(unusedKeys: I18NItem[]): void;
    writeChanges(): void;
}
export declare function parseLanguageFiles(languageFilesPath: string): I18NLanguage;
