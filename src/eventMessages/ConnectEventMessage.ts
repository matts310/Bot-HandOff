import { IAddress } from 'botbuilder';
import { ErrorEventMessage } from './ErrorEventMessage';
import { EventMessageType } from './EventMessageType';
import { HandoffEventMessage } from './HandoffEventMessage';

export class ConnectEventMessage extends HandoffEventMessage {
    constructor(customerAddress: IAddress, agentAddress: IAddress) {
        super(EventMessageType.Connect, customerAddress, agentAddress);
    }
}
