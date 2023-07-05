import {execSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import * as path from 'node:path';
import {satisfies} from 'semver';
import {Locker} from './locker.mjs';

/**
 * Generate a base app with minimal necessary dependencies
 * Uses a locker mechanism so this function can be called in parallel
 * The lock will automatically expire after 10 minutes if the creation of the app failed for whatever reason
 *
 * @param appName
 */
export async function createTestApp(options) {
  options = {
    appName: 'test-app',
    cwd: process.cwd(),
    globalFolderPath: process.cwd(),
    registry: 'http://localhost:4873',
    blank: false,
    packageManager: 'yarn',
    ...options
  };
  const appFolderPath = path.join(options.cwd, options.appName);
  const locker = new Locker({
    lockFilePath: path.join(options.cwd, `${options.appName}-ongoing.lock`),
    LOCK_TIMEOUT: 10 * 60 * 1000
  });
  if (locker.isLocked()) {
    return locker.waitUntilUnlocked();
  }
  if (existsSync(appFolderPath)) {
    if (options.blank) {
      return;
    }
    const packageJson = JSON.parse(readFileSync(path.join(appFolderPath, 'package.json'), {encoding: 'utf8'}));
    const deps = [
      {name: '@angular-devkit/schematics', expected: options.angularVersion, actual: packageJson.dependencies['@angular-devkit/schematics']},
      {name: '@angular/material', expected: options.materialVersion, actual: packageJson.dependencies['@angular/material']}
    ]
    if (deps.every(({expected, actual}) => satisfies(expected, actual))) {
      // No need to regenerate
      return;
    } else {
      console.log(`Dependencies version mismatch, need to regenerate\n${deps.map(({name, expected, actual}) => `${name} expected: ${expected}, actual: ${actual}`).join('\n')}`);
    }
  }
  locker.lock();

  const execAppOptions = {
    cwd: appFolderPath,
    stdio: 'inherit',
    env: {...process.env, NODE_OPTIONS: ''}
  };

  // Prepare folder
  if (existsSync(appFolderPath)) {
    rmSync(appFolderPath, {recursive: true});
  }

  if (options.blank) {
    mkdirSync(appFolderPath, {recursive: true});
    if (options.packageManager === 'yarn') {
      execSync(`yarn init`, execAppOptions);
    }
  } else {
    // Create app with ng new
    execSync(`yarn create @angular@${options.angularVersion} ${options.appName} --style=scss --routing --defaults=true --skip-git --package-manager=${options.packageManager}`,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      {cwd: options.cwd, stdio: 'inherit', env: {...process.env, NODE_OPTIONS: ''}});
  }

  if (options.packageManager === 'yarn') {
    // Set yarn version
    execSync('yarn config set enableStrictSsl false', execAppOptions);
    execSync(`yarn set version ${options.yarnVersion}`, execAppOptions);

    // Set config to target local registry
    execSync('yarn config set checksumBehavior update', execAppOptions);
    execSync('yarn config set enableGlobalCache true', execAppOptions);
    execSync('yarn config set enableImmutableInstalls false', execAppOptions);
    execSync(`yarn config set globalFolder ${options.globalFolderPath}`, execAppOptions);
    execSync('yarn config set nodeLinker pnp', execAppOptions);
    execSync(`yarn config set npmScopes.ama-sdk.npmRegistryServer ${options.registry}`, execAppOptions);
    execSync(`yarn config set npmScopes.o3r.npmRegistryServer ${options.registry}`, execAppOptions);
    execSync('yarn config set unsafeHttpWhitelist localhost', execAppOptions);
  } else {
    // FIXME to be removed?
    execSync(`npm config set legacy-peer-deps=true -L project`, execAppOptions);

    execSync(`npm config set @ama-sdk:registry=${options.registry} -L project`, execAppOptions);
    execSync(`npm config set @o3r:registry=${options.registry} -L project`, execAppOptions);
  }

  if (!options.blank) {
    // Add dependencies
    const deps = {
      '@angular-devkit/schematics': options.angularVersion,
      '@angular/pwa': options.angularVersion,
      '@angular/material': options.materialVersion
    };
    const addCmd = options.packageManager === 'yarn' ? 'yarn add' : 'npm i';
    execSync(`${addCmd} ${Object.entries(deps).map(([depName, version]) => `${depName}@${version}`).join(' ')}`, execAppOptions);

    // Run ng-adds
    const ngAddCmd = options.packageManager === 'yarn' ? 'yarn ng add' : 'npx ng add';
    execSync(`${ngAddCmd} @angular/pwa@${options.angularVersion} --force --skip-confirmation --defaults=true`, execAppOptions);
    execSync(`${ngAddCmd} @angular/material@${options.materialVersion} --skip-confirmation --defaults=true`, execAppOptions);

    execSync(options.packageManager === 'yarn' ? 'yarn install && yarn build' : 'npm install && npm run build', execAppOptions);
  }
  locker.unlock();
}
