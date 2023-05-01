import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import type { RulesEngineActionHandler } from '@o3r/core';
import { computeConfigurationName } from '../core';
import { ConfigurationStore, PropertyOverride, setConfigOverride } from '../stores';
import { ActionUpdateConfigBlock, RULES_ENGINE_CONFIGURATION_UPDATE_ACTION_TYPE } from './configuration.interfaces';

/**
 * Service to handle async Configuration actions
 */
@Injectable()
export class ConfigurationRulesEngineActionHandler implements RulesEngineActionHandler<ActionUpdateConfigBlock> {

  /** @inheritdoc */
  public readonly supportingActions = [RULES_ENGINE_CONFIGURATION_UPDATE_ACTION_TYPE] as const;

  constructor(private store: Store<ConfigurationStore>) {
  }

  /** @inheritdoc */
  public executeAction(actions: ActionUpdateConfigBlock[]): void | Promise<void> {
    const configOverrideMap = actions
      .filter((action) => action.library && action.component && action.property && typeof action.value !== 'undefined')
      .reduce<Record<string, PropertyOverride>>((acc, ov) => {
        const configName = computeConfigurationName(ov.component, ov.library);
        acc[configName] ||= { overrides: {} };
        acc[configName].overrides[ov.property] = ov.value;
        return acc;
      }, {});

    const configOverrides = Object.entries(configOverrideMap)
      .reduce<Record<string, PropertyOverride>>((acc, [key, value]) => {
        acc[key] = value.overrides;
        return acc;
      }, {});

    this.store.dispatch(setConfigOverride({ state: { configOverrides } }));
  }
}
