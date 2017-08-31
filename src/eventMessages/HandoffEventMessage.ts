import { IAddress, IAttachment, IIdentity, IMessage } from 'botbuilder';
import { IHandoffMessage } from './../IHandoffMessage';
import { ErrorEventMessage } from './ErrorEventMessage';
import { EventMessageType } from './EventMessageType';

export abstract class HandoffEventMessage implements IHandoffMessage {
    public readonly type: EventMessageType;
    public customerAddress: IAddress;
    public agentAddress?: IAddress;

    // these arent used
    public agent: string;
    public source: string;
    public sourceEvent: {};
    public address: IAddress;
    public  user: IIdentity;

    constructor(type: EventMessageType, customerAddress: IAddress, agentAddress?: IAddress) {
        this.type = type;
        this.customerAddress = customerAddress;
        this.agentAddress = agentAddress;

        // if the agent address is defined, the message was coming from the agent side. Otherwise, it originated from the customers
        this.address = agentAddress || customerAddress;
    }
}

export function isIHandoffEventMessage(msg: IMessage): boolean {
    return msg instanceof HandoffEventMessage;
}
