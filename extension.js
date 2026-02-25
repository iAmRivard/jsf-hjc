const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

const EL_REGEX = /#\{[^}\r\n]+\}/g;
const JAVA_EXT = ".java";
const CLASS_REGEX = /(?:public\s+)?(?:abstract\s+|final\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)\b/;
const BEAN_MEMBER_REGEX = /^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(?:\(\))?/;

const DEFAULT_EL_FOREGROUND = "#1F1F1F";
const DEFAULT_EL_BACKGROUND = "";
const DEFAULT_EL_FONT_STYLE = "normal";
const DEFAULT_ATTR_FOREGROUND = "#1F1F1F";
const DEFAULT_ATTR_NAMES = [];
const COLOR_PROFILE_DEFAULT = "default";
const COLOR_PROFILE_CUSTOM = "custom";
const COLOR_PROFILE_DISABLED = "disabled";
const CONFIG_NAMESPACE = "jsf.hjc";
const DEFAULT_JAVA_ROOT_RELATIVE = "src/main/java";
const DEFAULT_JAVA_SEMANTIC_RULES = {
    "keyword:java": "#0000CC",
    "class:java": "#000000",
    "interface:java": "#000000",
    "enum:java": "#000000",
    "typeParameter:java": "#000000",
    "method:java": "#000000",
    "variable:java": "#000000",
    "variable.declaration:java": "#000000",
    "variable.readonly:java": "#000000",
    "variable.local:java": "#000000",
    "parameter:java": "#000000",
    "property:java": "#008000",
    "enumMember:java": "#008000",
    "string:java": "#CC6600",
    "comment:java": "#7A7A7A"
};
const DEFAULT_TEXTMATE_RULES = [
    {
        scope: [
            "source.java keyword.control",
            "source.java storage.type",
            "source.java storage.modifier"
        ],
        settings: { foreground: "#0000CC" }
    },
    {
        scope: ["source.java variable.object.property"],
        settings: { foreground: "#008000" }
    },
    {
        scope: [
            "source.java meta.definition.variable",
            "source.java meta.definition.variable entity.name",
            "source.java variable.other.local",
            "source.java variable.other",
            "source.java variable.parameter"
        ],
        settings: { foreground: "#000000" }
    },
    {
        scope: ["source.java string.quoted"],
        settings: { foreground: "#CC6600" }
    },
    {
        scope: ["source.java comment"],
        settings: { foreground: "#7A7A7A" }
    },
    {
        scope: [
            "entity.name.tag",
            "entity.name.tag.namespace",
            "punctuation.definition.tag.begin",
            "punctuation.definition.tag.end"
        ],
        settings: { foreground: "#0000CC" }
    },
    {
        scope: [
            "entity.other.attribute-name",
            "entity.other.attribute-name.namespace",
            "entity.other.attribute-name.localname",
            "entity.other.attribute-name.localname.xml"
        ],
        settings: { foreground: "#2E7D32" }
    },
    {
        scope: [
            "meta.attribute-with-value string.quoted",
            "string.quoted.double.html",
            "string.quoted.double.xml",
            "string.quoted.single.html",
            "string.quoted.single.xml",
            "string.quoted.double.xhtml",
            "string.quoted.single.xhtml"
        ],
        settings: { foreground: "#CC6600" }
    },
    {
        scope: [
            "comment.block.html",
            "comment.block.xml"
        ],
        settings: { foreground: "#808080", fontStyle: "italic" }
    }
];
const JSF_COMPLETION_LIBRARIES = {
    h: {
        label: "JSF HTML",
        tags: {
            form: { attrs: ["id", "prependId", "style", "styleClass", "rendered"] },
            panelGroup: { attrs: ["id", "layout", "style", "styleClass", "rendered"] },
            outputText: { attrs: ["id", "value", "converter", "escape", "style", "styleClass", "rendered"] },
            outputLabel: { attrs: ["for", "value", "style", "styleClass", "rendered"] },
            inputText: { attrs: ["id", "value", "label", "required", "readonly", "disabled", "converter", "style", "styleClass", "rendered"] },
            inputTextarea: { attrs: ["id", "value", "label", "required", "readonly", "disabled", "rows", "cols", "style", "styleClass", "rendered"] },
            commandButton: { attrs: ["id", "value", "action", "actionListener", "immediate", "disabled", "style", "styleClass", "rendered"] },
            selectOneMenu: { attrs: ["id", "value", "converter", "required", "disabled", "style", "styleClass", "rendered"] },
            selectBooleanCheckbox: { attrs: ["id", "value", "disabled", "style", "styleClass", "rendered"] },
            messages: { attrs: ["id", "globalOnly", "showDetail", "showSummary", "style", "styleClass", "rendered"] },
            message: { attrs: ["for", "showDetail", "showSummary", "style", "styleClass", "rendered"] }
        }
    },
    f: {
        label: "JSF Core",
        tags: {
            ajax: { attrs: ["event", "execute", "render", "listener", "onevent", "onerror", "disabled", "immediate"] },
            facet: { attrs: ["name"] },
            convertNumber: { attrs: ["type", "currencySymbol", "currencyCode", "pattern", "minFractionDigits", "maxFractionDigits", "locale"] },
            convertDateTime: { attrs: ["type", "pattern", "dateStyle", "timeStyle", "timeZone", "locale"] },
            selectItem: { attrs: ["itemLabel", "itemValue", "itemDescription", "itemDisabled", "noSelectionOption"] },
            selectItems: { attrs: ["value", "var", "itemLabel", "itemValue", "itemDescription", "itemDisabled"] },
            attribute: { attrs: ["name", "value"] },
            param: { attrs: ["name", "value", "disable"] },
            viewParam: { attrs: ["name", "value", "required", "converter"] }
        }
    },
    p: {
        label: "PrimeFaces",
        tags: {
            dataTable: {
                attrs: [
                    "id", "value", "var", "rowKey", "selection", "selectionMode", "filteredValue", "sortBy", "filterBy",
                    "paginator", "rows", "rowsPerPageTemplate", "emptyMessage", "lazy", "widgetVar", "rowIndexVar",
                    "style", "styleClass", "rendered"
                ]
            },
            column: {
                attrs: [
                    "id", "headerText", "footerText", "style", "styleClass", "filterBy", "filterMatchMode",
                    "sortBy", "sortOrder", "rendered", "exportable", "width"
                ]
            },
            commandButton: {
                attrs: [
                    "id", "value", "icon", "title", "action", "actionListener", "update", "process",
                    "oncomplete", "onclick", "style", "styleClass", "rendered", "disabled", "immediate",
                    "ajax", "global"
                ]
            },
            dialog: {
                attrs: [
                    "id", "widgetVar", "header", "modal", "closable", "draggable", "resizable", "appendTo",
                    "showEffect", "hideEffect", "width", "height", "responsive", "position", "style", "styleClass", "rendered"
                ]
            },
            inputText: {
                attrs: [
                    "id", "value", "label", "required", "disabled", "readonly", "maxlength", "placeholder",
                    "converter", "style", "styleClass", "rendered"
                ]
            },
            inputTextarea: {
                attrs: [
                    "id", "value", "label", "required", "disabled", "readonly", "maxlength", "rows", "cols",
                    "autoResize", "style", "styleClass", "rendered"
                ]
            },
            selectOneMenu: {
                attrs: [
                    "id", "value", "converter", "required", "disabled", "filter", "filterMatchMode", "style",
                    "styleClass", "panelStyle", "panelStyleClass", "rendered"
                ]
            },
            ajax: { attrs: ["event", "listener", "update", "process", "oncomplete", "global", "async", "partialSubmit", "resetValues"] },
            messages: { attrs: ["id", "showDetail", "showSummary", "closable", "autoUpdate", "style", "styleClass", "rendered"] },
            message: { attrs: ["id", "for", "display", "showDetail", "showSummary", "style", "styleClass", "rendered"] }
        }
    },
    ui: {
        label: "Facelets UI",
        tags: {
            composition: { attrs: ["template"] },
            define: { attrs: ["name"] },
            insert: { attrs: ["name"] },
            include: { attrs: ["src"] },
            param: { attrs: ["name", "value"] },
            repeat: { attrs: ["id", "value", "var", "varStatus", "offset", "size", "step"] },
            fragment: { attrs: ["rendered"] },
            decorate: { attrs: ["template"] }
        }
    }
};
const JSF_BOOLEAN_ATTRIBUTES = new Set([
    "rendered",
    "disabled",
    "readonly",
    "required",
    "escape",
    "paginator",
    "lazy",
    "global",
    "ajax",
    "modal",
    "closable",
    "draggable",
    "resizable",
    "responsive",
    "autoresize",
    "partialsubmit",
    "resetvalues",
    "showdetail",
    "showsummary",
    "autoupdate",
    "immediate",
    "exportable",
    "prependid",
    "filter"
]);
const JSF_ATTRIBUTE_VALUE_OPTIONS = {
    "p:dataTable.selectionMode": ["single", "multiple"],
    "p:column.filterMatchMode": ["contains", "startsWith", "endsWith", "exact", "equals", "lt", "lte", "gt", "gte", "in"],
    "p:selectOneMenu.filterMatchMode": ["contains", "startsWith", "endsWith", "exact"],
    "p:column.sortOrder": ["ascending", "descending", "unsorted"],
    "p:dialog.position": ["center", "top", "bottom", "left", "right"],
    "p:message.display": ["text", "icon", "both"],
    "f:convertNumber.type": ["number", "currency", "percent"],
    "f:convertDateTime.type": ["date", "time", "both", "localDate", "localTime", "localDateTime", "offsetTime", "offsetDateTime", "zonedDateTime"]
};
const JSF_EL_ATTRIBUTE_HINTS = new Set([
    "value",
    "rendered",
    "rowkey",
    "selection",
    "filteredvalue",
    "sortby",
    "filterby",
    "action",
    "actionlistener",
    "listener",
    "converter",
    "styleclass",
    "label",
    "disabled",
    "readonly",
    "required",
    "for"
]);
const JSF_CLIENT_ID_KEYWORDS = ["@this", "@form", "@all", "@none", "@parent"];

