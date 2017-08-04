import { IAddress, IMessage, Message } from 'botbuilder';
import { MessageType } from './constants';

export interface IHandoffMessage extends IMessage {
    customerAddress?: IAddress;
    agentAddress?: IAddress;
}

export interface IHandoffEventMessage extends IHandoffMessage {
    type: MessageType;
}

//tslint:disable
export function isIHandoffEventMessage(arg: any): arg is IHandoffEventMessage {
//tslint:enable
    return arg.customerAddress && arg.agentAddress;
}

export function addCustomerAddressToMessage(msg: IMessage, customerAddress: IAddress): void {
    (msg as IHandoffMessage).customerAddress = customerAddress;
}

export function addAgentAddressToMessage(msg: IMessage, agentAddress: IAddress): void {
    (msg as IHandoffMessage).agentAddress = agentAddress;
}

export function createConnectMessage(customerAddress: IAddress, agentAddress: IAddress): IHandoffEventMessage {
    return createHandoffEventMessage(MessageType.Connect, customerAddress, agentAddress);
}

export function createDisconnectMessage(customerAddress: IAddress, agentAddress: IAddress): IHandoffEventMessage {
    return createHandoffEventMessage(MessageType.Disconnect, customerAddress, agentAddress);
}

export function createWatchEventMessage(customerAddress: IAddress, agentAddress: IAddress): IHandoffEventMessage {
    return createHandoffEventMessage(MessageType.Watch, customerAddress, agentAddress);
}

export function createUnwatchEventMessage(customerAddress: IAddress, agentAddress: IAddress): IHandoffEventMessage {
    return createHandoffEventMessage(MessageType.Unwatch, customerAddress, agentAddress);
}

export function createQueueMessage(customerAddress: IAddress): IHandoffEventMessage {
    return createHandoffEventMessage(MessageType.Queue, customerAddress);
}

export function createDequeueMessage(customerAddress: IAddress): IHandoffEventMessage {
    return createHandoffEventMessage(MessageType.Dequeue, customerAddress);
}

function createHandoffEventMessage(type: MessageType, customerAddress: IAddress, agentAddress?: IAddress): IHandoffEventMessage {
    const message = new Message()
        .toMessage() as IHandoffEventMessage;

    message.type = type;
    message.customerAddress = customerAddress;
    message.agentAddress = agentAddress;

    return message;
}
