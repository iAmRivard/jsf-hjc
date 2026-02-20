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

let elDecorationType = null;
let attrDecorationType = null;

// key: "<workspaceFsPath>|<javaRootRelative>"
// value: { timestamp: number, index: Map<string, BeanEntry[]> }
const beanIndexCache = new Map();

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
