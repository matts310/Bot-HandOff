import * as Promise from 'bluebird';
import { Session, UniversalBot } from 'botbuilder';
import { defaultSuccessHandlers, EventSuccessHandlers } from './EventSuccessHandlers';
import { applyHandoffEventListeners } from './middleware/applyHandoffEventListeners';
import { getAddAddressesForHandoffMessageMiddleware } from './middleware/getAddAddressesForHandoffMessageMiddleware';
import { getRouteMessgeMiddleware } from './middleware/getRouteMessageMiddleware';
import { getTranscribeBotMessagesMiddleware } from './middleware/getTranscribeBotMessagesMiddleware';
import { getTranscribeNonBotMessagesMiddleware } from './middleware/getTranscribeNonBotMessagesMiddleware';
import { IProvider } from './provider/IProvider';
import { InMemoryProvider } from './provider/prebuilt/InMemoryProvider';
import { routeAgentMessage } from './routers/routeAgentMessage';
import { routeCustomerMessage } from './routers/routeCustomerMessage';

export type IsAgentFunction = (session: Session) => Promise<boolean>;

export function applyHandoffMiddleware(
    bot: UniversalBot,
    isAgent: IsAgentFunction,
    provider: IProvider = new InMemoryProvider(),
    eventSuccessHandlers: EventSuccessHandlers = defaultSuccessHandlers
): void {
    // in case a consumer sends in partial definition of the event success handlers (js side), fill the missing ones with defaults
    eventSuccessHandlers = Object.assign({}, defaultSuccessHandlers, eventSuccessHandlers );

    // while not exactly botbuilder middleware, these listeners act in the same way
    applyHandoffEventListeners(bot, provider, eventSuccessHandlers);

    const botbuilder = [
        getAddAddressesForHandoffMessageMiddleware(isAgent),
        getTranscribeNonBotMessagesMiddleware(provider),
        getRouteMessgeMiddleware(routeCustomerMessage(bot, provider), routeAgentMessage(bot, provider))
    ];
    const send = [
        getTranscribeBotMessagesMiddleware(provider)
    ];

    bot.use({
        send,
        botbuilder
    });
}
