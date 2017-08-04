import * as Promise from 'bluebird';
import { Session } from 'botbuilder';
import { IHandoffMessage } from './../IHandoffMessage';
import { IProvider } from './../provider/IProvider';

export function getTranscribeNonBotMessagesMiddleware(provider: IProvider): (s: Session, n: Function) => void {
    return (session: Session, next: Function) => {
        const message = session.message as IHandoffMessage;
        let transcriptionPromise: Promise<{}>;
        // TODO can probably safely remove this
        if (!message.customerAddress && !message.agentAddress) {
            throw new Error('TranscribeNonBotMessagesMiddleware must be applied after addAddressesForHandoffMessageMiddleware');
        }

        if (message.agentAddress) {
            transcriptionPromise = provider.addAgentMessageToTranscript(message);
        } else {
            transcriptionPromise = provider.addCustomerMessageToTranscript(message);
        }

        //tslint:disable
        transcriptionPromise.then(() => next());
        //tslint:enable
    };
}
