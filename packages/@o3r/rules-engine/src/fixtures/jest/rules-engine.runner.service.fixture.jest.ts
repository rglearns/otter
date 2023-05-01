import type {Fact, Operator, RulesEngineRunnerService, UnaryOperator} from '@o3r/rules-engine';

/** @deprecated use RulesEngineRunnerServiceFixture instead, will be removed in Otter v10 */
export class RulesEngineServiceFixture implements Readonly<Partial<RulesEngineRunnerService>> {

  /** @inheritDoc */
  public upsertFacts: jest.Mock<void, [Fact<unknown> | Fact<unknown>[]]> = jest.fn();

  /** @inheritDoc */
  public upsertOperators: jest.Mock<void, [(Operator<any, any> | UnaryOperator<any>)[]]> = jest.fn();

  /** @inheritDoc */
  public enableRuleSetFor: jest.Mock<void, [string]> = jest.fn();

  /** @inheritDoc */
  public disableRuleSetFor: jest.Mock<void, [string]> = jest.fn();
}
