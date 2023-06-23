import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { NodePackageName } from '@angular-devkit/schematics/tasks/package-manager/options';
import { lastValueFrom } from 'rxjs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PackageJson } from 'type-fest';
import type { PresetOptions } from './preset.interface';

/**
 * Install dev dependency on your application
 *
 * Note: it should not be moved to other packages as it should run before the installation
 * of peer dependencies
 */
export class DevInstall extends NodePackageInstallTask {
  public quiet = false;

  /** @inheritdoc */
  public toConfiguration() {
    const installOptions = process.env?.npm_execpath?.includes('yarn') ? 'yarn' : 'npm';
    return {
      name: NodePackageName,
      options: {
        command: 'install',
        quiet: this.quiet,
        workingDirectory: this.workingDirectory,
        packageName: `${this.packageName!} ${installOptions === 'yarn' ? '--prefer-dev' : '-D'}`,
        packageManager: installOptions
      }
    };
  }
}

/**
 * Default implementation of the preset rule
 *
 * @param moduleToInstall
 */
export function defaultPresetRuleFactory(moduleToInstall: string[]) {
  const corePackageJsonContent = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'package.json'), { encoding: 'utf-8' })) as PackageJson;
  const o3rCoreVersion = corePackageJsonContent.version ? `@${corePackageJsonContent.version}` : '';

  return (options: PresetOptions = {}): Rule => {
    return async (tree, context) => {
      for (const dependency of moduleToInstall) {
        context.addTask(new DevInstall({
          packageName: dependency + o3rCoreVersion,
          hideOutput: false,
          quiet: false
        } as any));
        await lastValueFrom(context.engine.executePostTasks());
      }
      return () => chain(moduleToInstall.map((mod) => externalSchematic(mod, 'ng-add', options.forwardOptions || {})))(tree, context);
    };
  };
}
