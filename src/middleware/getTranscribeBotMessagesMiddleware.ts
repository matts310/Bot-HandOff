import * as Promise from 'bluebird';
import { IMessage } from 'botbuilder';
import { IHandoffMessage } from './../IHandoffMessage';
import { IProvider } from './../provider/IProvider';

export function getTranscribeBotMessagesMiddleware(provider: IProvider): (s: IMessage, n: Function) => void {
    return (msg: IMessage, next: Function) => {
        const message = msg as IHandoffMessage;
        //tslint:disable
        let transcribePromise = Promise.resolve() as Promise<any>;
        //tslint:enable

        // if neither agentAddress nor customerAddress are defined, then the message originated from the bot
        if (message.type === 'message' && !message.customerAddress) {
            transcribePromise = provider.addBotMessageToTranscriptIgnoringConversationState(message);
        }

        // console.log('sending', JSON.stringify(message, null, 2));
        //tslint:disable
        return transcribePromise.then(() => next())
        //tslint:enable
    };
}
