import { IAddress, Message, UniversalBot } from 'botbuilder';
import { HandoffEventMessage } from '../eventMessages/HandoffEventMessage';

//tslint:disable
export type EventSuccessHandler = (bot: UniversalBot, eventMessage: HandoffEventMessage) => any;
//tslint:enable

export const defaultSuccessHandlers = {
    connectSuccess(bot: UniversalBot, eventMessage: HandoffEventMessage): void {
        sendTextToAddress(bot, 'you\'re now connected to an agent', eventMessage.customerAddress);
        // add agent message
    },
    disconnectSuccess(bot: UniversalBot, eventMessage: HandoffEventMessage): void {
        sendTextToAddress(bot, 'you\'re no longer connected to the agent', eventMessage.customerAddress);
        // add agent message
    },
    queueSuccess(bot: UniversalBot, eventMessage: HandoffEventMessage): void {
        sendTextToAddress(
            bot,
            'you\'re all set to talk to an agent. One will be with you as soon as they become available',
            eventMessage.address);
    },
    dequeueSuccess(bot: UniversalBot, eventMessage: HandoffEventMessage): void {
        sendTextToAddress(bot, 'you\'re no longer in line for an agent', eventMessage.customerAddress);
    },
    watchSuccess(bot: UniversalBot, eventMessage: HandoffEventMessage): void {
        // send something to the agent by default
        return;
    },
    unwatchSuccess(bot: UniversalBot, eventMessage: HandoffEventMessage): void {
        // send something to the agent by default
        return;
    }
};

function sendTextToAddress(bot: UniversalBot, text: string, address: IAddress): void {
    const msg = new Message()
        .text(text)
        .address(address)
        .toMessage();

    bot.send(msg);
}
