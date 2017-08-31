import { defaultEventHandlers, IEventHandlers } from './IEventHandlers';
import { defaultMessageReceivedWhileWaitingHandler, MessageReceivedWhileWaitingHandler } from './MessageReceivedWhileWaitingHandler';

export interface IHandoffOptions {
    shouldTranscribeMessages?: boolean;
    eventHandlers?: IEventHandlers;
    messageReceivedWhileWaitingHandler?: MessageReceivedWhileWaitingHandler;
}

export const defaultHandoffOptions: IHandoffOptions = {
    shouldTranscribeMessages: true,
    eventHandlers: defaultEventHandlers,
    messageReceivedWhileWaitingHandler: defaultMessageReceivedWhileWaitingHandler
};
