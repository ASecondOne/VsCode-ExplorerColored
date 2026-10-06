'use strict';

const vscode = require('vscode');
const { assignColors, rootParts } = require('./colors');
const PALETTE_SIZE = require('./package.json').contributes.colors.length;

function relativePath(parent, uri) {
  if (parent.scheme !== uri.scheme || parent.authority !== uri.authority) return;
  const prefix = parent.path.replace(/\/$/, '') + '/';
  if (uri.path.startsWith(prefix)) return uri.path.slice(prefix.length);
}

class FolderColors {
  constructor(context) {
    this.context = context;
    this.roots = new Map();
    this.changed = new vscode.EventEmitter();
    this.onDidChangeFileDecorations = this.changed.event;
    this.pending = Promise.resolve();
    this.watchers = [];
    this.disposed = false;
  }

  watch() {
    this.watchers.forEach(watcher => watcher.dispose());
    this.watchers = [];
    for (const folder of vscode.workspace.workspaceFolders || []) {
      // Watch creations/deletions, including a root that does not exist yet.
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, '**/*'), false, true, false
      );
      const update = uri => {
        const parts = rootParts(vscode.workspace.getConfiguration('srcFolderColors', folder.uri).get('root', 'src'));
        if (!parts) return;
        const root = vscode.Uri.joinPath(folder.uri, ...parts);
        const relative = relativePath(root, uri);
        // Nested directory creation/deletion can change the containing-folder color.
        if (root.toString() === uri.toString() || relativePath(uri, root) !== undefined ||
            relative !== undefined) this.schedule();
      };
      watcher.onDidCreate(update);
      watcher.onDidDelete(update);
      this.watchers.push(watcher);
    }
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.refresh(); }, 100);
  }

  refresh() {
    // Serialize scans and storage writes so bursts of changes cannot overwrite newer assignments.
    this.pending = this.pending.then(() => this.scan()).catch(error => {
      console.warn('[Src Folder Colors]', error);
    });
    return this.pending;
  }

  async scan() {
    if (this.disposed) return;
    const next = new Map();
    const saved = this.context.workspaceState.get('assignments.v2',
      this.context.workspaceState.get('assignments.v1', {}));
    const stored = { ...saved };
    for (const folder of vscode.workspace.workspaceFolders || []) {
      const config = vscode.workspace.getConfiguration('srcFolderColors', folder.uri);
      if (!config.get('enabled', true)) continue;
      const parts = rootParts(config.get('root', 'src'));
      if (!parts) {
        console.warn('[Src Folder Colors] root must be a relative directory path without .. segments.');
        continue;
      }
      const root = vscode.Uri.joinPath(folder.uri, ...parts);
      const key = root.toString();
      const previous = stored[key] || {};
      const assignments = Object.create(null);
      const pending = [{ uri: root, path: '', slot: undefined }];
      while (pending.length && !this.disposed) {
        const parent = pending.pop();
        let entries;
        try {
          entries = await vscode.workspace.fs.readDirectory(parent.uri);
        } catch (error) {
          if (error.code !== 'FileNotFound') console.warn('[Src Folder Colors]', parent.uri.toString(), error);
          continue;
        }
        // Do not follow directory symlinks: they may form cycles or escape the root.
        const names = entries.filter(([, type]) =>
          (type & vscode.FileType.Directory) !== 0 && (type & vscode.FileType.SymbolicLink) === 0
        ).map(([name]) => name);
        const prefix = parent.path ? parent.path + '/' : '';
        const oldSiblings = Object.create(null);
        for (const name of names) {
          if (Object.hasOwn(previous, prefix + name)) oldSiblings[name] = previous[prefix + name];
        }
        const siblings = assignColors(names, oldSiblings, PALETTE_SIZE, parent.slot);
        for (const name of names.sort()) {
          const path = prefix + name;
          const slot = siblings[name];
          assignments[path] = slot;
          pending.push({ uri: vscode.Uri.joinPath(parent.uri, name), path, slot });
        }
      }
      stored[key] = assignments;
      next.set(folder.uri.toString(), { root, assignments });
    }
    if (this.disposed) return;
    this.roots = next;
    // Undefined invalidates all cached decorations, including old descendants.
    this.changed.fire(undefined);
    if (JSON.stringify(stored) !== JSON.stringify(this.context.workspaceState.get('assignments.v2', {}))) {
      await this.context.workspaceState.update('assignments.v2', stored);
    }
  }

  provideFileDecoration(uri) {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    const state = folder && this.roots.get(folder.uri.toString());
    if (!state) return;
    const relative = relativePath(state.root, uri);
    if (!relative) return;
    // A directory has its own slot; files use only their immediate containing directory.
    const name = Object.hasOwn(state.assignments, relative)
      ? relative : relative.slice(0, Math.max(0, relative.lastIndexOf('/')));
    const slot = state.assignments[name];
    if (!Object.hasOwn(state.assignments, name) || !Number.isInteger(slot)) return;
    const decoration = new vscode.FileDecoration(
      undefined, `Folder color: ${name}`, new vscode.ThemeColor(`srcFolderColors.color${slot + 1}`)
    );
    // propagate goes UP to parents, not down. Descendants are matched above instead.
    decoration.propagate = false;
    return decoration;
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.watchers.forEach(watcher => watcher.dispose());
    this.changed.dispose();
  }
}

async function activate(context) {
  const provider = new FolderColors(context);
  context.subscriptions.push(
    provider,
    vscode.window.registerFileDecorationProvider(provider),
    vscode.commands.registerCommand('srcFolderColors.refresh', () => provider.refresh()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      provider.watch();
      void provider.refresh();
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('srcFolderColors')) void provider.refresh();
    })
  );
  provider.watch();
  await provider.refresh();
  return provider;
}

module.exports = { activate };
