import { IAddress } from 'botbuilder';
import { EventMessageType } from './EventMessageType';
import { HandoffEventMessage } from './HandoffEventMessage';

export class DequeueEventMessage extends HandoffEventMessage {
    constructor(customerAddress: IAddress) {
        super(EventMessageType.Dequeue, customerAddress);
    }
}
