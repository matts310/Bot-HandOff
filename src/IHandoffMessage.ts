import { IAddress, IMessage, Message } from 'botbuilder';

export enum MessageSource {
    Bot = 'Bot',
    Agent = 'Agent',
    Customer = 'Customer'
}

export interface IHandoffMessage extends IMessage {
    customerAddress?: IAddress;
    agentAddress?: IAddress;
}

export function addCustomerAddressToMessage(msg: IMessage, customerAddress: IAddress): void {
    (msg as IHandoffMessage).customerAddress = customerAddress;
}

export function addAgentAddressToMessage(msg: IMessage, agentAddress: IAddress): void {
    (msg as IHandoffMessage).agentAddress = agentAddress;
}
