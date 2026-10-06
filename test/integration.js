'use strict';
const assert = require('node:assert/strict');
const vscode = require('vscode');

exports.run = async function () {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspace && /src-folder-colors-test-/.test(workspace.uri.path),
    'Run only in a disposable workspace named src-folder-colors-test-* (see README).');
  const extension = vscode.extensions.getExtension('local-tools.src-folder-colors');
  assert.ok(extension);
  const provider = await extension.activate();
  const uri = path => vscode.Uri.joinPath(workspace.uri, path);
  const color = path => provider.provideFileDecoration(uri(path))?.color.id;
  const mkdir = path => vscode.workspace.fs.createDirectory(uri(path));
  const write = path => vscode.workspace.fs.writeFile(uri(path), Buffer.from('// test\n'));
  async function until(check) {
    const deadline = Date.now() + 15000;
    while (!check()) {
      if (Date.now() > deadline) assert.fail('Timed out waiting for file decorations');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  await mkdir('src/executers');
  await mkdir('src/i_core/datastore');
  await mkdir('src/psychoparser');
  await mkdir('src/symbolresolver');
  await write('src/executers/executer.rs');
  await write('src/i_core/datastore/helpers.rs');
  await write('src/loose.rs');
  await until(() => color('src/symbolresolver') && color('src/i_core'));
  const names = ['executers', 'i_core', 'psychoparser', 'symbolresolver'];
  const original = names.map(name => color(`src/${name}`));
  assert.equal(new Set(original).size, 4);
  assert.equal(color('src/executers/executer.rs'), original[0]);
  assert.equal(color('src/i_core/datastore'), original[1]);
  assert.equal(color('src/i_core/datastore/helpers.rs'), original[1]);
  assert.equal(color('src'), undefined);
  assert.equal(color('src/loose.rs'), undefined);
  assert.equal(color('src-other/executers'), undefined);
  assert.equal(provider.provideFileDecoration(uri('src/executers')).badge, undefined);
  assert.equal(provider.provideFileDecoration(uri('src/executers')).propagate, false);

  await mkdir('src/aaa-new');
  await until(() => color('src/aaa-new'));
  assert.deepEqual(names.map(name => color(`src/${name}`)), original);
  assert.ok(!original.includes(color('src/aaa-new')));
  await vscode.workspace.fs.rename(uri('src/aaa-new'), uri('src/renamed'));
  await until(() => !color('src/aaa-new') && color('src/renamed'));
  await vscode.workspace.fs.delete(uri('src/renamed'), { recursive: true });
  await until(() => !color('src/renamed'));

  const config = vscode.workspace.getConfiguration('srcFolderColors', workspace.uri);
  await mkdir('lib/module/deep');
  await config.update('root', 'lib', vscode.ConfigurationTarget.Workspace);
  await until(() => color('lib/module/deep') && !color('src/executers'));
  await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);
  await until(() => !color('lib/module'));
  await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
  await until(() => color('lib/module'));
  await vscode.commands.executeCommand('srcFolderColors.refresh');
  assert.ok(color('lib/module'));
  console.log('PASS: real extension-host integration (inheritance, exclusions, live add/rename/delete, settings).');
};
