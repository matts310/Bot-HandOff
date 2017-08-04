import * as Promise from 'bluebird';
import { IAddress, IMessage, Message, Session, UniversalBot } from 'botbuilder';
import { ConversationState, MessageType } from './constants';
import { IConversation } from './IConversation';
import { IHandoffEventMessage, isIHandoffEventMessage } from './IHandoffMessage';
// import { IHandoffEventMessage, isIHandoffEventMessage } from './IHandoffEventMessage';

import { getAddAddressesForHandoffMessageMiddleware } from './middleware/getAddAddressesForHandoffMessageMiddleware';
import { getHandoffMessageEventInterceptor } from './middleware/getHandoffMessageEventInterceptor';
import { getRouteMessgeMiddleware } from './middleware/getRouteMessageMiddleware';
import { getTranscribeBotMessagesMiddleware } from './middleware/getTranscribeBotMessagesMiddleware';
import { getTranscribeNonBotMessagesMiddleware } from './middleware/getTranscribeNonBotMessagesMiddleware';
import { IProvider } from './provider/IProvider';
import { routeAgentMessage } from './routers/routeAgentMessage';
import { routeCustomerMessage } from './routers/routeCustomerMessage';

export type IsAgentFunction = (session: Session) => Promise<boolean>;

export function applyHandoffMiddleware(bot: UniversalBot, provider: IProvider, isAgent: IsAgentFunction): void {
    const receive = [
        getHandoffMessageEventInterceptor(bot, provider)
    ];

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
        receive,
        botbuilder
    });
}
