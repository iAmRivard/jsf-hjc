# JSF HJC (Hover/Jump/Colors)

Highlights JSF EL expressions `#{...}` in `xhtml/html/xml` editors, independently from TextMate token scopes.
Also supports highlighting selected attribute names and their values.
Also adds JSF EL completion with `Ctrl+Space` for `#{bean}` and `#{bean.member}`.
Also adds JSF/PrimeFaces tag and attribute completion (`p:`, `h:`, `f:`, `ui:`) in XHTML/XML.
Also adds hover cards over `#{bean.member}` with resolved Java class and method line.
Supports `Ctrl+Click` (Go to Definition) from `#{bean.member}` to Java method/class.
Includes color profiles: default, custom, disabled.
default is good with theme default ligth+

## Autocompletion (Ctrl+Space)

### JSF EL completion

- `#{` -> suggests managed beans
- `#{bean.` -> suggests bean properties/methods (from Java source)
- `#{pl.` -> suggests row object members when `pl` comes from `var="pl"` (for example `p:dataTable`, `ui:repeat`)
- `#{pl.idCliente.` -> supports nested property completion when the Java types can be resolved

### JSF/PrimeFaces markup completion

- `<p:` / `<h:` / `<f:` / `<ui:` -> suggests tags
- inside a tag -> suggests attributes for common JSF/PrimeFaces tags
- inside attribute values -> suggests common values (`selectionMode`, `filterMatchMode`, booleans, etc.)
- EL snippets in attribute values (`#{...}`, `#{bean.method}`, `#{not empty ...}`)

### Notes

- For EL type-aware completion to work well, Java collections should use generics (example: `List<CrtPoliza>`).
- Java source lookup uses `jsf.hjc.hover.javaRootRelative` (default: `src/main/java`).

## Local install

1. Open a terminal in this folder.
2. Run:
   - `npm run package`
3. Install generated VSIX from VS Code:
   - `Extensions: Install from VSIX...`
   - pick `jsf-hjc-0.0.12.vsix`

## Settings

- `jsf.hjc.enabled`
- `jsf.hjc.colorProfile` (`default` | `custom` | `disabled`)
- `jsf.hjc.foreground`
- `jsf.hjc.background`
- `jsf.hjc.fontStyle`
- `jsf.hjc.attributeHighlight.enabled`
- `jsf.hjc.attributeHighlight.names`
- `jsf.hjc.attributeHighlight.foreground`
- `jsf.hjc.completion.enabled`
- `jsf.hjc.hover.enabled`
- `jsf.hjc.hover.javaRootRelative`
- `jsf.hjc.hover.cacheMs`

## Commands

- `JSF HJC: Refresh`
- `JSF HJC: Colors - Apply Default`
- `JSF HJC: Colors - Configure Custom`
- `JSF HJC: Colors - Disable`
