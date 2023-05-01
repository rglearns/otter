import { NgModule } from '@angular/core';
import { AssetPathOverrideStoreModule } from '../stores/asset-path-override/asset-path-override.module';
import { AssetRulesEngineActionHandler } from './asset.handler-action';

@NgModule({
  imports: [
    AssetPathOverrideStoreModule
  ],
  providers: [
    AssetRulesEngineActionHandler
  ]
})
export class AssetRulesEngineActionModule {
}
