import type {
  VersionedMessage,
} from '@amadeus-it-group/microfrontends';
import type {
  NAVIGATION_MESSAGE_TYPE,
} from './base';

/**
 * The navigation message object sent via the communication protocol.
 * Used in microfrontend architecture based on iframes where an iframe change its url and notify its parent with the url change
 * The parent should update its own url with the information received in order to allow the refresh and the deep link share
 */
export interface NavigationV1_0 extends VersionedMessage {
  /** @inheritdoc */
  type: typeof NAVIGATION_MESSAGE_TYPE;
  /** @inheritdoc */
  version: '1.0';
  /** The url updated */
  url: string;
  /**
   * Subset of Angular NavigationExtras forwarded across the iframe boundary so the receiving
   * router reproduces the original history/location semantics (e.g. skipping a route from history).
   */
  extras?: {
    /** Navigate while replacing the current history entry instead of pushing a new one. */
    replaceUrl?: boolean;
  };
}
