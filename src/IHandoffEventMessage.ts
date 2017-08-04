import { IAddress, IMessage, Message } from 'botbuilder';
import { MessageType } from './constants';

export interface IHandoffEventMessage extends IMessage {
    customerAddress: IAddress;
    agentAddress: IAddress;
}
//tslint:disable
export function isIHandoffEventMessage(arg: any): arg is IHandoffEventMessage {
//tslint:enable
    return arg.customerAddress && arg.agentAddress;
}

export function createConnectMessage(customerAddress: IAddress, agentAddress: IAddress): IHandoffEventMessage {
    const message = new Message()
        .toMessage() as IHandoffEventMessage;

    message.type = MessageType.Connect;
    message.customerAddress = customerAddress;
    message.agentAddress = agentAddress;

    return message;
}
