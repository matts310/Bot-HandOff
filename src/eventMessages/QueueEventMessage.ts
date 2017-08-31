import { IAddress } from 'botbuilder';
import { EventMessageType } from './EventMessageType';
import { HandoffEventMessage } from './HandoffEventMessage';

export class QueueEventMessage extends HandoffEventMessage {
    constructor(customerAddress: IAddress) {
        super(EventMessageType.Queue, customerAddress);
    }
}
