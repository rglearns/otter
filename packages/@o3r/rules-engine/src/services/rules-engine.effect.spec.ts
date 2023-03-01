import {TestBed} from '@angular/core/testing';
import {provideMockActions} from '@ngrx/effects/testing';
import {TypedAction} from '@ngrx/store/src/models';
import {SetAsyncStoreItemEntityActionPayload} from '@o3r/core';
import {firstValueFrom, of, ReplaySubject, Subject, Subscription} from 'rxjs';
import {PlaceholderTemplateModel, PlaceholderTemplateReply, setPlaceholderTemplateEntityFromUrl} from '@o3r/components';
import {DynamicContentService} from '@o3r/dynamic-content';
import {LocalizationService} from '@o3r/localization';
import {shareReplay} from 'rxjs/operators';
import {RulesEngineService} from './rules-engine.service';
import {PlaceholderTemplateResponseEffect} from './rules-engine.effect';

describe('Rules Engine Effects', () => {
  let effect: PlaceholderTemplateResponseEffect;
  let actions: Subject<any>;
  let factsStream: { [key: string]: Subject<any> };
  const translations: { [key: string]: string } = {
    localisationkey: 'This is a test with a { parameter }'
  };


  const subscriptions: Subscription[] = [];

  afterEach(() => subscriptions.forEach((subscription) => subscription.unsubscribe()));

  beforeEach(async () => {
    actions = new ReplaySubject(1);
    factsStream = {
      myFact: new ReplaySubject(1),
      factInTemplate: new ReplaySubject(1),
      parameter: new ReplaySubject(1)
    };
    await TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions),
        PlaceholderTemplateResponseEffect,
        {
          provide: RulesEngineService,
          useValue: {
            engine: {
              retrieveOrCreateFactStream: (fact: string) => factsStream[fact]
            }
          }
        },
        {
          provide: DynamicContentService,
          useValue: {getMediaPathStream: () => of('fakeUrl')}
        },
        {
          provide: LocalizationService,
          useValue: {
            translate: (keyText: string, parameters?: { [key: string]: any }) => of(
              Object.entries(parameters)
                .reduce(
                  (acc: string, [paramKey, paramValue]: [string, any]) =>
                    acc.replace(`{ ${paramKey} }`, paramValue),
                  translations[keyText] || ''
                )
            )
          }
        }
      ]
    }).compileComponents();

    effect = TestBed.inject(PlaceholderTemplateResponseEffect);
  });

  it('Check if effect is correctly injected', () => {
    expect(effect).toBeDefined();
  });

  it('should resolve vars', async () => {
    const setPlaceholderEffect$ = effect.setPlaceholderTemplateEntityFromCall$.pipe(shareReplay(1));
    const response: PlaceholderTemplateReply = {
      vars: {
        myRelPath: {
          type: 'relativeUrl',
          value: 'assets-demo-app/img/logo/logo-positive.png'
        },
        test: {
          type: 'localisation',
          value: 'localisationkey',
          vars: ['parameterForLoc']
        },
        parameterForLoc: {
          type: 'fact',
          value: 'parameter'
        },
        factInTemplate: {
          type: 'fact',
          value: 'factInTemplate'
        }
      },
      template: '<img src=\'<%= myRelPath %>\'> <div><%= test %></div><span><%= factInTemplate %></span>'
    };
    actions.next(setPlaceholderTemplateEntityFromUrl({
      call: Promise.resolve(response),
      id: 'placeholder1',
      url: 'myPlaceholderUrl',
      resolvedUrl: 'myPlaceholderResolvedUrl'
    }));
    factsStream.myFact.next('ignored');
    factsStream.parameter.next('success');
    factsStream.factInTemplate.next('Outstanding fact');

    const result = (await firstValueFrom(setPlaceholderEffect$)) as SetAsyncStoreItemEntityActionPayload<PlaceholderTemplateModel>
      & TypedAction<'[PlaceholderTemplate] set entity'>;
    expect(result.type).toBe('[PlaceholderTemplate] set entity');
    expect(result.entity.renderedTemplate).toBe('<img src=\'fakeUrl\'> <div>This is a test with a success</div><span>Outstanding fact</span>');
    expect(result.entity.unknownTypeFound).toBeFalsy();
  });

  it('should notify user some vars have an unknown type', async () => {
    const setPlaceholderEffect$ = effect.setPlaceholderTemplateEntityFromCall$.pipe(shareReplay(1));
    const response: any = {
      vars: {
        test: {
          type: 'invalidType',
          value: 'test'
        }
      },
      template: '<div><%= test %></div>'
    };
    actions.next(setPlaceholderTemplateEntityFromUrl({
      call: Promise.resolve(response),
      id: 'placeholder2',
      url: 'myPlaceholderUrl',
      resolvedUrl: 'myPlaceholderResolvedUrl2'
    }));
    factsStream.myFact.next('ignored');
    const result = (await firstValueFrom(setPlaceholderEffect$)) as SetAsyncStoreItemEntityActionPayload<PlaceholderTemplateModel>
      & TypedAction<'[PlaceholderTemplate] set entity'>;
    expect(result.entity.unknownTypeFound).toBeTruthy();
    expect(result.entity.renderedTemplate).toBe('<div><%= test %></div>');
  });
});
