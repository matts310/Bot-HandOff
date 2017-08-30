import * as Promise from 'bluebird';
import { IAddress, Message, UniversalBot } from 'botbuilder';
import { EventMessageType } from '../eventMessages/EventMessageType';
import { HandoffEventMessage } from '../eventMessages/HandoffEventMessage';
import { IConversation } from '../IConversation';
import { IProvider } from '../provider/IProvider';
import { ErrorEventMessage } from './../eventMessages/ErrorEventMessage';
import { EventSuccessHandler, EventSuccessHandlers } from './../EventSuccessHandlers';

export function applyHandoffEventListeners(bot: UniversalBot, provider: IProvider, eventSuccessHandlers: EventSuccessHandlers): void {
    return new HandoffMessageEventListnerApplicator(bot, provider, eventSuccessHandlers).applyHandoffEventListeners();
}

class HandoffMessageEventListnerApplicator {
    private provider: IProvider;
    private bot: UniversalBot;
    private eventSuccessHandlers: EventSuccessHandlers;

    constructor(bot: UniversalBot, provider: IProvider, eventSuccessHandlers: EventSuccessHandlers) {
        this.bot = bot;
        this.provider = provider;
        this.eventSuccessHandlers = eventSuccessHandlers;
    }

    public applyHandoffEventListeners(): void {
        this.bot.on(
            EventMessageType.Connect,
            this.wrapEventHandlerWithResultPropagator(
                this.handleConnectEvent.bind(this),
                this.eventSuccessHandlers.connectSuccess.bind(this)));
        this.bot.on(
            EventMessageType.Disconnect,
            this.wrapEventHandlerWithResultPropagator(
                this.handleDisconnectEvent.bind(this),
                this.eventSuccessHandlers.disconnectSuccess.bind(this)));
        this.bot.on(
            EventMessageType.Queue,
            this.wrapEventHandlerWithResultPropagator(
                this.handleQueueEvent.bind(this),
                this.eventSuccessHandlers.queueSuccess.bind(this)));
        this.bot.on(
            EventMessageType.Dequeue,
            this.wrapEventHandlerWithResultPropagator(
                this.handleDequeueEvent.bind(this),
                this.eventSuccessHandlers.dequeueSuccess.bind(this)));

        this.bot.on(
            EventMessageType.Watch,
            this.wrapEventHandlerWithResultPropagator(
                this.handleWatchEvent.bind(this),
                this.eventSuccessHandlers.watchSuccess.bind(this)));

        this.bot.on(
            EventMessageType.Unwatch,
            this.wrapEventHandlerWithResultPropagator(
                this.handleUnwatchEvent.bind(this),
                this.eventSuccessHandlers.unwatchSuccess.bind(this)));
    }

    // tslint:disable
    private wrapEventHandlerWithResultPropagator(
        fn: (msg: HandoffEventMessage) => Promise<any>,
        eventSuccessHandler: EventSuccessHandler
    ): (msg: HandoffEventMessage) => Promise<any> {
    // tslint:enable
        return (msg: HandoffEventMessage) => fn(msg)
            .then(() => {
                eventSuccessHandler(this.bot, msg);
            })
            .catch((e: {}) => {
                this.bot.send(new ErrorEventMessage(msg, e));
            });
    }

    private handleQueueEvent(msg: HandoffEventMessage): Promise<{}> {
        console.log("HANDLING QUEUE EVENT");
        return this.provider.queueCustomerForAgent(msg.customerAddress)
            .then((a) => console.log(a) || a);
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
