import * as Promise from 'bluebird';
import { Session, UniversalBot } from 'botbuilder';
import { applyHandoffEventListeners } from './middleware/applyHandoffEventListeners';
import { getAddAddressesForHandoffMessageMiddleware } from './middleware/getAddAddressesForHandoffMessageMiddleware';
import { getRouteMessgeMiddleware } from './middleware/getRouteMessageMiddleware';
import { getTranscribeBotMessagesMiddleware } from './middleware/getTranscribeBotMessagesMiddleware';
import { getTranscribeNonBotMessagesMiddleware } from './middleware/getTranscribeNonBotMessagesMiddleware';
import { defaultHandoffOptions, IHandoffOptions } from './options/IHandoffOptions';
import { IProvider } from './provider/IProvider';
import { InMemoryProvider } from './provider/prebuilt/InMemoryProvider';
import { AgentMessageRouter } from './routers/AgentMessageRouter';
import { CustomerMessageRouter } from './routers/CustomerMessageRouter';

export type IsAgentFunction = (session: Session) => boolean | Promise<boolean>;

export function applyHandoffMiddleware(
    bot: UniversalBot,
    isAgent: IsAgentFunction,
    provider: IProvider = new InMemoryProvider(),
    options?: IHandoffOptions
): void {
    // in case a consumer sends in partial definition of the event success handlers (js side), fill the missing ones with defaults
    options = Object.assign({}, defaultHandoffOptions, options);
    isAgent = Promise.method(isAgent) as IsAgentFunction;
    // while not exactly botbuilder middleware, these listeners act in the same way
    applyHandoffEventListeners(bot, provider, options.eventHandlers);

    const botbuilder = [
        getAddAddressesForHandoffMessageMiddleware(isAgent as (s: Session) => Promise<boolean>)
    ];

    if (options.shouldTranscribeMessages) {
        botbuilder.push(getTranscribeNonBotMessagesMiddleware(provider));
    }

    botbuilder.push(
        getRouteMessgeMiddleware(
            new CustomerMessageRouter(bot, provider, options.messageReceivedWhileWaitingHandler), new AgentMessageRouter(bot, provider)));

    const send = [];

    if (options.shouldTranscribeMessages) {
        send.push(getTranscribeBotMessagesMiddleware(provider));
    }

    bot.use({
        send,
        botbuilder
    });
}