let elDecorationType = null;
let attrDecorationType = null;

// key: "<workspaceFsPath>|<javaRootRelative>"
// value: { timestamp: number, index: Map<string, BeanEntry[]> }
const beanIndexCache = new Map();
// key: "<javaFilePath>|<mtimeMs>"
// value: CompletionMemberEntry[]
const beanMemberCache = new Map();
// key: "<workspaceFsPath>|<javaRootRelative>"
// value: { timestamp: number, index: Map<string, string[]> }
const javaClassIndexCache = new Map();

function getConfigValue(key, defaultValue) {
    const cfg = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    return cfg.get(key, defaultValue);
}

function getConfig() {
    const colorProfile = getConfigValue("colorProfile", COLOR_PROFILE_DEFAULT);
    const useCustom = colorProfile === COLOR_PROFILE_CUSTOM;
    const disabledByProfile = colorProfile === COLOR_PROFILE_DISABLED;

    return {
        colorProfile,
        enabled: getConfigValue("enabled", true) && !disabledByProfile,
        foreground: useCustom ? getConfigValue("foreground", DEFAULT_EL_FOREGROUND) : DEFAULT_EL_FOREGROUND,
        background: useCustom ? getConfigValue("background", DEFAULT_EL_BACKGROUND) : DEFAULT_EL_BACKGROUND,
        fontStyle: useCustom ? getConfigValue("fontStyle", DEFAULT_EL_FONT_STYLE) : DEFAULT_EL_FONT_STYLE,
        attrEnabled: getConfigValue("attributeHighlight.enabled", false),
        attrForeground: useCustom ? getConfigValue("attributeHighlight.foreground", DEFAULT_ATTR_FOREGROUND) : DEFAULT_ATTR_FOREGROUND,
        attrNames: useCustom ? getConfigValue("attributeHighlight.names", DEFAULT_ATTR_NAMES) : DEFAULT_ATTR_NAMES,
        completionEnabled: getConfigValue("completion.enabled", true),
        hoverEnabled: getConfigValue("hover.enabled", true),
        hoverJavaRootRelative: getConfigValue("hover.javaRootRelative", DEFAULT_JAVA_ROOT_RELATIVE),
        hoverCacheMs: getConfigValue("hover.cacheMs", 10000)
    };
}

function toDecorationStyle(config) {
    const style = {
        color: config.foreground,
        fontStyle: "normal",
        fontWeight: "normal",
        textDecoration: "none"
    };

    if (config.fontStyle === "italic") {
        style.fontStyle = "italic";
    } else if (config.fontStyle === "bold") {
        style.fontWeight = "bold";
    } else if (config.fontStyle === "underline") {
        style.textDecoration = "underline";
    }

    if (typeof config.background === "string" && config.background.trim().length > 0) {
        style.backgroundColor = config.background.trim();
    }

    return style;
}

function getConfigTarget() {
    return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

async function updateHighlightConfig(key, value) {
    const cfg = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    await cfg.update(key, value, getConfigTarget());
}

async function updateEditorConfig(key, value) {
    const rootCfg = vscode.workspace.getConfiguration();
    await rootCfg.update(key, value, getConfigTarget());
}

async function setLanguageSemanticHighlight(languageId, enabled) {
    const rootCfg = vscode.workspace.getConfiguration();
    const key = `[${languageId}]`;
    const current = Object.assign({}, rootCfg.get(key, {}));
    current["editor.semanticHighlighting.enabled"] = enabled;
    await rootCfg.update(key, current, getConfigTarget());
}

async function clearLanguageSemanticHighlight(languageId) {
    const rootCfg = vscode.workspace.getConfiguration();
    const key = `[${languageId}]`;
    const current = Object.assign({}, rootCfg.get(key, {}));
    if (Object.prototype.hasOwnProperty.call(current, "editor.semanticHighlighting.enabled")) {
        delete current["editor.semanticHighlighting.enabled"];
    }

    if (Object.keys(current).length === 0) {
        await rootCfg.update(key, undefined, getConfigTarget());
    } else {
        await rootCfg.update(key, current, getConfigTarget());
    }
}

function isHexColor(value, allowEmpty = false) {
    const text = (value || "").trim();
    if (allowEmpty && text.length === 0) {
        return true;
    }
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(text);
}

async function applyDefaultPalette() {
    await updateHighlightConfig("colorProfile", COLOR_PROFILE_DEFAULT);
    await updateHighlightConfig("enabled", true);
    await updateHighlightConfig("attributeHighlight.enabled", false);
    await updateHighlightConfig("attributeHighlight.names", DEFAULT_ATTR_NAMES);
    await updateEditorConfig("editor.semanticHighlighting.enabled", true);
    await updateEditorConfig("editor.semanticTokenColorCustomizations", { rules: clone(DEFAULT_JAVA_SEMANTIC_RULES) });
    await updateEditorConfig("editor.tokenColorCustomizations", { textMateRules: clone(DEFAULT_TEXTMATE_RULES) });
    await setLanguageSemanticHighlight("xml", false);
    await setLanguageSemanticHighlight("html", false);
    vscode.window.showInformationMessage("JSF HJC: paleta por defecto aplicada.");
}

async function disablePalette() {
    await updateHighlightConfig("colorProfile", COLOR_PROFILE_DISABLED);
    await updateHighlightConfig("enabled", false);
    await updateEditorConfig("editor.semanticTokenColorCustomizations", undefined);
    await updateEditorConfig("editor.tokenColorCustomizations", undefined);
    await clearLanguageSemanticHighlight("xml");
    await clearLanguageSemanticHighlight("html");
    vscode.window.showInformationMessage("JSF HJC: colores desactivados.");
}

async function configureCustomPalette() {
    const elForegroundCurrent = getConfigValue("foreground", DEFAULT_EL_FOREGROUND);
    const elBackgroundCurrent = getConfigValue("background", DEFAULT_EL_BACKGROUND);
    const attrForegroundCurrent = getConfigValue("attributeHighlight.foreground", DEFAULT_ATTR_FOREGROUND);
    const attrNamesCurrent = getConfigValue("attributeHighlight.names", DEFAULT_ATTR_NAMES);

    const elForeground = await vscode.window.showInputBox({
        title: "JSF HJC - Color personalizado",
        prompt: "Color de #{...} (hex, ejemplo #1F1F1F)",
        value: String(elForegroundCurrent),
        validateInput: (v) => (isHexColor(v) ? null : "Usa formato hex (#RGB, #RRGGBB o #RRGGBBAA).")
    });
    if (elForeground === undefined) {
        return;
    }

    const elBackground = await vscode.window.showInputBox({
        title: "JSF HJC - Color personalizado",
        prompt: "Fondo de #{...} (hex opcional, deja vacio para ninguno)",
        value: String(elBackgroundCurrent),
        validateInput: (v) => (isHexColor(v, true) ? null : "Usa hex o deja vacio.")
    });
    if (elBackground === undefined) {
        return;
    }

    const attrForeground = await vscode.window.showInputBox({
        title: "JSF HJC - Color personalizado",
        prompt: "Color para atributos configurados (id, converter, etc)",
        value: String(attrForegroundCurrent),
        validateInput: (v) => (isHexColor(v) ? null : "Usa formato hex (#RGB, #RRGGBB o #RRGGBBAA).")
    });
    if (attrForeground === undefined) {
        return;
    }

    const attrNamesRaw = await vscode.window.showInputBox({
        title: "JSF HJC - Color personalizado",
        prompt: "Atributos a resaltar (separados por coma)",
        value: Array.isArray(attrNamesCurrent) ? attrNamesCurrent.join(", ") : DEFAULT_ATTR_NAMES.join(", ")
    });
    if (attrNamesRaw === undefined) {
        return;
    }

    const attrNames = attrNamesRaw
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);

    await updateHighlightConfig("foreground", elForeground.trim());
    await updateHighlightConfig("background", elBackground.trim());
    await updateHighlightConfig("attributeHighlight.enabled", true);
    await updateHighlightConfig("attributeHighlight.foreground", attrForeground.trim());
    await updateHighlightConfig("attributeHighlight.names", attrNames.length > 0 ? attrNames : DEFAULT_ATTR_NAMES);
    await updateHighlightConfig("colorProfile", COLOR_PROFILE_CUSTOM);
    await updateHighlightConfig("enabled", true);

    vscode.window.showInformationMessage("JSF HJC: colores personalizados guardados.");
}

