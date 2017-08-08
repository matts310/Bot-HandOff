import * as Promise from 'bluebird';
import { IAddress, IMessage, Message, Session, UniversalBot } from 'botbuilder';
import { ConversationState, MessageType } from './constants';
import { IConversation } from './IConversation';
import { applyHandoffEventListeners } from './middleware/applyHandoffEventListeners';
import { getAddAddressesForHandoffMessageMiddleware } from './middleware/getAddAddressesForHandoffMessageMiddleware';
import { getRouteMessgeMiddleware } from './middleware/getRouteMessageMiddleware';
import { getTranscribeBotMessagesMiddleware } from './middleware/getTranscribeBotMessagesMiddleware';
import { getTranscribeNonBotMessagesMiddleware } from './middleware/getTranscribeNonBotMessagesMiddleware';
import { InMemoryProvider } from './provider/InMemoryProvider';
import { IProvider } from './provider/IProvider';
import { routeAgentMessage } from './routers/routeAgentMessage';
import { routeCustomerMessage } from './routers/routeCustomerMessage';

export type IsAgentFunction = (session: Session) => Promise<boolean>;

export function applyHandoffMiddleware(bot: UniversalBot, isAgent: IsAgentFunction, provider: IProvider = new InMemoryProvider()): void {
    // while not exactly botbuilder middleware, these listeners act in the same way
    applyHandoffEventListeners(bot, provider);

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
