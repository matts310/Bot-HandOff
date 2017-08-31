import { IAddress, Message, UniversalBot } from 'botbuilder';
import { HandoffEventMessage } from '../eventMessages/HandoffEventMessage';
import { defaultFailureHandler, EventFailureHandler } from './EventFailureHandlers';
import { EventSuccessHandler } from './EventSuccessHandlers';

export interface IEventHandler {
    success: EventSuccessHandler;
    failure: EventFailureHandler;
}

export interface IEventHandlers {
    connect: IEventHandler;
    disconnect: IEventHandler;
    queue: IEventHandler;
    dequeue: IEventHandler;
    watch: IEventHandler;
    unwatch: IEventHandler;
}

export const defaultEventHandlers: IEventHandlers = {
    connect: {
        success: (bot: UniversalBot, eventMessage: HandoffEventMessage) =>
            sendTextToAddress(bot, 'you\'re now connected to an agent', eventMessage.customerAddress),
        failure: defaultFailureHandler
    },
    disconnect: {
        success: (bot: UniversalBot, eventMessage: HandoffEventMessage) =>
        sendTextToAddress(bot, 'you\'ve disconnected from the agent', eventMessage.customerAddress),
        failure: defaultFailureHandler
    },
    queue: {
        success: (bot: UniversalBot, eventMessage: HandoffEventMessage) =>
            sendTextToAddress(
                bot,
                'you\'re all set to talk to an agent. One will be with you as soon as they become available',
                eventMessage.customerAddress),
        failure: defaultFailureHandler
    },
    dequeue: {
        success: (bot: UniversalBot, eventMessage: HandoffEventMessage) =>
            sendTextToAddress(bot, 'you\'re no longer in line for an agent', eventMessage.customerAddress),
        failure: defaultFailureHandler
    },
    watch: {
        success: (bot: UniversalBot, eventMessage: HandoffEventMessage) => {},
        failure: defaultFailureHandler
    },
    unwatch: {
        success: (bot: UniversalBot, eventMessage: HandoffEventMessage) => {},
        failure: defaultFailureHandler
    }
};

function sendTextToAddress(bot: UniversalBot, text: string, address: IAddress): void {
    const msg = new Message()
        .text(text)
        .address(address)
        .toMessage();

    bot.send(msg);
}