function ensureDecorationType() {
    const config = getConfig();

    if (elDecorationType) {
        elDecorationType.dispose();
    }
    elDecorationType = vscode.window.createTextEditorDecorationType(toDecorationStyle(config));

    if (attrDecorationType) {
        attrDecorationType.dispose();
    }
    attrDecorationType = vscode.window.createTextEditorDecorationType({
        color: config.attrForeground
    });
}

function isTargetDocument(document) {
    if (!document) {
        return false;
    }

    const lang = document.languageId;
    if (lang === "html" || lang === "xml") {
        return true;
    }

    const filePath = (document.uri && document.uri.fsPath ? document.uri.fsPath : "").toLowerCase();
    return filePath.endsWith(".xhtml");
}

function computeRanges(document) {
    const text = document.getText();
    const ranges = [];
    EL_REGEX.lastIndex = 0;

    let match = EL_REGEX.exec(text);
    while (match) {
        const start = match.index;
        const end = start + match[0].length;
        ranges.push(new vscode.Range(document.positionAt(start), document.positionAt(end)));
        match = EL_REGEX.exec(text);
    }

    return ranges;
}

function computeAttributeRanges(document, attributeNames) {
    const text = document.getText();
    const names = Array.isArray(attributeNames)
        ? attributeNames.filter((n) => typeof n === "string" && n.trim().length > 0).map((n) => n.trim())
        : [];

    if (names.length === 0) {
        return [];
    }

    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`\\b(?:${escaped.join("|")})\\b(?=\\s*=)`, "g");
    const ranges = [];

    let match = regex.exec(text);
    while (match) {
        const start = match.index;
        const end = start + match[0].length;
        ranges.push(new vscode.Range(document.positionAt(start), document.positionAt(end)));
        match = regex.exec(text);
    }

    return ranges;
}

function computeAttributeValueRanges(document, attributeNames) {
    const text = document.getText();
    const names = Array.isArray(attributeNames)
        ? attributeNames.filter((n) => typeof n === "string" && n.trim().length > 0).map((n) => n.trim())
        : [];

    if (names.length === 0) {
        return [];
    }

    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`\\b(?:${escaped.join("|")})\\b\\s*=\\s*(['"])(.*?)\\1`, "g");
    const ranges = [];

    let match = regex.exec(text);
    while (match) {
        // Highlight only the text inside quotes, not the quotes themselves.
        const fullStart = match.index;
        const fullMatch = match[0];
        const quoteChar = match[1];
        const quoteOffset = fullMatch.indexOf(quoteChar);
        const valueText = match[2];
        const valueStart = fullStart + quoteOffset + 1;
        const valueEnd = valueStart + valueText.length;

        if (valueEnd > valueStart) {
            ranges.push(new vscode.Range(document.positionAt(valueStart), document.positionAt(valueEnd)));
        }

        match = regex.exec(text);
    }

    return ranges;
}

function clearEditor(editor) {
    if (!editor) {
        return;
    }
    if (elDecorationType) {
        editor.setDecorations(elDecorationType, []);
    }
    if (attrDecorationType) {
        editor.setDecorations(attrDecorationType, []);
    }
}

function refreshEditor(editor) {
    if (!editor || !elDecorationType || !attrDecorationType) {
        return;
    }

    const config = getConfig();
    if (!config.enabled || !isTargetDocument(editor.document)) {
        clearEditor(editor);
        return;
    }

    const ranges = computeRanges(editor.document);
    editor.setDecorations(elDecorationType, ranges);

    if (config.attrEnabled) {
        const attrRanges = computeAttributeRanges(editor.document, config.attrNames);
        const attrValueRanges = computeAttributeValueRanges(editor.document, config.attrNames);
        editor.setDecorations(attrDecorationType, attrRanges.concat(attrValueRanges));
    } else {
        editor.setDecorations(attrDecorationType, []);
    }
}

function refreshAllEditors() {
    for (const editor of vscode.window.visibleTextEditors) {
        refreshEditor(editor);
    }
}

function invalidateBeanCache() {
    beanIndexCache.clear();
    beanMemberCache.clear();
    javaClassIndexCache.clear();
}

function getClassName(content) {
    const match = content.match(CLASS_REGEX);
    return match ? match[1] : null;
}

function toDefaultBeanName(className) {
    if (!className || className.length === 0) {
        return className;
    }
    if (className.length === 1) {
        return className.toLowerCase();
    }
    return className[0].toLowerCase() + className.slice(1);
}

function getBeanNames(content, className) {
    const names = [];

    const namedExplicit = /@Named\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/g;
    let match = namedExplicit.exec(content);
    while (match) {
        names.push(match[1]);
        match = namedExplicit.exec(content);
    }

    const managedExplicit = /@ManagedBean\s*\(\s*(?:name\s*=\s*)?["']([^"']+)["']\s*\)/g;
    match = managedExplicit.exec(content);
    while (match) {
        names.push(match[1]);
        match = managedExplicit.exec(content);
    }

    const hasNamed = /@Named\b/.test(content);
    const hasManaged = /@ManagedBean\b/.test(content);
    if ((hasNamed || hasManaged) && className) {
        names.push(toDefaultBeanName(className));
    }

    // Remove duplicates while preserving order.
    return [...new Set(names)];
}

function collectJavaFiles(rootDir) {
    if (!fs.existsSync(rootDir)) {
        return [];
    }

    const files = [];
    const stack = [rootDir];

    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith(JAVA_EXT)) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

function buildBeanIndex(workspacePath, javaRootRelative) {
    const javaRoot = path.join(workspacePath, javaRootRelative);
    const index = new Map();

    if (!fs.existsSync(javaRoot)) {
        return index;
    }

    const javaFiles = collectJavaFiles(javaRoot);
    for (const filePath of javaFiles) {
        let content = "";
        try {
            content = fs.readFileSync(filePath, "utf8");
        } catch {
            continue;
        }

        const className = getClassName(content);
        const beanNames = getBeanNames(content, className);
        if (beanNames.length === 0) {
            continue;
        }

        for (const beanName of beanNames) {
            const key = beanName.toLowerCase();
            if (!index.has(key)) {
                index.set(key, []);
            }
            index.get(key).push({
                beanName,
                className: className || path.basename(filePath, JAVA_EXT),
                filePath
            });
        }
    }

    return index;
}

function findNestedJavaRootRelative(workspacePath) {
    let entries = [];
    try {
        entries = fs.readdirSync(workspacePath, { withFileTypes: true });
    } catch {
        return null;
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const candidate = path.join(entry.name, DEFAULT_JAVA_ROOT_RELATIVE);
        if (fs.existsSync(path.join(workspacePath, candidate))) {
            return candidate;
        }
    }

    return null;
}

function resolveJavaRootRelative(workspacePath, configuredJavaRootRelative) {
    const configured = typeof configuredJavaRootRelative === "string" && configuredJavaRootRelative.trim().length > 0
        ? configuredJavaRootRelative.trim()
        : DEFAULT_JAVA_ROOT_RELATIVE;
    const candidates = [configured];

    // Keep compatibility with multimodule projects when default root is used.
    if (configured.toLowerCase() === DEFAULT_JAVA_ROOT_RELATIVE.toLowerCase()) {
        const nested = findNestedJavaRootRelative(workspacePath);
        if (nested) {
            candidates.push(nested);
        }
    }

    for (const candidate of candidates) {
        if (fs.existsSync(path.join(workspacePath, candidate))) {
            return candidate;
        }
    }

    return configured;
}

function getResolvedWorkspaceJavaRootInfo(document, config) {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) {
        return null;
    }

    const workspacePath = folder.uri.fsPath;
    const resolvedJavaRootRelative = resolveJavaRootRelative(workspacePath, config.hoverJavaRootRelative);
    return {
        workspacePath,
        resolvedJavaRootRelative,
        javaRootPath: path.join(workspacePath, resolvedJavaRootRelative)
    };
}

function buildJavaClassIndex(workspacePath, javaRootRelative) {
    const javaRoot = path.join(workspacePath, javaRootRelative);
    const index = new Map();

    if (!fs.existsSync(javaRoot)) {
        return index;
    }

    const javaFiles = collectJavaFiles(javaRoot);
    for (const filePath of javaFiles) {
        let className = path.basename(filePath, JAVA_EXT);
        try {
            const content = fs.readFileSync(filePath, "utf8");
            className = getClassName(content) || className;
        } catch {
            // Keep filename fallback.
        }

        const key = String(className).toLowerCase();
        if (!index.has(key)) {
            index.set(key, []);
        }
        index.get(key).push(filePath);
    }

    return index;
}

