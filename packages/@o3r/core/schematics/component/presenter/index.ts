import {
  apply,
  chain,
  externalSchematic,
  MergeStrategy,
  mergeWith,
  move,
  noop,
  renameTemplateFiles,
  Rule,
  schematic,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { applyEsLintFix } from '@o3r/schematics';
import * as path from 'node:path';
import {
  getComponentFileName,
  getComponentFolderName,
  getComponentName,
  getComponentSelectorWithoutSuffix,
  getDestinationPath, getInputComponentName,
  getLibraryNameFromPath, getProjectFromTree
} from '@o3r/schematics';
import { getAddAnalyticsRules } from '../common/analytics';
import { getAddConfigurationRules } from '../common/configuration';
import { getAddContextRules } from '../common/context';
import { getAddFixtureRules } from '../common/fixture';
import { getAddLocalizationRules } from '../common/localization';
import { getAddThemingRules } from '../common/theming';
import { NgGenerateComponentSchematicsSchema } from '../schema';
import { ComponentStructureDef } from '../structures.types';

export const PRESENTER_FOLDER = 'presenter';

/**
 * Generates the template properties
 *
 * @param options
 * @param componentStructureDef
 * @param prefix
 */
const getTemplateProperties = (options: NgGenerateComponentSchematicsSchema, componentStructureDef: ComponentStructureDef, prefix?: string) => {
  const inputComponentName = getInputComponentName(options.componentName);
  const folderName = getComponentFolderName(inputComponentName);

  return {
    ...options,
    componentName: getComponentName(inputComponentName, componentStructureDef).replace(/Component$/, ''),
    componentSelector: getComponentSelectorWithoutSuffix(options.componentName, prefix || null),
    projectName: options.projectName || getLibraryNameFromPath(options.path),
    folderName,
    name: getComponentFileName(options.componentName, componentStructureDef), // air-offer | air-offer-pres
    suffix: componentStructureDef.toLowerCase() // pres | ''
  };
};

/**
 * Add Otter component to an Angular Project
 *
 * @param options
 */
export function ngGenerateComponentPresenter(options: NgGenerateComponentSchematicsSchema): Rule {

  const fullStructureRequested = options.componentStructure === 'full';

  const generateFiles = async (tree: Tree, context: SchematicContext) => {

    const workspaceProject = getProjectFromTree(tree);

    const properties = getTemplateProperties(options, ComponentStructureDef.Pres, options.prefix ? options.prefix : workspaceProject?.prefix);

    const destination = getDestinationPath('@o3r/core:component', options.path, tree);
    const componentDestination = path.join(destination, fullStructureRequested ? path.join(properties.folderName, PRESENTER_FOLDER) : properties.folderName);
    const componentPath = path.join(componentDestination, `${properties.name}.component.ts`);
    const specPath = path.join(componentDestination, `${properties.name}.spec.ts`);
    const stylePath = path.join(componentDestination, `${properties.name}.component.scss`);

    const rules: Rule[] = [];

    rules.push(
      mergeWith(apply(url('./templates'), [
        template(properties),
        renameTemplateFiles(),
        move(componentDestination)
      ]), MergeStrategy.Overwrite),
      externalSchematic('@schematics/angular', 'component', {
        selector: `${properties.componentSelector}-${properties.suffix}`,
        path: componentDestination,
        name: properties.componentName,
        inlineStyle: false,
        inlineTemplate: false,
        viewEncapsulation: 'None',
        changeDetection: 'OnPush',
        style: 'scss',
        type: 'Component',
        skipSelector: false,
        standalone: options.standalone,
        skipImport: true,
        flat: true
      }),
      // Angular schematics generate spec file with this pattern: component-name.component.spec.ts
      move(componentPath.replace(/.ts$/, '.spec.ts'), specPath),
      schematic('convert-component', {
        path: componentPath,
        skipLinter: options.skipLinter
      })
    );

    if (!options.standalone) {
      rules.push(
        externalSchematic('@schematics/angular', 'module', {
          path: componentDestination,
          flat: true,
          name: properties.componentName
        })
      );
    }

    const configurationRules = await getAddConfigurationRules(
      componentPath,
      options,
      context
    );
    rules.push(...configurationRules);

    const themingRules = await getAddThemingRules(
      stylePath,
      options,
      context
    );
    rules.push(...themingRules);

    const localizationRules = await getAddLocalizationRules(
      componentPath,
      options,
      context
    );
    rules.push(...localizationRules);

    const fixtureRules = await getAddFixtureRules(
      componentPath,
      options,
      context
    );
    rules.push(...fixtureRules);

    const analyticsRules = await getAddAnalyticsRules(
      componentPath,
      options,
      context
    );

    rules.push(...analyticsRules);
    const contextRules = await getAddContextRules(
      componentPath,
      options,
      context
    );
    rules.push(...contextRules);

    return chain(rules);
  };

  return chain([
    generateFiles,
    !fullStructureRequested ? options.skipLinter ? noop() : applyEsLintFix() : noop()
  ]);
}
