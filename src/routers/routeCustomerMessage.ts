import { IAddress, Message, Session, UniversalBot } from 'botbuilder';
import { ConversationState, IConversation } from '../IConversation';
import { IProvider } from './../provider/IProvider';

    // TODO move these

export function routeCustomerMessage(bot: UniversalBot, provider: IProvider): (s: Session, n: Function) => void {
    function sendCustomerMessage(text: string, customerAddress: IAddress): void {
        const message = new Message()
            .address(customerAddress)
            .text(text)
            .toMessage();

        bot.send(message);
    }

    function sendAgentMessage(text: string, agentAddress: IAddress): void {
        const message = new Message()
            .address(agentAddress)
            .text(text)
            .toMessage();

        bot.send(message);
    }

    return (session: Session, next: Function) => {
        const customerAddress = session.message.address;

        provider.getConversationFromCustomerAddress(customerAddress)
            .then((convo: IConversation) => {
                if (convo) {
                    const agentAddress = convo.agentAddress;
                    const agentMirrorMessage = Object.assign({}, session.message, { address: agentAddress, value: 'customerMessage'});

                    switch (convo.conversationState) {
                        case ConversationState.Bot:
                            return next();
                        case ConversationState.Agent:
                            return bot.send(agentMirrorMessage);
                        case ConversationState.Wait:
                            // TODO make this customizable
                            return sendCustomerMessage('please hold on while we connect you to an agent', customerAddress);
                        default:
                            next();
                    }
                } else {
                    provider.addCustomerMessageToTranscript(session.message)
                    //tslint:disable
                        .then(() => next());
                    //tslint:enable
                }
            });
    };
}
