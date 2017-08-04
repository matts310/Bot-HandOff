import * as Promise from 'bluebird';
import { IAddress, IMessage, Message, UniversalBot } from 'botbuilder';
import { MessageType } from '../constants';
import { IConversation } from '../IConversation';
import { IHandoffEventMessage, isIHandoffEventMessage } from '../IHandoffEventMessage';
import { IProvider } from '../provider/IProvider';

export function getHandoffMessageEventInterceptor(bot: UniversalBot, provider: IProvider): (msg: IMessage, next: Function) => void {
    return new HandoffMessageEventInterceptor(bot, provider).getInterceptor();
}

class HandoffMessageEventInterceptor {
    private provider: IProvider;
    private bot: UniversalBot;

    constructor(bot: UniversalBot, provider: IProvider) {
        this.bot = bot;
        this.provider = provider;
    }

    public getInterceptor(): (msg: IMessage, next: Function) => void {
        return (msg: IMessage, next: Function) => {
            if (isIHandoffEventMessage(msg)) {
                this.intercept(msg as IHandoffEventMessage, next);
            } else {
                next();
            }
        };
    }

    private intercept(msg: IHandoffEventMessage, next: Function): void {
        //tslint:disable
        let handleMessage: Promise<any> = Promise.resolve();
        //tslint:enable
        switch (msg.type) {
            case MessageType.Connect:
                handleMessage = this.handleConnectEvent(msg);
                break;
            case MessageType.Disconnect:
                handleMessage = this.handleDisconnectEvent(msg);
                break;
            case MessageType.Queue:
                handleMessage = this.handleQueueEvent(msg);
                break;
            case MessageType.Dequeue:
                handleMessage = this.handleDequeueEvent(msg);
                break;
            case MessageType.Watch:
                handleMessage = this.handleWatchEvent(msg);
                break;
            case MessageType.Unwatch:
                handleMessage = this.handleUnwatchEvent(msg);
                break;
            default:
                return next();
        }

        //tslint:disable
        handleMessage.then(() => next());
        //tslint:enable
    }

    private handleQueueEvent(msg: IHandoffEventMessage): Promise<void> {
        return this.provider.queueCustomerForAgent(msg.customerAddress)
            // TODO abstract this response
            .then(() =>
                this.sendCustomerMessage(
                    'you\'re all set to talk to an agent. One will be with you as soon as they become available',
                    msg.customerAddress));
    }

    private handleDequeueEvent(msg: IHandoffEventMessage): Promise<void> {
        return this.provider.dequeueCustomerForAgent(msg.customerAddress)
            // TODO abstract this response
            .then(() => this.sendCustomerMessage('you\'re no longer in line for an agent', msg.customerAddress));
    }

    private handleWatchEvent(msg: IHandoffEventMessage): Promise<IConversation> {
        return this.provider.watchConversation(msg.customerAddress, msg.agentAddress);
    }

    private handleUnwatchEvent(msg: IHandoffEventMessage): Promise<IConversation> {
        return this.provider.unwatchConversation(msg.customerAddress, msg.agentAddress);
    }

    private handleConnectEvent(msg: IHandoffEventMessage): Promise<void> {
        return this.provider.connectCustomerToAgent(msg.customerAddress, msg.agentAddress)
            .then(() => this.sendCustomerMessage('you\'re now connected to an agent', msg.customerAddress));
    }

    private handleDisconnectEvent(msg: IHandoffEventMessage): Promise<void> {
        return this.provider.disconnectCustomerFromAgent(msg.customerAddress, msg.agentAddress)
            .then(() => this.sendCustomerMessage('you\'re no longer connected to the agent', msg.customerAddress));
    }

    private sendCustomerMessage(text: string, customerAddress: IAddress): void {
        const message = new Message()
            .address(customerAddress)
            .text(text)
            .toMessage();

        this.bot.send(message);
    }

    private sendAgentMessage(text: string, agentAddress: IAddress): void {
        const message = new Message()
            .address(agentAddress)
            .text(text)
            .toMessage();

        this.bot.send(message);
    }
}
