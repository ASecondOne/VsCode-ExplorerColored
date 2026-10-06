# Src Folder Colors

A dependency-free JavaScript VS Code extension that colors Explorer **name text** according to the first directory under `src/` (or another configured root).

## Supported API and limits

Yes: `FileDecorationProvider` with a `FileDecoration.color` colors the full file/folder label in the Explorer. No badge is necessary. This extension uses only public APIs, with contributed theme colors; it does not inject CSS, patch VS Code, or call internal APIs.

Verified against the current official API and Microsoft renderer sources:

- [FileDecoration API](https://code.visualstudio.com/api/references/vscode-api#FileDecoration)
- [Color contribution point](https://code.visualstudio.com/api/references/contribution-points#contributes.colors)
- [Resource label renderer](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/browser/labels.ts) applies the decoration's label color when colors are enabled.
- [Decoration service](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/decorations/browser/decorationsService.ts) implements label coloring. These sources were inspected as evidence; the extension does not import them.

`explorer.decorations.colors` must be `true` (VS Code's default). Git, errors/warnings, or other decoration providers can compete for the same foreground. The public API has no priority setting to force our color to win. Selection/theme styling can also affect the displayed color. For testing conflicts, you can temporarily disable `git.decorations.enabled` and `problems.decorations.enabled` yourself. The extension never changes those settings.

File decorations are resource-wide: other VS Code views that display file decorations may show these colors too. The API cannot restrict a provider solely to Explorer. Compact folders can combine several path segments into one label; disable `explorer.compactFolders` if you prefer every directory on its own row.

## Behavior

- Automatically discovers immediate directories under each workspace folder's `src`.
- Colors each such directory and every file/subdirectory below it, at any depth.
- Leaves the root itself, loose files directly in it, and everything outside it uncolored.
- Uses 16 pastel colors for dark themes, with darker counterparts for light themes.
- Hashes folder names and resolves collisions in sorted order on first discovery. Stores assignments in VS Code workspace state, so restarts and new folders preserve existing colors. No recursive disk scan is required.
- Assigns distinct palette slots for up to 16 directories. Above that, colors repeat; this is a finite palette, not an unlimited uniqueness guarantee. Returning to 16 or fewer resolves any remaining duplicates, which can recolor a formerly duplicated folder. Similar shades may be difficult to distinguish, especially with color-vision differences.
- Deleted folders release their assignment. Renaming is treated as deleting and adding, so the renamed folder may change color. A fresh workspace/profile or cleared extension state can produce different collision resolutions from an existing workspace with a different folder history.
- Watches creation/deletion, including a root created after activation; renames are handled as filesystem changes. Configuration and workspace-folder changes refresh automatically.
- Uses URI-based filesystem APIs for remote workspaces; watcher delivery still depends on the filesystem provider and watcher exclusions. Run **Src Folder Colors: Refresh** if an external change is missed.

## Run locally

1. Open this `src-folder-colors` directory in VS Code (the directory containing `package.json`). No `npm install` or build is needed.
2. Press **F5** and select **Run Src Folder Colors**. This opens an Extension Development Host window.
3. In that window, open your project folder, which contains `src/`.
4. Expand `src` and its children. Their names should be colored. Create another first-level directory and a nested file to check live updates.
5. Run **Developer: Reload Window** in that window to verify stable colors after restarting the extension host.

Alternatively, with the `code` CLI:

```sh
code --new-window --extensionDevelopmentPath="/absolute/path/to/src-folder-colors" "/absolute/path/to/your-project"
```

For example, `src/executers` and every descendant get one color, while `src/i_core`, `src/psychoparser`, and `src/symbolresolver` each get another.

## Settings

```json
{
  "srcFolderColors.root": "src",
  "srcFolderColors.enabled": true,
  "explorer.decorations.colors": true
}
```

The root is relative to each workspace folder; `packages/app/src` is also valid. Absolute paths, `..`, and the workspace root itself are intentionally unsupported. In a multi-root workspace, configure a different value in each folder's settings if needed. Changes take effect without restarting.

Optional palette customization uses the standard setting:

```json
{
  "workbench.colorCustomizations": {
    "srcFolderColors.color1": "#89B4FA",
    "srcFolderColors.color2": "#A6E3A1"
  }
}
```

There are IDs `srcFolderColors.color1` through `srcFolderColors.color16`.

## Automated checks

With Node.js 18 or newer, run `npm test` in this extension directory. No dependencies are installed.

The real VS Code integration test checks recursive inheritance, loose-file exclusion, automatic create/rename/delete updates, and root/enabled settings changes. On Linux/macOS, run the following **from this extension directory** (requires a graphical VS Code session):

```sh
test_workspace=$(mktemp -d "${TMPDIR:-/tmp}/src-folder-colors-test-XXXXXX")
test_profile=$(mktemp -d "${TMPDIR:-/tmp}/src-folder-colors-profile-XXXXXX")
code --new-window --user-data-dir="$test_profile" --disable-extensions \
  --disable-workspace-trust --skip-welcome --skip-release-notes \
  --extensionDevelopmentPath="$PWD" \
  --extensionTestsPath="$PWD/test/integration.js" "$test_workspace"
```

This writes fixtures and settings only inside the temporary test workspace and closes the test window on completion. Temporary test workspace/profile directories remain available for inspection and can be deleted afterwards. The test checks provider behavior through the real extension host; visual appearance still needs the F5 check above.
