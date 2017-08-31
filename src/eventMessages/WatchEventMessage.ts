import { IAddress } from 'botbuilder';
import { EventMessageType } from './EventMessageType';
import { HandoffEventMessage } from './HandoffEventMessage';

export class WatchEventMessage extends HandoffEventMessage {
    constructor(customerAddress: IAddress, agentAddress: IAddress) {
        super(EventMessageType.Watch, customerAddress, agentAddress);
    }
}
