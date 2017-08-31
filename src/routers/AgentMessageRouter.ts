import { Session, UniversalBot } from 'botbuilder';
import { ConversationState, IConversation } from '../IConversation';
import { IHandoffMessage } from '../IHandoffMessage';
import { IProvider } from './../provider/IProvider';
import { Router } from './Router';

export class AgentMessageRouter extends Router {
    constructor(bot: UniversalBot, provider: IProvider) {
        super(bot, provider);
    }

    //tslint:disable
    public Route(session: Session): any {
        const agentAddress = session.message.address;
    //tslint:enable
        return this.provider.getConversationFromAgentAddress(agentAddress)
            .then((convo: IConversation) => {
                if (convo && convo.conversationState === ConversationState.Agent) {
                    const customerAddress = convo.customerAddress;
                    const customerMessageMirror: IHandoffMessage =
                        Object.assign({ customerAddress, agentAddress }, session.message, { address: customerAddress });

                    this.bot.send(customerMessageMirror);
                } else {
                    // throw an error?
                }
            });
    }
}
