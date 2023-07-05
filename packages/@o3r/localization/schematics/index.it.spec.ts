import {execSync, ExecSyncOptions} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import * as path from 'node:path';
import getPidFromPort from 'pid-from-port';

const appName = 'test-app-localization';
const currentFolder = path.join(__dirname, '..', '..', '..', '..');
const parentFolderPath = path.join(currentFolder, '..');
const itTestsFolderPath = path.join(parentFolderPath, 'it-tests');
const appFolderPath = path.join(itTestsFolderPath, appName);
// eslint-disable-next-line @typescript-eslint/naming-convention
const execEnv: ExecSyncOptions['env'] = {...process.env, JEST_WORKER_ID: undefined, NODE_OPTIONS: '', CI: 'true'};
const execAppOptions: ExecSyncOptions = {
  cwd: appFolderPath,
  stdio: 'inherit',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  env: execEnv
};
const packageManager = process.env.USE_NPM_FOR_IT_TESTS ? 'npm' : 'yarn';
const PACKAGE_MANAGERS_CMD = {
  npm: {
    add: 'npm install',
    exec: 'npx',
    install: 'npm install',
    run: 'npm run'
  },
  yarn: {
    add: 'yarn add',
    exec: 'yarn run',
    install: 'yarn install',
    run: 'yarn run'
  }
};
const packageManagerCmd = PACKAGE_MANAGERS_CMD[packageManager];
const o3rVersion = '999.0.0';

/**
 * @param moduleName
 * @param modulePath
 */
function addImportToAppModule(moduleName: string, modulePath: string) {
  const appModuleFilePath = path.join(appFolderPath, 'src/app/app.module.ts');
  const appModule = readFileSync(appModuleFilePath).toString();
  writeFileSync(appModuleFilePath, `import { ${moduleName} } from '${modulePath}';\n${
    appModule.replace(/(BrowserModule,)/, `$1\n    ${moduleName},`)
  }`);
}

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

describe('new otter application with localization', () => {
  setupLocalRegistry();
  beforeAll(() => {
    execSync(`yarn prepare-test-app --appName=${appName} --withCore --packageManager=${packageManager}`, {env: execEnv});
  });
  test('should add localization to existing application', () => {
    execSync(`${packageManagerCmd.add} @o3r/localization@${o3rVersion}`, execAppOptions);
    execSync(`${packageManagerCmd.exec} ng add @o3r/localization@${o3rVersion} --skip-confirmation --defaults=true --force --verbose`, execAppOptions);

    execSync(`${packageManagerCmd.exec} ng g @o3r/core:component --defaults=true test-component --use-localization=false`, execAppOptions);
    execSync(
      `${packageManagerCmd.exec} ng g @o3r/localization:add-localization --defaults=true --activate-dummy --path="src/components/test-component/presenter/test-component-pres.component.ts"`,
      execAppOptions);
    addImportToAppModule('TestComponentContModule', 'src/components/test-component');

    expect(() => execSync(packageManagerCmd.install, execAppOptions)).not.toThrow();
    expect(() => execSync(`${packageManagerCmd.run} build`, execAppOptions)).not.toThrow();
  });
});
