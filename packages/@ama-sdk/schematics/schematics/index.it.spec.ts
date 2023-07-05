import { execSync, ExecSyncOptions } from 'node:child_process';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import type { PackageJson } from 'type-fest';
import getPidFromPort from 'pid-from-port';
import { minVersion } from 'semver';

const appName = 'test-sdk';
const currentFolder = path.join(__dirname, '..', '..', '..', '..');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const parentFolderPath = path.join(currentFolder, '..');
const itTestsFolderPath = path.join(parentFolderPath, 'it-tests');
const sdkFolderPath = path.join(itTestsFolderPath, 'test-sdk');
// eslint-disable-next-line @typescript-eslint/naming-convention
const execEnv: ExecSyncOptions['env'] = {...process.env, JEST_WORKER_ID: undefined, NODE_OPTIONS: '', CI: 'true'};
const execAppOptions: ExecSyncOptions = {
  cwd: sdkFolderPath,
  stdio: 'inherit',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  env: execEnv
};

/**
 * Set up a local npm registry inside a docker image before the tests.
 * Publish all the packages of the Otter monorepo on it.
 * Can be accessed during the tests with url http://localhost:4873
 */
function setupLocalRegistry() {
  let shouldHandleVerdaccio = false;

  beforeAll(async () => {
    try {
      await getPidFromPort(4873);
    } catch (ex) {
      shouldHandleVerdaccio = true;
      execSync('yarn verdaccio:start', {cwd: currentFolder, stdio: 'inherit'});
      execSync('yarn verdaccio:publish', {cwd: currentFolder, stdio: 'inherit'});
    }
  });

  afterAll(() => {
    if (shouldHandleVerdaccio) {
      execSync('yarn verdaccio:stop', {cwd: currentFolder, stdio: 'inherit'});
    }
  });
}

/**
 * Setup a new sdk using schematics CLI
 */
function setupNewSdk() {
  beforeAll(() => {
    execSync(`yarn prepare-test-app --appName=${appName} --blank`, {env: execEnv});
    writeFileSync(path.join(sdkFolderPath, 'package.json'), '{"name": "@test/sdk"}');

    const packageJson = JSON.parse(readFileSync(packageJsonPath).toString()) as PackageJson;
    const angularVersion = minVersion(packageJson.devDependencies['@angular-devkit/schematics-cli']).version;
    execSync(`yarn add -D @angular-devkit/schematics-cli@${angularVersion} @ama-sdk/schematics`, execAppOptions);
    execSync(`yarn add -D @openapitools/openapi-generator-cli@${packageJson.peerDependencies['@openapitools/openapi-generator-cli']} @ama-sdk/schematics`, execAppOptions);
    cpSync(path.join(__dirname, '..', 'testing', 'MOCK_swagger.yaml'), path.join(sdkFolderPath, 'swagger-spec.yml'));
    execSync('yarn schematics @ama-sdk/schematics:typescript-sdk --name test --package sdk --spec-path ./swagger-spec.yml', execAppOptions);
    execSync('yarn', execAppOptions);
  });
}

describe('new Otter sdk', () => {
  setupLocalRegistry();
  setupNewSdk();

  test('should build', () => {
    expect(() => execSync('yarn build', execAppOptions)).not.toThrow();

    cpSync(path.join(__dirname, '..', 'testing', 'MOCK_swagger_updated.yaml'), path.join(sdkFolderPath, 'swagger-spec.yml'));
    execSync('yarn schematics @ama-sdk/schematics:typescript-core --spec-path ./swagger-spec.yml', execAppOptions);

    expect(() => execSync('yarn build', execAppOptions)).not.toThrow();
  });
});