function getJavaClassIndexForDocument(document, config) {
    const info = getResolvedWorkspaceJavaRootInfo(document, config);
    if (!info) {
        return new Map();
    }

    const cacheKey = `${info.workspacePath}|${info.resolvedJavaRootRelative}`;
    const now = Date.now();
    const cached = javaClassIndexCache.get(cacheKey);
    if (cached && (now - cached.timestamp) <= config.hoverCacheMs) {
        return cached.index;
    }

    const index = buildJavaClassIndex(info.workspacePath, info.resolvedJavaRootRelative);
    javaClassIndexCache.set(cacheKey, { timestamp: now, index });
    return index;
}

function stripJavaTypeDecorators(typeText) {
    if (!typeText) {
        return "";
    }

    let text = String(typeText)
        .replace(/@\w+(?:\([^)]*\))?\s*/g, " ")
        .replace(/\b(?:public|protected|private|static|final|abstract|native|synchronized|transient|volatile)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Remove generic method prefix like "<T extends Foo>"
    if (text.startsWith("<")) {
        let depth = 0;
        let cut = -1;
        for (let i = 0; i < text.length; i += 1) {
            const ch = text[i];
            if (ch === "<") {
                depth += 1;
            } else if (ch === ">") {
                depth -= 1;
                if (depth === 0) {
                    cut = i + 1;
                    break;
                }
            }
        }
        if (cut > 0) {
            text = text.slice(cut).trim();
        }
    }

    return text;
}

function splitTopLevelGenericArgs(typeText) {
    const text = stripJavaTypeDecorators(typeText);
    const start = text.indexOf("<");
    if (start < 0) {
        return [];
    }

    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === "<") {
            depth += 1;
        } else if (ch === ">") {
            depth -= 1;
            if (depth === 0) {
                end = i;
                break;
            }
        }
    }

    if (end < 0) {
        return [];
    }

    const inside = text.slice(start + 1, end).trim();
    if (!inside) {
        return [];
    }

    const args = [];
    let current = "";
    depth = 0;
    for (let i = 0; i < inside.length; i += 1) {
        const ch = inside[i];
        if (ch === "<") {
            depth += 1;
            current += ch;
        } else if (ch === ">") {
            depth -= 1;
            current += ch;
        } else if (ch === "," && depth === 0) {
            if (current.trim()) {
                args.push(current.trim());
            }
            current = "";
        } else {
            current += ch;
        }
    }
    if (current.trim()) {
        args.push(current.trim());
    }

    return args;
}

function normalizeJavaTypeName(typeText) {
    if (!typeText) {
        return null;
    }

    let text = stripJavaTypeDecorators(typeText);
    if (!text) {
        return null;
    }

    text = text.replace(/\[\]/g, "").trim();

    if (text.startsWith("?")) {
        text = text
            .replace(/^\?\s*(?:extends|super)\s+/, "")
            .trim();
    }

    // Remove generic section, preserving outer type.
    const genericStart = text.indexOf("<");
    if (genericStart >= 0) {
        text = text.slice(0, genericStart).trim();
    }

    if (!text) {
        return null;
    }

    return text;
}

function getSimpleTypeName(typeName) {
    if (!typeName) {
        return null;
    }
    const normalized = String(typeName).trim();
    if (!normalized) {
        return null;
    }
    const lastDot = normalized.lastIndexOf(".");
    return lastDot >= 0 ? normalized.slice(lastDot + 1) : normalized;
}

function isJavaCollectionLikeType(typeName) {
    const simple = getSimpleTypeName(typeName);
    if (!simple) {
        return false;
    }
    return [
        "List",
        "ArrayList",
        "LinkedList",
        "Set",
        "HashSet",
        "LinkedHashSet",
        "Collection",
        "Iterable",
        "Page",
        "DataModel",
        "Stream"
    ].includes(simple);
}

function getJavaTypeInfo(typeText) {
    const normalizedType = normalizeJavaTypeName(typeText);
    const genericArgs = splitTopLevelGenericArgs(typeText);
    let elementType = null;

    if (String(typeText || "").includes("[]")) {
        elementType = normalizeJavaTypeName(typeText);
    } else if (normalizedType && isJavaCollectionLikeType(normalizedType) && genericArgs.length > 0) {
        elementType = normalizeJavaTypeName(genericArgs[0]);
    }

    return {
        typeText: stripJavaTypeDecorators(typeText),
        normalizedType,
        simpleTypeName: getSimpleTypeName(normalizedType),
        elementTypeText: elementType,
        elementSimpleTypeName: getSimpleTypeName(elementType)
    };
}

function isBuiltinJavaType(typeName) {
    const simple = getSimpleTypeName(typeName);
    if (!simple) {
        return true;
    }

    if ([
        "void",
        "boolean",
        "byte",
        "short",
        "int",
        "long",
        "float",
        "double",
        "char",
        "Boolean",
        "Byte",
        "Short",
        "Integer",
        "Long",
        "Float",
        "Double",
        "Character",
        "String",
        "Object",
        "BigDecimal",
        "BigInteger",
        "Date",
        "LocalDate",
        "LocalDateTime",
        "LocalTime",
        "OffsetDateTime",
        "ZonedDateTime",
        "Instant",
        "UUID"
    ].includes(simple)) {
        return true;
    }

    const normalized = normalizeJavaTypeName(typeName);
    return Boolean(normalized && normalized.startsWith("java."));
}

function findJavaClassFileByType(document, config, typeText) {
    const typeInfo = getJavaTypeInfo(typeText);
    const normalized = typeInfo.normalizedType;
    const simple = typeInfo.simpleTypeName;
    if (!normalized || !simple || isBuiltinJavaType(normalized)) {
        return null;
    }

    const info = getResolvedWorkspaceJavaRootInfo(document, config);
    if (!info) {
        return null;
    }

    const classIndex = getJavaClassIndexForDocument(document, config);
    const candidates = (classIndex.get(simple.toLowerCase()) || []).slice();
    if (candidates.length === 0) {
        return null;
    }

    if (normalized.includes(".")) {
        const relativeSuffix = normalized.split(".").join(path.sep) + JAVA_EXT;
        const exact = candidates.find((filePath) =>
            filePath.toLowerCase().endsWith(relativeSuffix.toLowerCase())
        );
        if (exact) {
            return exact;
        }
    }

    candidates.sort((a, b) => a.length - b.length);
    return candidates[0] || null;
}

function findMemberInfoByName(filePath, memberName) {
    if (!filePath || !memberName) {
        return null;
    }

    const normalizedName = String(memberName).replace(/\(\)$/, "");
    const members = getBeanMembersForFile(filePath);
    if (!Array.isArray(members) || members.length === 0) {
        return null;
    }

    let exactProperty = null;
    let exactField = null;
    let exactMethod = null;

    for (const member of members) {
        if (member.label !== normalizedName) {
            continue;
        }
        if (member.kind === "property" && !exactProperty) {
            exactProperty = member;
        } else if (member.kind === "field" && !exactField) {
            exactField = member;
        } else if (member.kind === "method" && !exactMethod) {
            exactMethod = member;
        }
    }

    return exactProperty || exactField || exactMethod || null;
}

function parseSimpleElPathSegments(expressionText) {
    if (!expressionText) {
        return null;
    }

    const raw = String(expressionText).trim().replace(/^#\{/, "").replace(/\}$/, "");
    if (!raw) {
        return null;
    }

    const segments = raw.split(".").map((part) => part.trim()).filter((part) => part.length > 0);
    if (segments.length === 0) {
        return null;
    }

    for (const segment of segments) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\(\))?$/.test(segment)) {
            return null;
        }
    }

    return segments;
}

function resolveElPathToJavaTypeTarget(document, config, pathSegments, options = {}) {
    if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
        return null;
    }

    const rootName = String(pathSegments[0]).replace(/\(\)$/, "");
    const rootEntries = getBeanEntriesForName(document, rootName, config);
    if (rootEntries.length === 0) {
        return null;
    }

    let currentFilePath = rootEntries[0].filePath;
    let currentClassName = rootEntries[0].className;

    for (let i = 1; i < pathSegments.length; i += 1) {
        const segmentName = String(pathSegments[i]).replace(/\(\)$/, "");
        const memberInfo = findMemberInfoByName(currentFilePath, segmentName);
        if (!memberInfo) {
            return null;
        }

        const useElementType = Boolean(options.useElementTypeOnFinalSegment && i === pathSegments.length - 1);
        const nextTypeText = useElementType
            ? (memberInfo.elementTypeText || memberInfo.typeText)
            : memberInfo.typeText;

        if (!nextTypeText) {
            return null;
        }

        const nextFilePath = findJavaClassFileByType(document, config, nextTypeText);
        if (!nextFilePath) {
            return null;
        }

        currentFilePath = nextFilePath;
        currentClassName = path.basename(nextFilePath, JAVA_EXT);
    }

    return {
        filePath: currentFilePath,
        className: currentClassName || path.basename(currentFilePath, JAVA_EXT)
    };
}

