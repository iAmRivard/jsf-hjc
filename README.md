# JSF HJC (Hover/Jump/Colors)

Highlights JSF EL expressions `#{...}` in `xhtml/html/xml` editors, independently from TextMate token scopes.
Also supports highlighting selected attribute names and their values.
Also adds hover cards over `#{bean.member}` with resolved Java class and method line.
Supports `Ctrl+Click` (Go to Definition) from `#{bean.member}` to Java method/class.
Includes color profiles: default, custom, disabled.

## Local install

1. Open a terminal in this folder.
2. Run:
   - `npm run package`
3. Install generated VSIX from VS Code:
   - `Extensions: Install from VSIX...`
   - pick `jsf-hjc-0.0.11.vsix`

## Settings

- `jsf.hjc.enabled`
- `jsf.hjc.colorProfile` (`default` | `custom` | `disabled`)
- `jsf.hjc.foreground`
- `jsf.hjc.background`
- `jsf.hjc.fontStyle`
- `jsf.hjc.attributeHighlight.enabled`
- `jsf.hjc.attributeHighlight.names`
- `jsf.hjc.attributeHighlight.foreground`
- `jsf.hjc.hover.enabled`
- `jsf.hjc.hover.javaRootRelative`
- `jsf.hjc.hover.cacheMs`

## Commands

- `JSF HJC: Refresh`
- `JSF HJC: Colors - Apply Default`
- `JSF HJC: Colors - Configure Custom`
- `JSF HJC: Colors - Disable`
