/**
 * Minimum action field
 */
export interface RulesEngineAction<A extends string = string> {
  /** Type of the action */
  actionType: A;
  /** Generic value of the action */
  value: any;
}

/**
 * Action handler executed by the rules engine
 */
export interface RulesEngineActionHandler<T extends RulesEngineAction = RulesEngineAction> {
  /**
   * Execute the actions resulting of the rules engine
   *
   * @param actions List of actions executed by the rules engine
   */
  executeAction(actions: T[]): void | Promise<void>;

  /**
   * Actions supported by the handler
   */
  supportingActions: readonly T['actionType'][];
}