function findTagEndIndex(text, startIndex) {
    let quote = null;
    for (let i = startIndex; i < text.length; i += 1) {
        const ch = text[i];
        if (quote) {
            if (ch === quote) {
                quote = null;
            }
            continue;
        }
        if (ch === "\"" || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === ">") {
            return i;
        }
    }
    return -1;
}

function parseTagAttributes(tagText) {
    const attrs = new Map();
    const tagNameMatch = tagText.match(/^<\s*([A-Za-z_][A-Za-z0-9_:\-.]*)/);
    const tagName = tagNameMatch ? tagNameMatch[1] : null;

    const attrRegex = /\b([A-Za-z_][A-Za-z0-9_:\-.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let match = attrRegex.exec(tagText);
    while (match) {
        attrs.set(match[1], match[2] !== undefined ? match[2] : match[3]);
        match = attrRegex.exec(tagText);
    }

    return { tagName, attrs };
}

function getLocalVarBindingsBeforeOffset(document, offset) {
    const text = document.getText().slice(0, Math.max(offset, 0));
    const bindings = new Map();

    let index = 0;
    while (index < text.length) {
        const start = text.indexOf("<", index);
        if (start < 0) {
            break;
        }

        const nextChar = text[start + 1];
        if (nextChar === "/" || nextChar === "!" || nextChar === "?") {
            index = start + 1;
            continue;
        }

        const end = findTagEndIndex(text, start + 1);
        if (end < 0) {
            break;
        }

        const tagText = text.slice(start, end + 1);
        const parsedTag = parseTagAttributes(tagText);
        const varName = parsedTag.attrs.get("var");
        const valueAttr = parsedTag.attrs.get("value");
        if (typeof varName === "string" && typeof valueAttr === "string") {
            const varTrimmed = varName.trim();
            const valueTrimmed = valueAttr.trim();
            const elMatch = valueTrimmed.match(/^#\{\s*([^}]+?)\s*\}$/);
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(varTrimmed) && elMatch) {
                bindings.set(varTrimmed, {
                    varName: varTrimmed,
                    valueExpression: elMatch[1].trim(),
                    tagName: parsedTag.tagName || null
                });
            }
        }

        index = end + 1;
    }

    return bindings;
}

function resolveLocalVarTypeTarget(document, config, localVarName, offset) {
    const bindings = getLocalVarBindingsBeforeOffset(document, offset);
    const binding = bindings.get(localVarName);
    if (!binding) {
        return null;
    }

    const pathSegments = parseSimpleElPathSegments(binding.valueExpression);
    if (!pathSegments || pathSegments.length === 0) {
        return null;
    }

    return resolveElPathToJavaTypeTarget(document, config, pathSegments, { useElementTypeOnFinalSegment: true });
}

function resolveCompletionRootTypeTarget(document, config, rootIdentifier, offset) {
    if (!rootIdentifier) {
        return null;
    }

    // EL local vars (ui:repeat / p:dataTable var="x") should shadow managed beans.
    const localTarget = resolveLocalVarTypeTarget(document, config, rootIdentifier, offset);
    if (localTarget) {
        return localTarget;
    }

    const beanEntries = getBeanEntriesForName(document, rootIdentifier, config);
    if (beanEntries.length === 0) {
        return null;
    }

    return {
        filePath: beanEntries[0].filePath,
        className: beanEntries[0].className
    };
}

function getJsfTagMeta(tagName) {
    if (typeof tagName !== "string") {
        return null;
    }

    const parts = tagName.split(":");
    if (parts.length !== 2) {
        return null;
    }

    const [prefix, localName] = parts;
    const lib = JSF_COMPLETION_LIBRARIES[prefix];
    if (!lib) {
        return null;
    }

    const tag = lib.tags[localName];
    if (!tag) {
        return null;
    }

    return {
        prefix,
        localName,
        fullName: `${prefix}:${localName}`,
        lib,
        tag
    };
}

function getAllJsfTagMetaEntries() {
    const entries = [];
    for (const [prefix, lib] of Object.entries(JSF_COMPLETION_LIBRARIES)) {
        for (const [localName, tag] of Object.entries(lib.tags)) {
            entries.push({
                prefix,
                localName,
                fullName: `${prefix}:${localName}`,
                lib,
                tag
            });
        }
    }
    return entries;
}

function getUnclosedQuoteInfo(text) {
    let openQuote = null;
    let openQuoteIndex = -1;

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (openQuote) {
            if (ch === openQuote) {
                openQuote = null;
                openQuoteIndex = -1;
            }
            continue;
        }

        if (ch === "\"" || ch === "'") {
            openQuote = ch;
            openQuoteIndex = i;
        }
    }

    return openQuote ? { quote: openQuote, quoteStartIndex: openQuoteIndex } : null;
}

function extractJsfMarkupCompletionContext(document, position) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const searchOffset = Math.max(offset - 1, 0);
    const lastOpen = text.lastIndexOf("<", searchOffset);
    if (lastOpen < 0) {
        return null;
    }

    const lastClose = text.lastIndexOf(">", searchOffset);
    if (lastClose > lastOpen) {
        return null;
    }

    const tagPrefix = text.slice(lastOpen, offset);
    if (!tagPrefix.startsWith("<")) {
        return null;
    }
    if (tagPrefix.startsWith("<!--") || /^<\s*(?:!|\?)/.test(tagPrefix)) {
        return null;
    }

    const quoteInfo = getUnclosedQuoteInfo(tagPrefix);
    const tagNameMatch = tagPrefix.match(/^<\s*\/?\s*([A-Za-z_][A-Za-z0-9_:\-.]*)?/);
    const parsedTagName = tagNameMatch && tagNameMatch[1] ? tagNameMatch[1] : null;

    if (quoteInfo) {
        const beforeQuote = tagPrefix.slice(0, quoteInfo.quoteStartIndex);
        const valuePrefix = tagPrefix.slice(quoteInfo.quoteStartIndex + 1);
        const attrMatch = beforeQuote.match(/([A-Za-z_][A-Za-z0-9_:\-.]*)\s*=\s*$/);
        if (!attrMatch || !parsedTagName || tagPrefix.startsWith("</")) {
            return null;
        }

        return {
            kind: "attrValue",
            tagName: parsedTagName,
            attrName: attrMatch[1],
            valuePrefix,
            replaceRange: new vscode.Range(
                document.positionAt(lastOpen + quoteInfo.quoteStartIndex + 1),
                position
            )
        };
    }

    const tagNameCtxMatch = tagPrefix.match(/^<\s*\/?\s*([A-Za-z_][A-Za-z0-9_:\-.]*)?$/);
    if (tagNameCtxMatch) {
        const namePrefix = tagNameCtxMatch[1] || "";
        return {
            kind: "tagName",
            namePrefix,
            replaceRange: new vscode.Range(
                document.positionAt(offset - namePrefix.length),
                position
            )
        };
    }

    if (tagPrefix.startsWith("</") || !parsedTagName) {
        return null;
    }

    if (/=\s*$/.test(tagPrefix)) {
        return null;
    }

    const attrPrefixMatch = tagPrefix.match(/(?:\s+)([A-Za-z_][A-Za-z0-9_:\-.]*)?$/);
    if (!attrPrefixMatch) {
        return null;
    }

    const attrPrefix = attrPrefixMatch[1] || "";
    const parsedAttrs = parseTagAttributes(`${tagPrefix}>`);
    const existingAttrs = new Set(
        [...parsedAttrs.attrs.keys()].map((name) => String(name).toLowerCase())
    );

    return {
        kind: "attrName",
        tagName: parsedTagName,
        attrPrefix,
        existingAttrs,
        replaceRange: new vscode.Range(
            document.positionAt(offset - attrPrefix.length),
            position
        )
    };
}

function buildJsfTagCompletionItems(markupContext) {
    const prefixText = String(markupContext.namePrefix || "").toLowerCase();
    const items = [];

    for (const entry of getAllJsfTagMetaEntries()) {
        const fullLower = entry.fullName.toLowerCase();
        const localLower = entry.localName.toLowerCase();
        const prefixLower = entry.prefix.toLowerCase();

        if (prefixText) {
            const matches = fullLower.startsWith(prefixText) ||
                localLower.startsWith(prefixText) ||
                `${prefixLower}:`.startsWith(prefixText);
            if (!matches) {
                continue;
            }
        }

        const item = new vscode.CompletionItem(entry.fullName, vscode.CompletionItemKind.Module);
        item.detail = `${entry.lib.label} tag`;
        if (Array.isArray(entry.tag.attrs) && entry.tag.attrs.length > 0) {
            const preview = entry.tag.attrs.slice(0, 6).join(", ");
            item.documentation = `Attrs: ${preview}${entry.tag.attrs.length > 6 ? ", ..." : ""}`;
        }
        item.insertText = entry.fullName;
        item.range = markupContext.replaceRange;
        item.commitCharacters = [" ", ">", "/"];
        items.push(item);
    }

    items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return items;
}

