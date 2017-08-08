import * as Promise from 'bluebird';
import { IAddress, IMessage, Message, UniversalBot } from 'botbuilder';
import { EventMessageType } from '../eventMessages/EventMessageType';
import { HandoffEventMessage, isIHandoffEventMessage } from '../eventMessages/HandoffEventMessage';
import { IConversation } from '../IConversation';
import { IProvider } from '../provider/IProvider';
import { ErrorEventMessage } from './../eventMessages/ErrorEventMessage';

export function applyHandoffEventListeners(bot: UniversalBot, provider: IProvider): void {
    return new HandoffMessageEventListnerApplicator(bot, provider).applyHandoffEventListeners();
}

class HandoffMessageEventListnerApplicator {
    private provider: IProvider;
    private bot: UniversalBot;

    constructor(bot: UniversalBot, provider: IProvider) {
        this.bot = bot;
        this.provider = provider;
    }

    public applyHandoffEventListeners(): void {
        this.bot.on(EventMessageType.Connect, this.wrapEventHandlerWithErrorPropagator(this.handleConnectEvent.bind(this)));
        this.bot.on(EventMessageType.Disconnect, this.wrapEventHandlerWithErrorPropagator(this.handleDisconnectEvent.bind(this)));
        this.bot.on(EventMessageType.Queue, this.wrapEventHandlerWithErrorPropagator(this.handleQueueEvent.bind(this)));
        this.bot.on(EventMessageType.Dequeue, this.wrapEventHandlerWithErrorPropagator(this.handleDequeueEvent.bind(this)));
        this.bot.on(EventMessageType.Watch, this.wrapEventHandlerWithErrorPropagator(this.handleWatchEvent.bind(this)));
        this.bot.on(EventMessageType.Unwatch, this.wrapEventHandlerWithErrorPropagator(this.handleUnwatchEvent.bind(this)));
    }

    // tslint:disable
    private wrapEventHandlerWithErrorPropagator(fn: (msg: HandoffEventMessage) => Promise<any>): (msg: HandoffEventMessage) => Promise<any> {
    // tslint:enable
        return (msg: HandoffEventMessage) => fn(msg)
            .catch((e: {}) => {
                this.bot.send(new ErrorEventMessage(msg, e));
            });
    }

    private handleQueueEvent(msg: HandoffEventMessage): Promise<void> {
        return this.provider.queueCustomerForAgent(msg.customerAddress)
            // TODO abstract this response
            .then(() =>
                this.sendCustomerMessage(
                    'you\'re all set to talk to an agent. One will be with you as soon as they become available',
                    msg.customerAddress));
    }

    private handleDequeueEvent(msg: HandoffEventMessage): Promise<void> {
        return this.provider.dequeueCustomerForAgent(msg.customerAddress)
            // TODO abstract this response
            .then(() => this.sendCustomerMessage('you\'re no longer in line for an agent', msg.customerAddress));
    }

    private handleWatchEvent(msg: HandoffEventMessage): Promise<IConversation> {
        return this.provider.watchConversation(msg.customerAddress, msg.agentAddress);
    }

    private handleUnwatchEvent(msg: HandoffEventMessage): Promise<IConversation> {
        return this.provider.unwatchConversation(msg.customerAddress, msg.agentAddress);
    }

    private handleConnectEvent(msg: HandoffEventMessage): Promise<void> {
        return this.provider.connectCustomerToAgent(msg.customerAddress, msg.agentAddress)
            .then(() => this.sendCustomerMessage('you\'re now connected to an agent', msg.customerAddress));
    }

    private handleDisconnectEvent(msg: HandoffEventMessage): Promise<void> {
        return this.provider.disconnectCustomerFromAgent(msg.customerAddress, msg.agentAddress)
            .then(() => this.sendCustomerMessage('you\'re no longer connected to the agent', msg.customerAddress));
    }

    private catchEventError(eventMessageErrorSource: HandoffEventMessage, error: {}): void {
        this.bot.send(new ErrorEventMessage(eventMessageErrorSource, error));
    }

    private sendCustomerMessage(text: string, customerAddress: IAddress): void {
        const message = new Message()
            .address(customerAddress)
            .text(text)
            .toMessage() as HandoffEventMessage;

        message.customerAddress = customerAddress;

        this.bot.send(message);
    }

    private sendAgentMessage(text: string, agentAddress: IAddress): void {
        const message = new Message()
            .address(agentAddress)
            .text(text)
            .toMessage() as HandoffEventMessage;

        message.agentAddress = agentAddress;

        this.bot.send(message);
    }
}
