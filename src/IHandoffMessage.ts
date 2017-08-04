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
    return arg.customerAddress && arg.agentAddress && arg.type in MessageType;
}

export function addCustomerAddressToMessage(msg: IMessage, customerAddress: IAddress): void {
    (msg as IHandoffMessage).customerAddress = customerAddress;
}

export function addAgentAddressToMessage(msg: IMessage, agentAddress: IAddress): void {
    (msg as IHandoffMessage).agentAddress = agentAddress;
}

export function createConnectMessage(customerAddress: IAddress, agentAddress: IAddress): IHandoffEventMessage {
    const message = new Message()
        .toMessage() as IHandoffEventMessage;

    message.type = MessageType.Connect;
    message.customerAddress = customerAddress;
    message.agentAddress = agentAddress;

    return message;
}
