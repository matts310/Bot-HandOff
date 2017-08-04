import * as Promise from 'bluebird';
import { Session, UniversalBot } from 'botbuilder';
import { IConversation } from '../IConversation';
import { IHandoffMessage } from './../IHandoffMessage';
import { IProvider } from './../provider/IProvider';
import { Router } from './Router';

export function routeAgentMessage(bot: UniversalBot, provider: IProvider): (s: Session) => void {
    return (session: Session) => {
        const agentAddress = session.message.address;

        return provider.getConversationFromAgentAddress(agentAddress)
            .then((convo: IConversation) => {
                if (convo) {
                    const customerAddress = convo.customerAddress;
                    const customerMessageMirror: IHandoffMessage =
                        Object.assign({ customerAddress, agentAddress }, session.message, { address: customerAddress });
                    bot.send(customerMessageMirror);
                } else {
                    // throw an error?
                }
            });
    };
}
