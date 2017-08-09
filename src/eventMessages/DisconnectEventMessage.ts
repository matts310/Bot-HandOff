import { IAddress } from 'botbuilder';
import { EventMessageType } from './EventMessageType';
import { HandoffEventMessage } from './HandoffEventMessage';

export class DisconnectEventMessage extends HandoffEventMessage {
    constructor(customerAddress: IAddress) {
        super(EventMessageType.Disconnect, customerAddress);
    }
}
