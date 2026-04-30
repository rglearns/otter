import {
  NavigationMessage,
  NavigationV1_0,
} from '@ama-mfe/messages';
import {
  MessagePeerService,
} from '@amadeus-it-group/microfrontends-angular';
import {
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  TestBed,
} from '@angular/core/testing';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
} from '@angular/router';
import {
  LoggerService,
} from '@o3r/logger';
import {
  Subject,
} from 'rxjs';
import {
  ConsumerManagerService,
  ProducerManagerService,
} from '../managers/index';
import type {
  ErrorContent,
} from '../messages/error';
import {
  RoutingService,
} from './routing-service';

describe('Navigation Producer Service', () => {
  let routingService: RoutingService;
  let producerManagerService: ProducerManagerService;
  let messageService: MessagePeerService<NavigationMessage>;
  let loggerServiceMock: jest.Mocked<LoggerService>;

  let routerEventsSubject: Subject<any>;
  let mockRouter: Partial<Router>;
  let router: Router;
  let mockedWindow: Window;

  beforeEach(() => {
    routerEventsSubject = new Subject<any>();
    mockRouter = {
      events: routerEventsSubject.asObservable(),
      navigateByUrl: jest.fn(),
      getCurrentNavigation: jest.fn()
    };

    const consumerManagerServiceMock: Partial<ConsumerManagerService> = {
      register: jest.fn(),
      unregister: jest.fn()
    };
    const producerManagerServiceMock = {
      register: jest.fn(),
      unregister: jest.fn()
    };
    const messageServiceMock = {
      send: jest.fn(),
      id: 'self-id',
      // By default, a single host peer is known and supports both navigation versions.
      knownPeers: new Map<string, { type: string; version?: string }[]>([
        ['host-peer-id', [
          { type: 'navigation', version: '1.0' },
          { type: 'navigation', version: '1.1' }
        ]]
      ])
    };

    loggerServiceMock = {
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as jest.Mocked<LoggerService>;

    mockedWindow = { ...globalThis.window };

    TestBed.configureTestingModule({
      providers: [
        RoutingService,
        { provide: LoggerService, useValue: loggerServiceMock },
        { provide: Router, useValue: mockRouter },
        { provide: ProducerManagerService, useValue: consumerManagerServiceMock },
        { provide: ConsumerManagerService, useValue: producerManagerServiceMock },
        { provide: MessagePeerService, useValue: messageServiceMock },
        { provide: ActivatedRoute, useValue: { routeConfig: { path: 'test-path' } } },
        { provide: Window, useValue: mockedWindow }
      ]
    });

    routingService = TestBed.inject(RoutingService);
    messageService = TestBed.inject(MessagePeerService<NavigationMessage>);
    producerManagerService = TestBed.inject(ProducerManagerService);
    router = TestBed.inject(Router);
  });

  it('should register itself when instantiated', () => {
    jest.spyOn(producerManagerService, 'register');
    expect(producerManagerService.register).toHaveBeenCalledWith(routingService);
  });

  it('should send a v1.1 navigation message (without extras) to a v1.1-capable peer when embedded', () => {
    Object.defineProperty(mockedWindow, 'top', { value: globalThis.window.top });
    Object.defineProperty(mockedWindow, 'self', { value: mockedWindow });
    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(messageService.send).toHaveBeenCalledWith({
      type: 'navigation',
      version: '1.1',
      url: 'end-url'
    }, { to: ['host-peer-id'] });
  });

  it('should send a v1.0 navigation message to a v1.0-only peer when embedded', () => {
    Object.defineProperty(mockedWindow, 'top', { value: globalThis.window.top });
    Object.defineProperty(mockedWindow, 'self', { value: mockedWindow });
    (messageService as any).knownPeers = new Map([
      ['host-peer-id', [{ type: 'navigation', version: '1.0' }]]
    ]);

    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(messageService.send).toHaveBeenCalledWith({
      type: 'navigation',
      version: '1.0',
      url: 'end-url'
    }, { to: ['host-peer-id'] });
  });

  it('should send a v1.1 navigation message with replaceUrl extra to a v1.1-capable peer when embedded', () => {
    Object.defineProperty(mockedWindow, 'top', { value: globalThis.window.top });
    Object.defineProperty(mockedWindow, 'self', { value: mockedWindow });
    jest.spyOn(router, 'getCurrentNavigation').mockReturnValue({ extras: { replaceUrl: true } } as any);

    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(messageService.send).toHaveBeenCalledWith({
      type: 'navigation',
      version: '1.1',
      url: 'end-url',
      extras: { replaceUrl: true }
    }, { to: ['host-peer-id'] });
  });

  it('should drop the replaceUrl extra when falling back to v1.0 for a v1.0-only peer', () => {
    Object.defineProperty(mockedWindow, 'top', { value: globalThis.window.top });
    Object.defineProperty(mockedWindow, 'self', { value: mockedWindow });
    (messageService as any).knownPeers = new Map([
      ['host-peer-id', [{ type: 'navigation', version: '1.0' }]]
    ]);
    jest.spyOn(router, 'getCurrentNavigation').mockReturnValue({ extras: { replaceUrl: true } } as any);

    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(messageService.send).toHaveBeenCalledWith({
      type: 'navigation',
      version: '1.0',
      url: 'end-url'
    }, { to: ['host-peer-id'] });
  });

  it('should skip peers that do not declare navigation support at all', () => {
    Object.defineProperty(mockedWindow, 'top', { value: globalThis.window.top });
    Object.defineProperty(mockedWindow, 'self', { value: mockedWindow });
    (messageService as any).knownPeers = new Map([
      ['unrelated-peer', [{ type: 'theme', version: '1.0' }]]
    ]);

    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(messageService.send).not.toHaveBeenCalled();
  });

  it('should send a v1.1 navigation message with replaceUrl extra when not embedded', () => {
    (messageService as any).knownPeers = new Map([
      ['test-channel-id', [
        { type: 'navigation', version: '1.0' },
        { type: 'navigation', version: '1.1' }
      ]]
    ]);
    jest.spyOn(router, 'getCurrentNavigation').mockReturnValue({ extras: { replaceUrl: true, state: { channelId: 'test-channel-id' } } } as any);

    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(messageService.send).toHaveBeenCalledWith({
      type: 'navigation',
      version: '1.1',
      url: 'end-url',
      extras: { replaceUrl: true }
    }, { to: ['test-channel-id'] });
  });

  it('should forward received v1.1 Navigation message with replaceUrl extra to the router', () => {
    TestBed.runInInjectionContext(() => {
      void routingService.supportedVersions['1.1']({
        from: 'sender',
        to: ['receiver'],
        payload: {
          type: 'navigation',
          version: '1.1',
          url: '/test',
          extras: { replaceUrl: true }
        }
      });

      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/test', { state: { triggeredByMessage: true }, replaceUrl: true });
    });
  });

  it('should not send navigation message via messageService if embedded, if the skipLocationChange is true', () => {
    Object.defineProperty(mockedWindow, 'top', { value: globalThis.window.top });
    Object.defineProperty(mockedWindow, 'self', { value: mockedWindow });
    jest.spyOn(router, 'getCurrentNavigation').mockReturnValue({ extras: { skipLocationChange: true } } as any);

    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(messageService.send).not.toHaveBeenCalled();
  });

  it('should forward received Navigation message to the router', () => {
    TestBed.runInInjectionContext(() => {
      expect(Object.keys(routingService.supportedVersions)).toEqual(['1.0', '1.1']);

      void routingService.supportedVersions['1.0']({
        from: 'sender',
        to: ['receiver'],
        payload: {
          type: 'navigation',
          version: '1.0',
          url: '/test'
        }
      });

      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/test', { state: { triggeredByMessage: true } });
    });
  });

  it('should send navigation message via endpointManagerService if channelId is present and not embedded', () => {
    (messageService as any).knownPeers = new Map([
      ['test-channel-id', [{ type: 'navigation', version: '1.0' }]]
    ]);
    jest.spyOn(router, 'getCurrentNavigation').mockReturnValue({ extras: { state: { channelId: 'test-channel-id' } } } as any);

    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(messageService.send).toHaveBeenCalledWith({
      type: 'navigation',
      version: '1.0',
      url: 'end-url'
    }, { to: ['test-channel-id'] });
  });

  it('should send a v1.1 navigation message (without extras) to a v1.1-capable peer when not embedded', () => {
    (messageService as any).knownPeers = new Map([
      ['test-channel-id', [
        { type: 'navigation', version: '1.0' },
        { type: 'navigation', version: '1.1' }
      ]]
    ]);
    jest.spyOn(router, 'getCurrentNavigation').mockReturnValue({ extras: { state: { channelId: 'test-channel-id' } } } as any);

    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(messageService.send).toHaveBeenCalledWith({
      type: 'navigation',
      version: '1.1',
      url: 'end-url'
    }, { to: ['test-channel-id'] });
  });

  it('should log an error if endpointManagerService.send throws an error', () => {
    (messageService as any).knownPeers = new Map([
      ['test-channel-id', [{ type: 'navigation', version: '1.0' }]]
    ]);
    jest.spyOn(router, 'getCurrentNavigation').mockReturnValue({ extras: { state: { channelId: 'test-channel-id' } } } as any);
    jest.spyOn(messageService, 'send').mockImplementation(() => {
      throw new Error('send error');
    });

    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(loggerServiceMock.error).toHaveBeenCalledWith('Error sending navigation message', expect.objectContaining({ message: 'send error' }));
  });

  it('should warn if no channelId is provided and not embedded', () => {
    runInInjectionContext(TestBed.inject(Injector), () => {
      routingService.handleEmbeddedRouting();
    });

    routerEventsSubject.next(new NavigationEnd(1, 'start-url', 'end-url'));

    expect(loggerServiceMock.warn).toHaveBeenCalledWith('No channelId provided for navigation message');
  });

  it('should handle errors', () => {
    const errorMessage: ErrorContent<NavigationV1_0> = { reason: 'unknown_type', source: { type: 'navigation', version: '1.0', url: '' } };

    routingService.handleError(errorMessage);

    expect(loggerServiceMock.error).toHaveBeenCalledWith('Error in navigation service message', errorMessage);
  });
});
