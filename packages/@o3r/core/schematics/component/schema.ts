import type { JsonObject } from '@angular-devkit/core';
import type { ComponentStructure } from './structures.types';

export interface NgGenerateComponentSchematicsSchema extends JsonObject {
  /** Project name */
  projectName: string | null;

  /** Name of the component to generate */
  componentName: string;

  /** Selector prefix */
  prefix: string | null;

  /** Component Structure */
  componentStructure: ComponentStructure;

  /** Description of the component generated */
  description: string | null;

  /** Component Folder */
  path: string | null;

  /** Indicates if the component should generate fixtures */
  useComponentFixtures: boolean | null;

  /** Indicates if the component should use otter theming architecture */
  useOtterTheming: boolean | null;

  /** Indicates if the component should use otter configuration */
  useOtterConfig: boolean | null;

  /** Indicates if the component should use rules-engine */
  useRulesEngine: boolean | null;

  /** Indicates if the component should use localization */
  useLocalization: boolean;

  /** Indicates if the component should use generate context */
  useContext: boolean | null;

  /** Determine if the dummy IO should be generated */
  activateDummy: boolean;

  /** Generate component with Otter analytics architecture */
  useOtterAnalytics: boolean | null;

  /** Skip the linter process */
  skipLinter: boolean;

  /** Whether the generated component is standalone */
  standalone: boolean;
}
