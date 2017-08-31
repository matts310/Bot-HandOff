import { Session, UniversalBot } from 'botbuilder';
import { ConversationState, IConversation } from '../IConversation';
import { IHandoffMessage } from '../IHandoffMessage';
import { MessageReceivedWhileWaitingHandler } from '../options/MessageReceivedWhileWaitingHandler';
import { IProvider } from './../provider/IProvider';
import { Router } from './Router';

export class CustomerMessageRouter extends Router {
    private messageReceivedWhileWaitingHandler: MessageReceivedWhileWaitingHandler;

    constructor(bot: UniversalBot, provider: IProvider, messageReceivedWhileWaitingHandler: MessageReceivedWhileWaitingHandler) {
        super(bot, provider);

        this.messageReceivedWhileWaitingHandler = messageReceivedWhileWaitingHandler;
    }
    //tslint:disable
    public Route(session: Session, next: Function): any {
    //tslint:enable
        const customerAddress = session.message.address;

            return this.provider.getConversationFromCustomerAddress(customerAddress)
                .then((convo: IConversation) => {
                    if (convo) {
                        const agentAddress = convo.agentAddress;
                        const agentMirrorMessage = Object.assign({}, session.message, { address: agentAddress, value: 'customerMessage'});

                        switch (convo.conversationState) {
                            case ConversationState.Watch:
                                this.bot.send(agentMirrorMessage);

                                return next();
                            case ConversationState.Bot:
                                return next();
                            case ConversationState.Agent:
                                return this.bot.send(agentMirrorMessage);
                            case ConversationState.Wait:
                                this.messageReceivedWhileWaitingHandler(this.bot, session, next);
                                break;
                            case ConversationState.WatchAndWait:
                                this.messageReceivedWhileWaitingHandler(this.bot, session, next);
                                this.bot.send(agentMirrorMessage);
                                break;
                            default:
                                return next();
                        }
                    } else {
                        return this.provider.addCustomerMessageToTranscript(session.message)
                        //tslint:disable
                            .then(() => next());
                        //tslint:enable
                    }
                });
    }
}