function getJsfTagAttributeNames(tagName) {
    const meta = getJsfTagMeta(tagName);
    if (meta) {
        return Array.isArray(meta.tag.attrs) ? meta.tag.attrs : [];
    }

    if (typeof tagName === "string" && tagName.includes(":")) {
        const prefix = tagName.split(":")[0];
        if (Object.prototype.hasOwnProperty.call(JSF_COMPLETION_LIBRARIES, prefix)) {
            return ["id", "rendered", "style", "styleClass"];
        }
    }

    return [];
}

function createAttrInsertSnippet(attrNameLower, attrName) {
    if (JSF_BOOLEAN_ATTRIBUTES.has(attrNameLower)) {
        return new vscode.SnippetString(`${attrName}="\${1|true,false|}"`);
    }

    if (JSF_EL_ATTRIBUTE_HINTS.has(attrNameLower)) {
        if (attrNameLower === "action" || attrNameLower === "actionlistener" || attrNameLower === "listener") {
            return new vscode.SnippetString(`${attrName}="#{\${1:bean}.\${2:method}}"`);
        }
        if (attrNameLower === "rendered") {
            return new vscode.SnippetString(`${attrName}="#{not empty \${1:bean.value}}"`);
        }
        return new vscode.SnippetString(`${attrName}="#{\${1}}"`);
    }

    if (attrNameLower === "update" || attrNameLower === "process" || attrNameLower === "render" || attrNameLower === "execute") {
        return new vscode.SnippetString(`${attrName}="\${1:@form}"`);
    }

    return new vscode.SnippetString(`${attrName}="\${1}"`);
}

function buildJsfAttributeNameCompletionItems(markupContext) {
    const tagName = String(markupContext.tagName || "");
    const attrPrefix = String(markupContext.attrPrefix || "").toLowerCase();
    const currentAttrKey = String(markupContext.attrPrefix || "").toLowerCase();
    const existingAttrs = markupContext.existingAttrs || new Set();
    const items = [];

    for (const attrName of getJsfTagAttributeNames(tagName)) {
        const attrKey = String(attrName).toLowerCase();
        if (attrPrefix && !attrKey.startsWith(attrPrefix)) {
            continue;
        }
        if (existingAttrs.has(attrKey) && attrKey !== currentAttrKey) {
            continue;
        }

        const item = new vscode.CompletionItem(attrName, vscode.CompletionItemKind.Property);
        item.detail = `${tagName} attribute`;
        item.insertText = createAttrInsertSnippet(attrKey, attrName);
        item.range = markupContext.replaceRange;
        item.commitCharacters = ["="];
        items.push(item);
    }

    items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return items;
}

function addAttrValueCompletionItem(items, seen, label, kind, insertText, range, detail) {
    const key = String(label).toLowerCase();
    if (seen.has(key)) {
        return;
    }
    seen.add(key);

    const item = new vscode.CompletionItem(label, kind);
    item.insertText = insertText;
    item.range = range;
    if (detail) {
        item.detail = detail;
    }
    items.push(item);
}

function buildJsfAttributeValueCompletionItems(markupContext) {
    const tagName = String(markupContext.tagName || "");
    const attrName = String(markupContext.attrName || "");
    const attrLower = attrName.toLowerCase();
    const valuePrefix = String(markupContext.valuePrefix || "").toLowerCase();
    const enumValues = JSF_ATTRIBUTE_VALUE_OPTIONS[`${tagName}.${attrName}`] || [];

    const items = [];
    const seen = new Set();

    function matchesPrefix(label) {
        return !valuePrefix || String(label).toLowerCase().startsWith(valuePrefix);
    }

    for (const value of enumValues) {
        if (!matchesPrefix(value)) {
            continue;
        }
        addAttrValueCompletionItem(
            items,
            seen,
            value,
            vscode.CompletionItemKind.EnumMember,
            value,
            markupContext.replaceRange,
            `${tagName} ${attrName}`
        );
    }

    if (JSF_BOOLEAN_ATTRIBUTES.has(attrLower)) {
        for (const value of ["true", "false"]) {
            if (!matchesPrefix(value)) {
                continue;
            }
            addAttrValueCompletionItem(
                items,
                seen,
                value,
                vscode.CompletionItemKind.Value,
                value,
                markupContext.replaceRange,
                "Boolean value"
            );
        }
    }

    if (attrLower === "update" || attrLower === "process" || attrLower === "render" || attrLower === "execute") {
        for (const value of JSF_CLIENT_ID_KEYWORDS) {
            if (!matchesPrefix(value)) {
                continue;
            }
            addAttrValueCompletionItem(
                items,
                seen,
                value,
                vscode.CompletionItemKind.Keyword,
                value,
                markupContext.replaceRange,
                "JSF client id keyword"
            );
        }
    }

    if (attrLower === "var") {
        for (const value of ["item", "row", "it"]) {
            if (!matchesPrefix(value)) {
                continue;
            }
            addAttrValueCompletionItem(
                items,
                seen,
                value,
                vscode.CompletionItemKind.Variable,
                value,
                markupContext.replaceRange,
                "Loop row variable"
            );
        }
    }

    if (JSF_EL_ATTRIBUTE_HINTS.has(attrLower)) {
        const snippets = [];
        if (attrLower === "action" || attrLower === "actionlistener" || attrLower === "listener") {
            snippets.push({
                label: "#{bean.method}",
                insertText: new vscode.SnippetString(`#{\${1:bean}.\${2:method}}`),
                detail: "EL method expression"
            });
        } else if (attrLower === "rendered") {
            snippets.push({
                label: "#{not empty ...}",
                insertText: new vscode.SnippetString(`#{not empty \${1:bean.value}}`),
                detail: "EL rendered condition"
            });
            snippets.push({
                label: "#{...}",
                insertText: new vscode.SnippetString(`#{\${1}}`),
                detail: "EL expression"
            });
        } else {
            snippets.push({
                label: "#{...}",
                insertText: new vscode.SnippetString(`#{\${1}}`),
                detail: "EL expression"
            });
        }

        for (const snippet of snippets) {
            if (!matchesPrefix(snippet.label) && !(valuePrefix === "#" && snippet.label.startsWith("#"))) {
                continue;
            }
            addAttrValueCompletionItem(
                items,
                seen,
                snippet.label,
                vscode.CompletionItemKind.Snippet,
                snippet.insertText,
                markupContext.replaceRange,
                snippet.detail
            );
        }
    }

    if (items.length === 0 && (!valuePrefix || "#".startsWith(valuePrefix))) {
        addAttrValueCompletionItem(
            items,
            seen,
            "#{...}",
            vscode.CompletionItemKind.Snippet,
            new vscode.SnippetString(`#{\${1}}`),
            markupContext.replaceRange,
            "EL expression"
        );
    }

    return items;
}

function buildJsfMarkupCompletionItems(document, position) {
    const markupContext = extractJsfMarkupCompletionContext(document, position);
    if (!markupContext) {
        return [];
    }

    if (markupContext.kind === "tagName") {
        return buildJsfTagCompletionItems(markupContext);
    }
    if (markupContext.kind === "attrName") {
        return buildJsfAttributeNameCompletionItems(markupContext);
    }
    if (markupContext.kind === "attrValue") {
        return buildJsfAttributeValueCompletionItems(markupContext);
    }

    return [];
}

function getBeanEntriesForName(document, beanName, config) {
    if (!beanName) {
        return [];
    }

    const index = getBeanIndexForDocument(document, config);
    const entries = (index.get(String(beanName).toLowerCase()) || []).slice();
    entries.sort((a, b) => a.filePath.length - b.filePath.length);
    return entries;
}

function toPropertyNameFromAccessor(methodName) {
    if (/^get[A-Z]/.test(methodName) && methodName.length > 3) {
        return methodName[3].toLowerCase() + methodName.slice(4);
    }
    if (/^is[A-Z]/.test(methodName) && methodName.length > 2) {
        return methodName[2].toLowerCase() + methodName.slice(3);
    }
    return null;
}

