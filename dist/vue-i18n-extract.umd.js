(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('path'), require('fs'), require('is-valid-glob'), require('glob'), require('dot-object'), require('js-yaml')) :
  typeof define === 'function' && define.amd ? define(['exports', 'path', 'fs', 'is-valid-glob', 'glob', 'dot-object', 'js-yaml'], factory) :
  (global = global || self, factory(global.vueI18NExtract = {}, global.path, global.fs, global.isValidGlob, global.glob, global.dotObject, global.jsYaml));
}(this, (function (exports, path, fs, isValidGlob, glob, dot, yaml) {
  path = path && Object.prototype.hasOwnProperty.call(path, 'default') ? path['default'] : path;
  fs = fs && Object.prototype.hasOwnProperty.call(fs, 'default') ? fs['default'] : fs;
  isValidGlob = isValidGlob && Object.prototype.hasOwnProperty.call(isValidGlob, 'default') ? isValidGlob['default'] : isValidGlob;
  glob = glob && Object.prototype.hasOwnProperty.call(glob, 'default') ? glob['default'] : glob;
  dot = dot && Object.prototype.hasOwnProperty.call(dot, 'default') ? dot['default'] : dot;
  yaml = yaml && Object.prototype.hasOwnProperty.call(yaml, 'default') ? yaml['default'] : yaml;

  function _extends() {
    _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }

      return target;
    };

    return _extends.apply(this, arguments);
  }

  function readVueFiles(src) {
    if (!isValidGlob(src)) {
      throw new Error(`vueFiles isn't a valid glob pattern.`);
    }

    const targetFiles = glob.sync(src);

    if (targetFiles.length === 0) {
      throw new Error('vueFiles glob has no files.');
    }

    return targetFiles.map(f => {
      const fileName = f.replace(process.cwd(), '');
      return {
        fileName,
        path: f,
        content: fs.readFileSync(f, 'utf8')
      };
    });
  }

  function* getMatches(file, regExp, captureGroup = 1) {
    while (true) {
      const match = regExp.exec(file.content);

      if (match === null) {
        break;
      }

      const line = (file.content.substring(0, match.index).match(/\n/g) || []).length + 1;
      yield {
        path: match[captureGroup],
        line,
        file: file.fileName
      };
    }
  }
  /**
   * Extracts translation keys from methods such as `$t` and `$tc`.
   *
   * - **regexp pattern**: (?:[$ .]tc?)\(
   *
   *   **description**: Matches the sequence t( or tc(, optionally with either “$”, “.” or “ ” in front of it.
   *
   * - **regexp pattern**: (["'`])
   *
   *   **description**: 1. capturing group. Matches either “"”, “'”, or “`”.
   *
   * - **regexp pattern**: ((?:[^\\]|\\.)*?)
   *
   *   **description**: 2. capturing group. Matches anything except a backslash
   *   *or* matches any backslash followed by any character (e.g. “\"”, “\`”, “\t”, etc.)
   *
   * - **regexp pattern**: \1
   *
   *   **description**: matches whatever was matched by capturing group 1 (e.g. the starting string character)
   *
   * @param file a file object
   * @returns a list of translation keys found in `file`.
   */


  function extractMethodMatches(file) {
    const methodRegExp = /(?:[$ ."]tc?)\(\s*?(["'`])((?:[^\\]|\\.)*?)\1/g;
    return [...getMatches(file, methodRegExp, 2)];
  }

  function extractComponentMatches(file) {
    const componentRegExp = /(?:<i18n)(?:.|\n)*?(?:[^:]path=("|'))(.*?)\1/gi;
    return [...getMatches(file, componentRegExp, 2)];
  }

  function extractDirectiveMatches(file) {
    const directiveRegExp = /v-t="'(.*?)'"/g;
    return [...getMatches(file, directiveRegExp)];
  }

  function extractI18nItemsFromVueFiles(sourceFiles) {
    return sourceFiles.reduce((accumulator, file) => {
      const methodMatches = extractMethodMatches(file);
      const componentMatches = extractComponentMatches(file);
      const directiveMatches = extractDirectiveMatches(file);
      return [...accumulator, ...methodMatches, ...componentMatches, ...directiveMatches];
    }, []);
  }

  function parseVueFiles(vueFilesPath) {
    const filesList = readVueFiles(vueFilesPath);
    return extractI18nItemsFromVueFiles(filesList);
  }

  function readLangFiles(src) {
    if (!isValidGlob(src)) {
      throw new Error(`languageFiles isn't a valid glob pattern.`);
    }

    const targetFiles = glob.sync(src);

    if (targetFiles.length === 0) {
      throw new Error('languageFiles glob has no files.');
    }

    return targetFiles.map(f => {
      const langPath = path.resolve(process.cwd(), f);
      const extension = langPath.substring(langPath.lastIndexOf('.')).toLowerCase();
      const isJSON = extension === '.json';
      const isYAML = extension === '.yaml' || extension === '.yml';
      let langObj;

      if (isJSON) {
        langObj = JSON.parse(fs.readFileSync(langPath, 'utf8'));
      } else if (isYAML) {
        langObj = yaml.safeLoad(fs.readFileSync(langPath, 'utf8'));
      } else {
        langObj = eval(fs.readFileSync(langPath, 'utf8'));
      }

      const fileName = f.replace(process.cwd(), '');
      return {
        fileName,
        path: f,
        content: langObj
      };
    });
  }

  function extractI18nItemsFromLanguageFiles(languageFiles) {
    return languageFiles.reduce((accumulator, file) => {
      const language = file.fileName.substring(file.fileName.lastIndexOf('/') + 1, file.fileName.lastIndexOf('.'));

      if (!accumulator[language]) {
        accumulator[language] = [];
      }

      const flattenedObject = dot.dot(file.content);
      Object.keys(flattenedObject).forEach((key, index) => {
        var _accumulator$language;

        (_accumulator$language = accumulator[language]) == null ? void 0 : _accumulator$language.push({
          line: index,
          path: key,
          file: file.fileName
        });
      });
      return accumulator;
    }, {});
  }

  class LanguageFileUpdater {
    constructor(languageFiles) {
      this.hasChanges = false;
      this.languageFiles = readLangFiles(path.resolve(process.cwd(), languageFiles));
    }

    addMissingKeys(missingKeys) {
      this.hasChanges = true;
      this.languageFiles.forEach(languageFile => {
        missingKeys.forEach(item => {
          if (item.language && languageFile.fileName.includes(item.language) || !item.language) {
            dot.str(item.path, '', languageFile.content);
          }
        });
      });
    }

    removeUnusedKeys(unusedKeys) {
      this.hasChanges = true;
      this.languageFiles.forEach(languageFile => {
        unusedKeys.forEach(item => {
          if (item.language && languageFile.fileName.includes(item.language)) {
            dot.delete(item.path, languageFile.content);
          }
        });
      });
    }

    writeChanges() {
      this.languageFiles.forEach(languageFile => {
        new FileAccessLayer(languageFile.path).write(languageFile.content);
      });
    }

  }

  class FileAccessLayer {
    constructor(path) {
      this.path = path;
    }

    write(content) {
      const rawJSON = JSON.stringify(content, null, 2);

      const endsWith = ext => this.path.endsWith(`.${ext}`);

      let stringifiedContent = "";

      if (endsWith('json')) {
        stringifiedContent = rawJSON;
      } else if (endsWith('js')) {
        stringifiedContent = `export default ${stringifiedContent}; \n`;
      } else if (endsWith('yaml') || endsWith('yml')) {
        stringifiedContent = yaml.safeDump(content);
      } else {
        throw new Error('Filetype not supported.');
      }

      fs.writeFileSync(this.path, stringifiedContent);
    }

  }

  function parseLanguageFiles(languageFilesPath) {
    const filesList = readLangFiles(languageFilesPath);
    return extractI18nItemsFromLanguageFiles(filesList);
  }

  (function (VueI18NExtractReportTypes) {
    VueI18NExtractReportTypes[VueI18NExtractReportTypes["None"] = 0] = "None";
    VueI18NExtractReportTypes[VueI18NExtractReportTypes["Missing"] = 1] = "Missing";
    VueI18NExtractReportTypes[VueI18NExtractReportTypes["Unused"] = 2] = "Unused";
    VueI18NExtractReportTypes[VueI18NExtractReportTypes["Dynamic"] = 4] = "Dynamic";
    VueI18NExtractReportTypes[VueI18NExtractReportTypes["All"] = 7] = "All";
  })(exports.VueI18NExtractReportTypes || (exports.VueI18NExtractReportTypes = {}));

  const mightBeUsedDynamically = function (languageItem, dynamicKeys) {
    return dynamicKeys.some(dynamicKey => languageItem.path.includes(dynamicKey.path));
  };

  function extractI18NReport(parsedVueFiles, parsedLanguageFiles, reportType = exports.VueI18NExtractReportTypes.Missing + exports.VueI18NExtractReportTypes.Unused) {
    const missingKeys = [];
    const unusedKeys = [];
    const dynamicKeys = [];
    const dynamicReportEnabled = reportType & exports.VueI18NExtractReportTypes.Dynamic;
    Object.keys(parsedLanguageFiles).forEach(language => {
      let languageItems = parsedLanguageFiles[language];
      parsedVueFiles.forEach(vueItem => {
        const usedByVueItem = function (languageItem) {
          return languageItem.path === vueItem.path || languageItem.path.startsWith(vueItem.path + '.');
        };

        if (dynamicReportEnabled && (vueItem.path.includes('${') || vueItem.path.endsWith('.'))) {
          dynamicKeys.push(_extends({}, vueItem, {
            language
          }));
          return;
        }

        if (!parsedLanguageFiles[language].some(usedByVueItem)) {
          missingKeys.push(_extends({}, vueItem, {
            language
          }));
        }

        languageItems = languageItems.filter(languageItem => dynamicReportEnabled ? !mightBeUsedDynamically(languageItem, dynamicKeys) && !usedByVueItem(languageItem) : !usedByVueItem(languageItem));
      });
      unusedKeys.push(...languageItems.map(item => _extends({}, item, {
        language
      })));
    });
    let extracts = {};

    if (reportType & exports.VueI18NExtractReportTypes.Missing) {
      extracts = Object.assign(extracts, {
        missingKeys
      });
    }

    if (reportType & exports.VueI18NExtractReportTypes.Unused) {
      extracts = Object.assign(extracts, {
        unusedKeys
      });
    }

    if (dynamicReportEnabled) {
      extracts = Object.assign(extracts, {
        dynamicKeys
      });
    }

    return extracts;
  }
  async function writeReportToFile(report, writePath) {
    const reportString = JSON.stringify(report);
    return new Promise((resolve, reject) => {
      fs.writeFile(writePath, reportString, err => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  }

  function createI18NReport(vueFiles, languageFiles, command) {
    const resolvedVueFiles = path.resolve(process.cwd(), vueFiles);
    const resolvedLanguageFiles = path.resolve(process.cwd(), languageFiles);
    const parsedVueFiles = parseVueFiles(resolvedVueFiles);
    const parsedLanguageFiles = parseLanguageFiles(resolvedLanguageFiles);
    const reportType = command.dynamic ? exports.VueI18NExtractReportTypes.All : exports.VueI18NExtractReportTypes.Missing + exports.VueI18NExtractReportTypes.Unused;
    return extractI18NReport(parsedVueFiles, parsedLanguageFiles, reportType);
  }
  function reportFromConfigCommand() {
    try {
      const configFile = eval(fs.readFileSync(path.resolve(process.cwd(), 'vue-i18n-extract.config.js'), 'utf8'));
      return reportCommand(_extends({
        vueFiles: configFile.vueFilesPath,
        languageFiles: configFile.languageFilesPath
      }, configFile.options.output && {
        output: configFile.options.output
      }, configFile.options.add && {
        add: Boolean(configFile.options.add)
      }, configFile.options.dynamic && {
        dynamic: [false, 'ignore', 'report'].findIndex(e => e === configFile.options.dynamic)
      }));
    } catch (err) {
      console.error(err);
    }
  }
  async function reportCommand(command) {
    const {
      vueFiles,
      languageFiles,
      output,
      add,
      remove,
      dynamic,
      ci
    } = command;
    console.log(vueFiles);
    const report = createI18NReport(vueFiles, languageFiles, command);
    const updater = new LanguageFileUpdater(languageFiles);
    if (report.missingKeys) console.info('missing keys: '), console.table(report.missingKeys);
    if (report.unusedKeys) console.info('unused keys: '), console.table(report.unusedKeys);
    if (report.dynamicKeys && dynamic && dynamic > 1) console.info('dynamic detected keys: '), console.table(report.dynamicKeys);

    if (output) {
      await writeReportToFile(report, path.resolve(process.cwd(), output));
      console.log(`The report has been has been saved to ${output}`);
    }

    if (add && report.missingKeys && report.missingKeys.length > 0) {
      updater.addMissingKeys(report.missingKeys);
      console.log('The missing keys have been added');
    }

    if (remove && report.unusedKeys && report.unusedKeys.length > 0) {
      updater.removeUnusedKeys(report.unusedKeys);
      console.log('The unused keys have been removed');
    }

    if (updater.hasChanges) {
      updater.writeChanges();
      console.log('Language files have been updated');
    }

    if (ci && Object.prototype.hasOwnProperty.call(report, 'missingKeys') && report.missingKeys !== undefined) {
      const exitCode = report.missingKeys.length > 0 ? 1 : 0;
      console.log(`[vue-i18n-extract] ${report.missingKeys.length} missing keys found.`);
      process.exit(exitCode);
    }
  }

  var report = {
    __proto__: null,
    createI18NReport: createI18NReport,
    reportFromConfigCommand: reportFromConfigCommand,
    reportCommand: reportCommand,
    readVueFiles: readVueFiles,
    parseVueFiles: parseVueFiles,
    LanguageFileUpdater: LanguageFileUpdater,
    parseLanguageFiles: parseLanguageFiles,
    get VueI18NExtractReportTypes () { return exports.VueI18NExtractReportTypes; },
    extractI18NReport: extractI18NReport,
    writeReportToFile: writeReportToFile
  };

  const configFile = `
module.exports = {
  vueFilesPath: './', // The Vue.js file(s) you want to extract i18n strings from. It can be a path to a folder or to a file. It accepts glob patterns. (ex. *, ?, (pattern|pattern|pattern)
  languageFilesPath: './', // The language file(s) you want to compare your Vue.js file(s) to. It can be a path to a folder or to a file. It accepts glob patterns (ex. *, ?, (pattern|pattern|pattern)
  options: {
    output: false, // false | string => Use if you want to create a json file out of your report. (ex. output.json)
    add: false, // false | true => Use if you want to add missing keys into your json language files.
    dynamic: false, // false | 'ignore' | 'report' => 'ignore' if you want to ignore dynamic keys false-positive. 'report' to get dynamic keys report.
  }
};
`;
  function initCommand() {
    fs.writeFileSync('vue-i18n-extract.config.js', configFile);
  }

  var index = _extends({}, report);

  exports.LanguageFileUpdater = LanguageFileUpdater;
  exports.createI18NReport = createI18NReport;
  exports.default = index;
  exports.extractI18NReport = extractI18NReport;
  exports.initCommand = initCommand;
  exports.parseLanguageFiles = parseLanguageFiles;
  exports.parseVueFiles = parseVueFiles;
  exports.readVueFiles = readVueFiles;
  exports.reportCommand = reportCommand;
  exports.reportFromConfigCommand = reportFromConfigCommand;
  exports.writeReportToFile = writeReportToFile;

})));
//# sourceMappingURL=vue-i18n-extract.umd.js.map
