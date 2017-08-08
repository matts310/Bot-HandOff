import * as Promise from 'bluebird';
import { BotTester } from 'bot-tester';
import { ConsoleConnector, IAddress, IMessage, Message, Session, UniversalBot } from 'botbuilder';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ConversationState } from '../src/constants';
import { InMemoryProvider } from '../src/provider/InMemoryProvider';
import { applyHandoffMiddleware } from './../src/applyHandoffMiddleware';
import { ConnectEventMessage } from './../src/eventMessages/ConnectEventMessage';
import { IConversation } from './../src/IConversation';
import { IHandoffMessage } from './../src/IHandoffMessage';
import { IProvider } from './../src/provider/IProvider';

chai.use(sinonChai);

const expect = chai.expect;

const connector = new ConsoleConnector();

const CUSTOMER_ADDRESS: IAddress = { channelId: 'console',
    user: { id: 'userId1', name: 'user1' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'user1Conversation' }
};

const AGENT_ADDRESS: IAddress = { channelId: 'console',
    user: { id: 'agentId', name: 'agent' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'agent_convo' }
};

const isAgent = (session: Session): Promise<boolean> => {
    return Promise.resolve(session.message.address.user.name === 'agent');
};

//tslint:disable
function createIProviderSpy(provider: IProvider): IProvider {
    Object.getOwnPropertyNames(Object.getPrototypeOf(provider)).forEach((method: string) => {
        provider[method] = sinon.spy(provider, method as any);
    });

    return provider;
}
//tslint:enable

describe('agent handoff', () => {
    let bot: UniversalBot;
    let provider: IProvider;

    // actually a spy, but this allows us to only focus on the relevant methods
    let providerSpy: IProvider;

    const customerIntroMessage = new Message()
        .text('hello')
        .address(CUSTOMER_ADDRESS)
        .toMessage();

    beforeEach(() => {
        provider = new InMemoryProvider();
        providerSpy = createIProviderSpy(provider);
        bot = new UniversalBot(connector);
        bot.dialog('/', (session: Session) => {
            session.send('intro!');
        });

        applyHandoffMiddleware(bot, isAgent, provider);
    });

    it('can handover to agents', () => {
        const customerIntroMessage2 = new Message()
            .text('hello')
            .address(CUSTOMER_ADDRESS)
            .toMessage();

        const agentMessage = new Message()
            .address(AGENT_ADDRESS)
            .text('hello there')
            .toMessage();

        const userReceptionOfAgentMessage = Object.assign({}, agentMessage, { address: CUSTOMER_ADDRESS, text: 'hello there'});

        return new BotTester(bot, CUSTOMER_ADDRESS)
            .sendMessageToBot(customerIntroMessage2, 'intro!')
            .sendMessageToBot(new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS), 'you\'re now connected to an agent')
            .sendMessageToBot(agentMessage, userReceptionOfAgentMessage)
            .runTest();
    });

    // xdescribe('event message', () => {
    //     let eventMessage: IHandoffEventMessage;

    //     function sendMessageToBotAndGetConversationData(
    //         msg: IHandoffEventMessage,
    //         expectedResponse?: string | IMessage
    //     ):  Promise<IConversation> {
    //         return new BotTester(bot, CUSTOMER_ADDRESS)
    //             .sendMessageToBot(msg, expectedResponse)
    //             .runTest()
    //             .then(() => provider.getConversationFromCustomerAddress(CUSTOMER_ADDRESS));
    //     }

    //     function ensureProviderDidNotTranscribeMessage(msg: IHandoffEventMessage): void {
    //         expect(provider.addAgentMessageToTranscript).not.to.have.been.calledWith(msg);
    //         expect(provider.addBotMessageToTranscript).not.to.have.been.calledWith(msg);
    //         expect(provider.addCustomerMessageToTranscript).not.to.have.been.calledWith(msg);
    //     }

    //     beforeEach(() => {
    //         return new BotTester(bot, CUSTOMER_ADDRESS)
    //             .sendMessageToBot(customerIntroMessage)
    //             .runTest();
    //     });

    //     afterEach(() => {
    //         ensureProviderDidNotTranscribeMessage(eventMessage);
    //     });

    //     it('connect sets converation state to Agent and bot responds with connection message to user', () => {
    //         eventMessage = createConnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

    //         return sendMessageToBotAndGetConversationData(eventMessage, 'you\'re now connected to an agent')
    //             .then((convo: IConversation) => {
    //                 expect(providerSpy.connectCustomerToAgent).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
    //                 expect(convo.conversationState).to.be.equal(ConversationState.Agent);
    //             });
    //     });

    //     it('disconnect sets converation state to Bot and bot responds with disconnect message to user', () => {
    //         eventMessage = createDisconnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

    //         return sendMessageToBotAndGetConversationData(createConnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS))
    //             .then(() => sendMessageToBotAndGetConversationData(eventMessage, 'you\'re no longer connected to the agent'))
    //             .then((conversation: IConversation) => {
    //                 expect(providerSpy.disconnectCustomerFromAgent).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
    //                 expect(conversation.conversationState).to.be.equal(ConversationState.Bot);
    //             });
    //     });

    //     it('watch sets conversation state to watch ', () => {
    //         eventMessage = createWatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

    //         return sendMessageToBotAndGetConversationData(eventMessage)
    //             .then((convo: IConversation) => {
    //                 expect(providerSpy.watchConversation).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
    //                 expect(convo.conversationState).to.be.equal(ConversationState.Watch);
    //             });
    //     });

    //     it('unwatch sets conversation', () => {
    //         eventMessage = createWatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

    //         return sendMessageToBotAndGetConversationData(eventMessage)
    //             .then((convo: IConversation) => {
    //                 expect(providerSpy.watchConversation).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
    //                 expect(convo.conversationState).to.be.equal(ConversationState.Watch);
    //             });
    //     });
    // });
});
