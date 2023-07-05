/*
 * The purpose of this script is to create a test-app that can be used in it-tests
 */
import minimist from 'minimist';
import {execSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import * as path from 'node:path';
import {minVersion, satisfies} from 'semver';
import {Locker} from './utilities/locker.mjs';
import {createTestApp} from './utilities/create-test-app.mjs';

const argv = minimist(process.argv.slice(2));
const appName = argv.appName || 'test-app';
const withCore = argv.withCore || false;
const blank = argv.blank || false;
const packageManager = argv.packageManager || 'yarn';

const rootFolderPath = process.cwd();
const itTestsFolderPath = path.join(rootFolderPath, '..', 'it-tests');
const skeletonAppFolderPath = path.join(itTestsFolderPath, 'test-app');
const skeletonAppWithCoreFolderPath = path.join(itTestsFolderPath, 'test-app-with-core');
const appFolderPath = path.join(itTestsFolderPath, appName);
const globalFolderPath = path.join(rootFolderPath, '.cache', appName);
const cacheFolderPath = path.join(globalFolderPath, 'cache');

const o3rCorePackageJson = JSON.parse(readFileSync(path.join(rootFolderPath, 'packages', '@o3r', 'core', 'package.json')).toString());
const o3rPackageJson = JSON.parse(readFileSync(path.join(rootFolderPath, 'package.json')).toString());
const yarnVersion = o3rPackageJson?.packageManager?.split('@')?.[1] || '3.5.0';
const angularVersion = minVersion(o3rCorePackageJson.devDependencies['@angular-devkit/schematics']).version;
const materialVersion = minVersion(o3rCorePackageJson.generatorDependencies?.['@angular/material'] || angularVersion).version;

void (async () => {
  // Remove all cache entries relative to local workspaces (@o3r, @ama-sdk, @ama-terasu)
  if (existsSync(cacheFolderPath)) {
    const workspacesList = execSync('yarn workspaces:list', {stdio: 'pipe'}).toString().split('\n')
      .map((workspace) => workspace.replace('packages/', '').replace(/\//, '-'))
      .filter((workspace) => !!workspace);
    readdirSync(cacheFolderPath).forEach((fileName) => {
      if (workspacesList.some((workspace) => fileName.startsWith(workspace))) {
        rmSync(path.join(cacheFolderPath, fileName));
      }
    });
  }

  // Create it-tests folder
  if (!existsSync(itTestsFolderPath)) {
    mkdirSync(itTestsFolderPath);
  }

  // Remove existing app
  if (existsSync(appFolderPath)) {
    rmSync(appFolderPath, {recursive: true});
  }

  if (blank) {
    await createTestApp({
      appName,
      cwd: itTestsFolderPath,
      globalFolderPath: globalFolderPath,
      yarnVersion,
      blank: true,
      packageManager
    });
  } else {
    // Create new skeleton app if needed
    await createTestApp({
      appName: 'test-app',
      cwd: itTestsFolderPath,
      globalFolderPath: globalFolderPath,
      yarnVersion,
      angularVersion,
      materialVersion,
      packageManager
    });

    if (withCore && !existsSync(skeletonAppWithCoreFolderPath)) {
      await createTestAppWithCore();
    }
  }

  // Copy skeleton app into app
  if (!blank && appName !== 'test-app') {
    cpSync(withCore ? skeletonAppWithCoreFolderPath : skeletonAppFolderPath, appFolderPath, {recursive: true});
  }
})();

async function createTestAppWithCore() {
  const locker = new Locker({
    lockFilePath: path.join(itTestsFolderPath, 'test-app-with-core.lock'),
    LOCK_TIMEOUT: 10 * 60 * 1000
  });
  if (locker.isLocked()) {
    await locker.waitUntilUnlocked();
  }
  if (existsSync(appFolderPath)) {
    const packageJson = JSON.parse(readFileSync(path.join(skeletonAppWithCoreFolderPath, 'package.json'), {encoding: 'utf8'}));
    const deps = [
      {name: '@angular-devkit/schematics', expected: angularVersion, actual: packageJson.dependencies['@angular-devkit/schematics']},
      {name: '@angular/material', expected: materialVersion, actual: packageJson.dependencies['@angular/material']}
    ]
    if (deps.every(({expected, actual}) => satisfies(expected, actual))) {
      // No need to regenerate
      return;
    } else {
      console.log(`Dependencies version mismatch, need to regenerate\n${deps.map(({name, expected, actual}) => `${name} expected: ${expected}, actual: ${actual}`).join('\n')}`);
    }
  }
  locker.lock();
  cpSync(skeletonAppFolderPath, skeletonAppWithCoreFolderPath, {recursive: true});
  const execAppOptions = {
    cwd: skeletonAppWithCoreFolderPath,
    stdio: 'inherit',
    env: {...process.env, NODE_OPTIONS: ''}
  };
  const addCmd = packageManager === 'yarn' ? 'yarn add' : 'npm i';
  const o3rCoreOptions = [
    '--no-enableApisManager',
    '--no-enableStyling',
    '--no-enableAnalytics',
    '--no-enableCustomization',
    '--no-enablePlaywright',
    '--no-enablePrefetchBuilder',
    '--no-enableRulesEngine',
    '--no-enableCms',
    '--no-enableConfiguration',
    '--no-enableLocalization',
    '--no-enableApisManager'
  ].join(' ');
  execSync(`${addCmd} @o3r/core@999.0.0`, execAppOptions);
  const ngAddCmd = packageManager === 'yarn' ? 'yarn ng add' : 'npx ng add';
  execSync(`${ngAddCmd} @o3r/core@999.0.0 --force --skip-confirmation --defaults=true ${o3rCoreOptions}`, execAppOptions);
  execSync(packageManager === 'yarn' ? 'yarn install && yarn build' : 'npm install && npm run build', execAppOptions);
  locker.unlock();
}
