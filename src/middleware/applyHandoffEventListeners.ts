import * as Promise from 'bluebird';
import { IAddress, Message, UniversalBot } from 'botbuilder';
import { EventMessageType } from '../eventMessages/EventMessageType';
import { HandoffEventMessage } from '../eventMessages/HandoffEventMessage';
import { IConversation } from '../IConversation';
import { EventFailureHandler } from '../options/EventFailureHandlers';
import { IEventHandler, IEventHandlers } from '../options/IEventHandlers';
import { IProvider } from '../provider/IProvider';
import { ErrorEventMessage } from './../eventMessages/ErrorEventMessage';
// import { EventSuccessHandler, EventSuccessHandlers } from './../EventSuccessHandlers';

export function applyHandoffEventListeners(bot: UniversalBot, provider: IProvider, eventHandlers: IEventHandlers): void {
    return new HandoffMessageEventListnerApplicator(bot, provider, eventHandlers).applyHandoffEventListeners();
}

class HandoffMessageEventListnerApplicator {
    private provider: IProvider;
    private bot: UniversalBot;
    private eventHandlers: IEventHandlers;

    constructor(bot: UniversalBot, provider: IProvider, eventHandlers: IEventHandlers) {
        this.bot = bot;
        this.provider = provider;
        this.eventHandlers = eventHandlers;
    }

    public applyHandoffEventListeners(): void {
        this.bot.on(
            EventMessageType.Connect,
            this.wrapEventHandlerWithResultPropagator(
                this.handleConnectEvent.bind(this),
                this.eventHandlers.connect));

        this.bot.on(
            EventMessageType.Disconnect,
            this.wrapEventHandlerWithResultPropagator(
                this.handleDisconnectEvent.bind(this),
                this.eventHandlers.disconnect));

        this.bot.on(
            EventMessageType.Queue,
            this.wrapEventHandlerWithResultPropagator(
                this.handleQueueEvent.bind(this),
                this.eventHandlers.queue));

        this.bot.on(
            EventMessageType.Dequeue,
            this.wrapEventHandlerWithResultPropagator(
                this.handleDequeueEvent.bind(this),
                this.eventHandlers.dequeue));

        this.bot.on(
            EventMessageType.Watch,
            this.wrapEventHandlerWithResultPropagator(
                this.handleWatchEvent.bind(this),
                this.eventHandlers.watch));

        this.bot.on(
            EventMessageType.Unwatch,
            this.wrapEventHandlerWithResultPropagator(
                this.handleUnwatchEvent.bind(this),
                this.eventHandlers.unwatch));
    }

    // tslint:disable
    private wrapEventHandlerWithResultPropagator(
        fn: (msg: HandoffEventMessage) => Promise<any>,
        eventHandler: IEventHandler
    ): (msg: HandoffEventMessage) => Promise<any> {
    // tslint:enable
        return (msg: HandoffEventMessage) => fn(msg)
            .then(() => eventHandler.success(this.bot, msg))
            .catch((e: {}) => eventHandler.failure(this.bot, new ErrorEventMessage(msg, e)));
    }

    private handleQueueEvent(msg: HandoffEventMessage): Promise<{}> {
        return this.provider.queueCustomerForAgent(msg.customerAddress);
    }

    private handleDequeueEvent(msg: HandoffEventMessage): Promise<{}> {
        return this.provider.dequeueCustomerForAgent(msg.customerAddress);
    }

    private handleWatchEvent(msg: HandoffEventMessage): Promise<{}> {
        return this.provider.watchConversation(msg.customerAddress, msg.agentAddress);
    }

    private handleUnwatchEvent(msg: HandoffEventMessage): Promise<{}> {
        return this.provider.unwatchConversation(msg.customerAddress, msg.agentAddress);
    }

    private handleConnectEvent(msg: HandoffEventMessage): Promise<{}> {
        return this.provider.connectCustomerToAgent(msg.customerAddress, msg.agentAddress);
    }

    private handleDisconnectEvent(msg: HandoffEventMessage): Promise<{}> {
        return this.provider.disconnectCustomerFromAgent(msg.customerAddress, msg.agentAddress);
    }
}