function getBeanMembersForFile(filePath) {
    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch {
        return [];
    }

    const cacheKey = `${filePath}|${stat.mtimeMs}`;
    const cached = beanMemberCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    let content = "";
    try {
        content = fs.readFileSync(filePath, "utf8");
    } catch {
        return [];
    }

    const className = getClassName(content);
    const members = [];
    const seen = new Set();

    function addMember(member) {
        const key = `${member.kind}|${member.label}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        members.push(member);
    }

    const methodRegex = /^\s*(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:native\s+)?(?:abstract\s+)?(?:<[^>{}\n]+>\s*)?([\w$<>\[\],.?@ ]+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:throws[^{;\n]+)?\s*\{/gm;
    let methodMatch = methodRegex.exec(content);
    while (methodMatch) {
        const returnTypeText = (methodMatch[1] || "").trim();
        const methodName = methodMatch[2];
        const paramsRaw = (methodMatch[3] || "").trim();
        const hasParams = paramsRaw.length > 0;
        const methodTypeInfo = getJavaTypeInfo(returnTypeText);

        if (className && methodName === className) {
            methodMatch = methodRegex.exec(content);
            continue;
        }

        if (methodName !== "hashCode" && methodName !== "toString" && methodName !== "equals") {
            addMember({
                label: methodName,
                kind: "method",
                insertText: hasParams ? methodName : `${methodName}()`,
                detail: hasParams ? "Java method (params)" : "Java method",
                typeText: methodTypeInfo.typeText || returnTypeText || null,
                elementTypeText: methodTypeInfo.elementTypeText || null
            });
        }

        if (!hasParams) {
            const propertyName = toPropertyNameFromAccessor(methodName);
            if (propertyName) {
                addMember({
                    label: propertyName,
                    kind: "property",
                    insertText: propertyName,
                    detail: `Property from ${methodName}()`,
                    typeText: methodTypeInfo.typeText || returnTypeText || null,
                    elementTypeText: methodTypeInfo.elementTypeText || null
                });
            }
        }

        methodMatch = methodRegex.exec(content);
    }

    const fieldRegex = /^\s*(?:public|protected)\s+(?:static\s+)?(?:final\s+)?([\w$<>\[\],.?@ ]+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=[^;]*)?;/gm;
    let fieldMatch = fieldRegex.exec(content);
    while (fieldMatch) {
        const fieldTypeText = (fieldMatch[1] || "").trim();
        const fieldName = fieldMatch[2];
        const fieldTypeInfo = getJavaTypeInfo(fieldTypeText);
        addMember({
            label: fieldName,
            kind: "field",
            insertText: fieldName,
            detail: "Java field",
            typeText: fieldTypeInfo.typeText || fieldTypeText || null,
            elementTypeText: fieldTypeInfo.elementTypeText || null
        });
        fieldMatch = fieldRegex.exec(content);
    }

    beanMemberCache.set(cacheKey, members);
    return members;
}

function stripElCallSuffix(segment) {
    return String(segment || "").replace(/\(\)$/, "");
}

function extractElCompletionContext(document, position) {
    const lineText = document.lineAt(position.line).text;
    const linePrefix = lineText.slice(0, position.character);
    const openIndex = linePrefix.lastIndexOf("#{");
    if (openIndex < 0) {
        return null;
    }

    const closeIndex = linePrefix.lastIndexOf("}");
    if (closeIndex > openIndex) {
        return null;
    }

    const exprPrefix = linePrefix.slice(openIndex + 2);
    if (exprPrefix.length === 0) {
        return {
            mode: "root",
            rootPrefix: "",
            replaceRange: new vscode.Range(position, position)
        };
    }

    if (!/^[A-Za-z0-9_$.()]*$/.test(exprPrefix)) {
        return null;
    }

    const rawSegments = exprPrefix.split(".");
    if (rawSegments.length === 0) {
        return null;
    }

    for (let i = 0; i < rawSegments.length; i += 1) {
        const segment = rawSegments[i];
        const isLast = i === rawSegments.length - 1;
        if (segment.length === 0) {
            if (!isLast) {
                return null;
            }
            continue;
        }
        if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\(\))?$/.test(segment)) {
            return null;
        }
    }

    const elStartChar = openIndex + 2;
    if (rawSegments.length === 1) {
        const rootPrefix = rawSegments[0];
        if (rootPrefix.includes("(")) {
            return null;
        }
        return {
            mode: "root",
            rootPrefix,
            replaceRange: new vscode.Range(
                new vscode.Position(position.line, elStartChar),
                position
            )
        };
    }

    const rootIdentifier = stripElCallSuffix(rawSegments[0]);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(rootIdentifier)) {
        return null;
    }

    const currentSegmentRaw = rawSegments[rawSegments.length - 1];
    const memberPrefix = stripElCallSuffix(currentSegmentRaw);
    if (currentSegmentRaw.includes("(") && !currentSegmentRaw.endsWith("()")) {
        return null;
    }

    const chainSegments = rawSegments.slice(1, -1).map(stripElCallSuffix);
    if (chainSegments.some((segment) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment))) {
        return null;
    }

    const lastDotIndex = exprPrefix.lastIndexOf(".");
    const memberStartChar = elStartChar + lastDotIndex + 1;
    return {
        mode: "path",
        rootIdentifier,
        chainSegments,
        memberPrefix,
        replaceRange: new vscode.Range(
            new vscode.Position(position.line, memberStartChar),
            position
        )
    };
}

function buildRootCompletionItems(document, config, completionContext, offset) {
    const prefix = String(completionContext.rootPrefix || "").toLowerCase();
    const items = [];
    const seen = new Set();

    const localBindings = getLocalVarBindingsBeforeOffset(document, offset);
    for (const binding of localBindings.values()) {
        const label = binding.varName;
        const key = label.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        if (prefix && !key.startsWith(prefix)) {
            continue;
        }
        seen.add(key);

        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Variable);
        item.detail = `JSF var (${binding.tagName || "tag"})`;
        item.documentation = `#{${binding.valueExpression}}`;
        item.insertText = label;
        item.range = completionContext.replaceRange;
        item.commitCharacters = ["."];
        items.push(item);
    }

    const index = getBeanIndexForDocument(document, config);
    for (const entries of index.values()) {
        for (const entry of entries) {
            const beanLabel = String(entry.beanName || "");
            if (!beanLabel) {
                continue;
            }
            const beanKey = beanLabel.toLowerCase();
            if (seen.has(beanKey)) {
                continue;
            }
            if (prefix && !beanKey.startsWith(prefix)) {
                continue;
            }
            seen.add(beanKey);

            const item = new vscode.CompletionItem(beanLabel, vscode.CompletionItemKind.Variable);
            item.detail = `${entry.className} (JSF bean)`;
            item.documentation = formatPathForWorkspace(document, entry.filePath);
            item.insertText = beanLabel;
            item.range = completionContext.replaceRange;
            item.commitCharacters = ["."];
            items.push(item);
        }
    }

    items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return items;
}

function resolvePathCompletionTarget(document, config, completionContext, offset) {
    const rootTarget = resolveCompletionRootTypeTarget(document, config, completionContext.rootIdentifier, offset);
    if (!rootTarget) {
        return null;
    }

    let currentFilePath = rootTarget.filePath;
    let currentClassName = rootTarget.className || path.basename(rootTarget.filePath, JAVA_EXT);

    for (const segment of completionContext.chainSegments) {
        const memberInfo = findMemberInfoByName(currentFilePath, segment);
        if (!memberInfo || !memberInfo.typeText) {
            return null;
        }

        const nextFilePath = findJavaClassFileByType(document, config, memberInfo.typeText);
        if (!nextFilePath) {
            return null;
        }

        currentFilePath = nextFilePath;
        currentClassName = path.basename(nextFilePath, JAVA_EXT);
    }

    return {
        filePath: currentFilePath,
        className: currentClassName
    };
}

function buildPathMemberCompletionItems(document, config, completionContext, offset) {
    const prefix = String(completionContext.memberPrefix || "").toLowerCase();
    const target = resolvePathCompletionTarget(document, config, completionContext, offset);
    if (!target) {
        return [];
    }

    const items = [];
    const seen = new Set();
    const members = getBeanMembersForFile(target.filePath);
    for (const member of members) {
        const label = String(member.label || "");
        if (!label) {
            continue;
        }
        const labelLower = label.toLowerCase();
        const memberKey = `${member.kind}|${labelLower}`;
        if (seen.has(memberKey)) {
            continue;
        }
        if (prefix && !labelLower.startsWith(prefix)) {
            continue;
        }
        seen.add(memberKey);

        let kind = vscode.CompletionItemKind.Property;
        if (member.kind === "method") {
            kind = vscode.CompletionItemKind.Method;
        } else if (member.kind === "field") {
            kind = vscode.CompletionItemKind.Field;
        }

        const item = new vscode.CompletionItem(label, kind);
        item.detail = `${member.detail} - ${target.className}`;
        item.documentation = formatPathForWorkspace(document, target.filePath);
        item.insertText = member.insertText || label;
        item.range = completionContext.replaceRange;
        items.push(item);
    }

    items.sort((a, b) => {
        if (a.kind !== b.kind) {
            return a.kind - b.kind;
        }
        return String(a.label).localeCompare(String(b.label));
    });
    return items;
}

