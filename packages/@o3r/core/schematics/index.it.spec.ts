import { execSync, ExecSyncOptions, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import getPidFromPort from 'pid-from-port';

const devServerPort = 4200;
const appName = 'test-app-core';
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

describe('new otter application', () => {
  setupLocalRegistry();
  beforeAll(() => {
    execSync(`yarn prepare-test-app --appName=${appName} --packageManager=${packageManager}`, {env: execEnv});
  });
  test('should build empty app', () => {
    execSync(`${packageManagerCmd.add} @o3r/core@${o3rVersion}`, execAppOptions);
    execSync(`${packageManagerCmd.exec} ng add @o3r/core@${o3rVersion} --skip-confirmation --defaults=true --force --verbose --enableRulesEngine`, execAppOptions);
    expect(() => execSync(packageManagerCmd.install, execAppOptions)).not.toThrow();

    execSync(`${packageManagerCmd.exec} ng g @o3r/core:store-entity-async --defaults=true --store-name="test-entity-async" --model-name="Bound" --model-id-prop-name="id"`, execAppOptions);
    addImportToAppModule('TestEntityAsyncStoreModule', 'src/store/test-entity-async');

    execSync(`${packageManagerCmd.exec} ng g @o3r/core:store-entity-sync --defaults=true --store-name="test-entity-sync" --model-name="Bound" --model-id-prop-name="id"`, execAppOptions);
    addImportToAppModule('TestEntitySyncStoreModule', 'src/store/test-entity-sync');

    execSync(`${packageManagerCmd.exec} ng g @o3r/core:store-simple-async --defaults=true --store-name="test-simple-async" --model-name="Bound"`, execAppOptions);
    addImportToAppModule('TestSimpleAsyncStoreModule', 'src/store/test-simple-async');

    execSync(`${packageManagerCmd.exec} ng g @o3r/core:store-simple-sync --defaults=true --store-name="test-simple-sync"`, execAppOptions);
    addImportToAppModule('TestSimpleSyncStoreModule', 'src/store/test-simple-sync');

    execSync(`${packageManagerCmd.exec} ng g @o3r/core:service --defaults=true test-service --feature-name="base"`, execAppOptions);
    addImportToAppModule('TestServiceBaseModule', 'src/services/test-service');

    execSync(`${packageManagerCmd.exec} ng g @o3r/core:page --defaults=true test-page --app-routing-module-path="src/app/app-routing.module.ts"`, execAppOptions);

    const defaultOptions = [
      '--activate-dummy',
      '--use-otter-config=false',
      '--use-otter-theming=false',
      '--use-otter-analytics=false',
      '--use-localization=false',
      '--use-context=false',
      '--use-rules-engine=false'
    ].join(' ');
    execSync(`${packageManagerCmd.exec} ng g @o3r/core:component test-component ${defaultOptions}`, execAppOptions);
    addImportToAppModule('TestComponentContModule', 'src/components/test-component');

    const advancedOptions = [
      '--activate-dummy',
      '--use-otter-config=true',
      '--use-otter-theming=true',
      '--use-otter-analytics=true',
      '--use-localization=true',
      '--use-context=true',
      '--use-rules-engine=true'
    ].join(' ');
    execSync(`${packageManagerCmd.exec} ng g @o3r/core:component test-component-advanced ${advancedOptions}`, execAppOptions);
    addImportToAppModule('TestComponentAdvancedContModule', 'src/components/test-component-advanced');

    execSync(`${packageManagerCmd.exec} ng g @o3r/core:component --defaults=true test-add-context-component ${defaultOptions}`, execAppOptions);
    execSync(`${packageManagerCmd.exec} ng g @o3r/core:add-context --defaults=true --path="src/components/test-add-context-component/container/test-add-context-component-cont.component.ts"`,
      execAppOptions);
    addImportToAppModule('TestAddContextComponentContModule', 'src/components/test-add-context-component');

    execSync(`${packageManagerCmd.exec} ng g @schematics/angular:component test-ng-component`, execAppOptions);
    execSync(`${packageManagerCmd.exec} ng g @o3r/core:convert-component --defaults=true --path="src/app/test-ng-component/test-ng-component.component.ts"`, execAppOptions);

    expect(() => execSync(`${packageManagerCmd.run} build`, execAppOptions)).not.toThrow();

    // should pass the e2e tests
    execSync(`${packageManagerCmd.exec} ng g @o3r/testing:playwright-scenario --defaults=true --name=test-scenario`, execAppOptions);
    execSync(`${packageManagerCmd.exec} ng g @o3r/testing:playwright-sanity --defaults=true --name=test-sanity`, execAppOptions);
    spawn(`npx http-server -p ${devServerPort} ./dist`, [], {
      ...execAppOptions,
      shell: true,
      stdio: ['ignore', 'ignore', 'inherit']
    });
    execSync(`npx --yes wait-on http://127.0.0.1:${devServerPort} -t 10000`, execAppOptions);

    execSync('npx playwright install --with-deps', execAppOptions);
    expect(() => execSync(`${packageManagerCmd.run} test:playwright`, execAppOptions)).not.toThrow();
    expect(() => execSync(`${packageManagerCmd.run} test:playwright:sanity`, execAppOptions)).not.toThrow();
  });

  afterAll(async () => {
    try {
      const pid = await getPidFromPort(devServerPort);
      execSync(process.platform === 'win32' ? `taskkill /f /t /pid ${pid}` : `kill -15 ${pid}`, {stdio: 'inherit'});
    } catch (e) {
      // http-server already off
    }
  });
});
