import { apply, chain, externalSchematic, MergeStrategy, mergeWith, move, noop, renameTemplateFiles, Rule, schematic, SchematicContext, template, Tree, url } from '@angular-devkit/schematics';
import {
  addImportsAndCodeBlockStatementAtSpecInitializationTransformerFactory,
  addImportsIntoComponentDecoratorTransformerFactory,
  addImportsRule,
  applyEsLintFix,
  getComponentFileName,
  getComponentFolderName,
  getComponentModuleName,
  getComponentName,
  getComponentSelectorWithoutSuffix,
  getDestinationPath,
  getInputComponentName,
  getProjectFromTree
} from '@o3r/schematics';
import * as path from 'node:path';
import * as ts from 'typescript';
import { getAddConfigurationRules } from '../common/configuration';
import { ComponentStructureDef } from '../structures.types';
import { NgGenerateComponentContainerSchematicsSchema } from './schema';
import { getAddFixtureRules } from '../common/fixture';
import { getAddContextRules } from '../common/context';
import { PRESENTER_FOLDER } from '../presenter';
import { addImportToModule } from '@schematics/angular/utility/ast-utils';
import { applyToUpdateRecorder, InsertChange } from '@schematics/angular/utility/change';

export const CONTAINER_FOLDER = 'container';

/**
 * Generates the template properties
 *
 * @param options
 * @param componentStructureDef
 * @param prefix
 */
const getTemplateProperties = (options: NgGenerateComponentContainerSchematicsSchema, componentStructureDef: ComponentStructureDef, prefix?: string) => {

  const inputComponentName = getInputComponentName(options.componentName);
  const folderName = getComponentFolderName(inputComponentName);

  return {
    ...options,
    componentType: options.componentStructure === 'full' ? 'Block' : 'Component',
    presenterModuleName: getComponentModuleName(inputComponentName, ComponentStructureDef.Pres),
    componentName: getComponentName(inputComponentName, componentStructureDef).replace(/Component$/, ''),
    presenterComponentName: getComponentName(inputComponentName, ComponentStructureDef.Pres),
    componentSelector: getComponentSelectorWithoutSuffix(options.componentName, prefix || null),
    folderName,
    name: getComponentFileName(options.componentName, componentStructureDef), // air-offer | air-offer-cont,
    suffix: componentStructureDef.toLowerCase() // cont | '',
  };
};

/**
 * Add Otter container component to an Angular Project
 *
 * @param options
 */
export function ngGenerateComponentContainer(options: NgGenerateComponentContainerSchematicsSchema): Rule {

  const fullStructureRequested = options.componentStructure === 'full';

  const generateFiles = async (tree: Tree, context: SchematicContext) => {

    const workspaceProject = getProjectFromTree(tree);

    const properties = getTemplateProperties(options, ComponentStructureDef.Cont, options.prefix ? options.prefix : workspaceProject?.prefix);

    const destination = getDestinationPath('@o3r/core:component', options.path, tree);
    const componentDestination = path.join(destination, fullStructureRequested ? path.join(properties.folderName, CONTAINER_FOLDER) : properties.folderName);
    const componentPath = path.join(componentDestination, `${properties.name}.component.ts`);
    const specPath = path.join(componentDestination, `${properties.name}.spec.ts`);

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
        style: 'none',
        type: 'Component',
        skipSelector: false,
        skipTests: false,
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

    if (fullStructureRequested) {
      const componentPresenterDestination = path.join(destination, properties.folderName, PRESENTER_FOLDER);
      const addPresenterComponentOrModuleToImport: Rule = options.standalone
        ? chain([
          addImportsRule(componentPath, [
            {
              from: `${componentPresenterDestination}/index`,
              importNames: [properties.presenterComponentName]
            }
          ]),
          () => {
            const componentSourceFile = ts.createSourceFile(
              componentPath,
              tree.readText(componentPath),
              ts.ScriptTarget.ES2020,
              true
            );

            const result = ts.transform(componentSourceFile, [
              addImportsIntoComponentDecoratorTransformerFactory([properties.presenterComponentName])
            ]);

            const printer = ts.createPrinter({
              removeComments: false,
              newLine: ts.NewLineKind.LineFeed
            });

            tree.overwrite(componentPath, printer.printFile(result.transformed[0] as any as ts.SourceFile));
            return tree;
          }
        ])
        : () => {
          const modulePath = path.join(componentDestination, `${properties.name}.module.ts`);
          const moduleSourceFile = ts.createSourceFile(
            modulePath,
            tree.readText(modulePath),
            ts.ScriptTarget.ES2020,
            true
          );
          const changes = addImportToModule(moduleSourceFile, modulePath, properties.presenterModuleName, componentPresenterDestination);
          const recorder = tree.beginUpdate(modulePath);
          applyToUpdateRecorder(recorder, changes);
          tree.commitUpdate(recorder);
          return tree;
        };

      const addMockPresenterComponentInSpecFile: Rule = () => {
        if (!tree.exists(specPath)) {
          context.logger.warn(`No update applied on spec file because ${specPath} does not exist.`);
          return;
        }

        let specSourceFile = ts.createSourceFile(
          specPath,
          tree.readText(specPath),
          ts.ScriptTarget.ES2020,
          true
        );

        const recorder = tree.beginUpdate(specPath);

        const lastImport = [...specSourceFile.statements].reverse().find((statement) =>
          ts.isImportDeclaration(statement)
        );

        const changes = [new InsertChange(specPath, lastImport?.getEnd() || 0, `
@Component({
  template: '',
  selector: '${properties.componentSelector}-${ComponentStructureDef.Pres.toLowerCase()}',
  standalone: true
})
class Mock${properties.presenterComponentName} {}
        `)];

        applyToUpdateRecorder(recorder, changes);
        tree.commitUpdate(recorder);

        specSourceFile = ts.createSourceFile(
          specPath,
          tree.readText(specPath),
          ts.ScriptTarget.ES2020,
          true
        );

        const result = ts.transform(specSourceFile, [
          addImportsAndCodeBlockStatementAtSpecInitializationTransformerFactory([
            `Mock${properties.presenterComponentName}`
          ])
        ]);

        const printer = ts.createPrinter({
          removeComments: false,
          newLine: ts.NewLineKind.LineFeed
        });

        const newContent = printer.printFile(result.transformed[0] as any as ts.SourceFile);

        tree.overwrite(specPath, newContent);

        return tree;
      };

      rules.push(
        addPresenterComponentOrModuleToImport,
        addMockPresenterComponentInSpecFile
      );
    }

    const configurationRules = await getAddConfigurationRules(
      componentPath,
      options,
      context
    );
    rules.push(...configurationRules);

    const fixtureRules = await getAddFixtureRules(
      componentPath,
      options,
      context
    );
    rules.push(...fixtureRules);

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