function getBeanIndexForDocument(document, config) {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) {
        return new Map();
    }

    const workspacePath = folder.uri.fsPath;
    const resolvedJavaRootRelative = resolveJavaRootRelative(workspacePath, config.hoverJavaRootRelative);
    const cacheKey = `${workspacePath}|${resolvedJavaRootRelative}`;
    const now = Date.now();
    const cached = beanIndexCache.get(cacheKey);
    if (cached && (now - cached.timestamp) <= config.hoverCacheMs) {
        return cached.index;
    }

    const index = buildBeanIndex(workspacePath, resolvedJavaRootRelative);
    beanIndexCache.set(cacheKey, { timestamp: now, index });
    return index;
}

function extractElAtPosition(document, position) {
    const text = document.getText();
    const offset = document.offsetAt(position);

    EL_REGEX.lastIndex = 0;
    let match = EL_REGEX.exec(text);
    while (match) {
        const start = match.index;
        const end = start + match[0].length;
        if (offset >= start && offset <= end) {
            return match[0];
        }
        match = EL_REGEX.exec(text);
    }

    return null;
}

function parseExpression(expression) {
    if (!expression) {
        return null;
    }
    const trimmed = expression.trim().replace(/^#\{/, "").replace(/\}$/, "");
    const match = trimmed.match(BEAN_MEMBER_REGEX);
    if (!match) {
        return null;
    }
    return {
        bean: match[1],
        member: match[2]
    };
}

function buildMethodCandidates(member) {
    const base = member || "";
    if (base.length === 0) {
        return [];
    }

    const capitalized = base.length > 1
        ? base[0].toUpperCase() + base.slice(1)
        : base.toUpperCase();

    return [base, `get${capitalized}`, `is${capitalized}`, `set${capitalized}`];
}

function findMethodInFile(filePath, methodNames) {
    let content = "";
    try {
        content = fs.readFileSync(filePath, "utf8");
    } catch {
        return null;
    }

    const lines = content.split(/\r?\n/);
    for (const methodName of methodNames) {
        const escaped = methodName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\s*\\(`);
        for (let i = 0; i < lines.length; i += 1) {
            if (regex.test(lines[i])) {
                return {
                    methodName,
                    line: i + 1
                };
            }
        }
    }

    return null;
}

function resolveBeanMember(document, bean, member, config) {
    const index = getBeanIndexForDocument(document, config);
    const entries = index.get(bean.toLowerCase()) || [];
    if (entries.length === 0) {
        return null;
    }

    const candidates = buildMethodCandidates(member);
    const resolved = entries.map((entry) => {
        const methodMatch = findMethodInFile(entry.filePath, candidates);
        return {
            ...entry,
            methodName: methodMatch ? methodMatch.methodName : null,
            methodLine: methodMatch ? methodMatch.line : null
        };
    });

    resolved.sort((a, b) => {
        const aScore = a.methodLine ? 0 : 1;
        const bScore = b.methodLine ? 0 : 1;
        if (aScore !== bScore) {
            return aScore - bScore;
        }
        return a.filePath.length - b.filePath.length;
    });

    return resolved[0] || null;
}

function formatPathForWorkspace(document, absolutePath) {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) {
        return absolutePath;
    }

    const root = folder.uri.fsPath;
    if (absolutePath.toLowerCase().startsWith(root.toLowerCase())) {
        return absolutePath.slice(root.length + 1);
    }

    return absolutePath;
}

function provideHover(document, position) {
    const config = getConfig();
    if (!config.hoverEnabled || !isTargetDocument(document)) {
        return null;
    }

    const expression = extractElAtPosition(document, position);
    if (!expression) {
        return null;
    }

    const parsed = parseExpression(expression);
    if (!parsed) {
        return null;
    }

    const resolved = resolveBeanMember(document, parsed.bean, parsed.member, config);
    const md = new vscode.MarkdownString();
    md.isTrusted = false;

    md.appendMarkdown(`**JSF HJC**  \n`);
    md.appendMarkdown(`\`${expression}\`  \n\n`);
    md.appendMarkdown(`Bean: \`${parsed.bean}\`  \n`);
    md.appendMarkdown(`Miembro: \`${parsed.member}\`  \n`);

    if (resolved) {
        md.appendMarkdown(`Clase: \`${resolved.className}\`  \n`);
        if (resolved.methodLine) {
            md.appendMarkdown(`Metodo: \`${resolved.methodName}()\` (linea ${resolved.methodLine})  \n`);
        } else {
            md.appendMarkdown(`Metodo: no encontrado en la clase  \n`);
        }
        md.appendMarkdown(`Archivo: \`${formatPathForWorkspace(document, resolved.filePath)}\``);
    } else {
        md.appendMarkdown("Clase bean: no encontrada");
    }

    return new vscode.Hover(md);
}

function provideDefinition(document, position) {
    const config = getConfig();
    if (!config.hoverEnabled || !isTargetDocument(document)) {
        return null;
    }

    const expression = extractElAtPosition(document, position);
    if (!expression) {
        return null;
    }

    const parsed = parseExpression(expression);
    if (!parsed) {
        return null;
    }

    const resolved = resolveBeanMember(document, parsed.bean, parsed.member, config);
    if (!resolved) {
        return null;
    }

    const targetLine = resolved.methodLine || 1;
    const uri = vscode.Uri.file(resolved.filePath);
    const pos = new vscode.Position(Math.max(targetLine - 1, 0), 0);
    return new vscode.Location(uri, pos);
}

function provideCompletionItems(document, position) {
    const config = getConfig();
    if (!config.completionEnabled || !isTargetDocument(document)) {
        return null;
    }

    const offset = document.offsetAt(position);
    const completionContext = extractElCompletionContext(document, position);
    if (completionContext) {
        if (completionContext.mode === "root") {
            const rootItems = buildRootCompletionItems(document, config, completionContext, offset);
            if (rootItems.length > 0) {
                return new vscode.CompletionList(rootItems, false);
            }
        }

        if (completionContext.mode === "path") {
            const memberItems = buildPathMemberCompletionItems(document, config, completionContext, offset);
            if (memberItems.length > 0) {
                return new vscode.CompletionList(memberItems, false);
            }
        }
    }

    const markupItems = buildJsfMarkupCompletionItems(document, position);
    return markupItems.length > 0 ? new vscode.CompletionList(markupItems, false) : null;
}

async function activate(context) {
    ensureDecorationType();
    refreshAllEditors();

    context.subscriptions.push(
        vscode.commands.registerCommand("jsf.hjc.refresh", () => {
            invalidateBeanCache();
            ensureDecorationType();
            refreshAllEditors();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("jsf.hjc.applyDefaultColors", async () => {
            await applyDefaultPalette();
            ensureDecorationType();
            refreshAllEditors();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("jsf.hjc.configureCustomColors", async () => {
            await configureCustomPalette();
            ensureDecorationType();
            refreshAllEditors();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("jsf.hjc.disableColors", async () => {
            await disablePalette();
            ensureDecorationType();
            refreshAllEditors();
        })
    );

    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            [{ language: "html", scheme: "file" }, { language: "xml", scheme: "file" }],
            { provideHover }
        )
    );

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            [{ language: "html", scheme: "file" }, { language: "xml", scheme: "file" }],
            { provideDefinition }
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            [{ language: "html", scheme: "file" }, { language: "xml", scheme: "file" }],
            { provideCompletionItems },
            "#",
            "{",
            ".",
            "<",
            ":"
        )
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((evt) => {
            for (const editor of vscode.window.visibleTextEditors) {
                if (editor.document.uri.toString() === evt.document.uri.toString()) {
                    refreshEditor(editor);
                }
            }
            const fsPath = evt.document.uri.fsPath || "";
            if (fsPath.toLowerCase().endsWith(".java")) {
                invalidateBeanCache();
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidCreateFiles((evt) => {
            if (evt.files.some((f) => (f.fsPath || "").toLowerCase().endsWith(".java"))) {
                invalidateBeanCache();
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidDeleteFiles((evt) => {
            if (evt.files.some((f) => (f.fsPath || "").toLowerCase().endsWith(".java"))) {
                invalidateBeanCache();
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidRenameFiles((evt) => {
            if (evt.files.some((f) =>
                (f.oldUri.fsPath || "").toLowerCase().endsWith(".java") ||
                (f.newUri.fsPath || "").toLowerCase().endsWith(".java")
            )) {
                invalidateBeanCache();
            }
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(() => {
            refreshAllEditors();
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            refreshEditor(editor);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((evt) => {
            if (evt.affectsConfiguration(CONFIG_NAMESPACE)) {
                invalidateBeanCache();
                ensureDecorationType();
                refreshAllEditors();
            }
        })
    );

    context.subscriptions.push({
        dispose: () => {
            if (elDecorationType) {
                elDecorationType.dispose();
                elDecorationType = null;
            }
            if (attrDecorationType) {
                attrDecorationType.dispose();
                attrDecorationType = null;
            }
            invalidateBeanCache();
        }
    });
}

function deactivate() {
    if (elDecorationType) {
        elDecorationType.dispose();
        elDecorationType = null;
    }
    if (attrDecorationType) {
        attrDecorationType.dispose();
        attrDecorationType = null;
    }
    invalidateBeanCache();
}

module.exports = {
    activate,
    deactivate
};
