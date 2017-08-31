import { IAddress, Message, UniversalBot } from 'botbuilder';
import { ErrorEventMessage } from '../eventMessages/ErrorEventMessage';
import { HandoffEventMessage } from '../eventMessages/HandoffEventMessage';

//tslint:disable
export type EventFailureHandler = (bot: UniversalBot, errorEventMessage: ErrorEventMessage) => any;
//tslint:enable

//tslint:disable
export function defaultFailureHandler(bot: UniversalBot, errorEventMessage: ErrorEventMessage): any {
    bot.send(errorEventMessage);
}
//tslint:enable

function sendTextToAddress(bot: UniversalBot, text: string, address: IAddress): void {
    const msg = new Message()
        .text(text)
        .address(address)
        .toMessage();

    bot.send(msg);
}
