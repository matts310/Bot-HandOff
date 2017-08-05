import * as Promise from 'bluebird';
import { BotTester } from 'bot-tester';
import { ConsoleConnector, IAddress, IMessage, Message, Session, UniversalBot } from 'botbuilder';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ConversationState } from '../src/constants';
import { InMemoryProvider } from '../src/provider/InMemoryProvider';
import { applyHandoffMiddleware } from './../src/applyHandoffMiddleware';
import { IConversation } from './../src/IConversation';
import {
    createConnectMessage,
    createDequeueMessage,
    createDisconnectMessage,
    createHandoffErrorMessage,
    createQueueMessage,
    createUnwatchEventMessage,
    createWatchEventMessage,
    IHandoffErrorEventMessage,
    IHandoffEventMessage,
    IHandoffMessage
} from './../src/IHandoffMessage';
import { AgentAlreadyInConversationError, IProvider } from './../src/provider/IProvider';

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
    return Promise.resolve(!!(session.message as IHandoffMessage).agentAddress);
};

//tslint:disable
function createIProviderSpy(provider: IProvider): IProvider {
    Object.getOwnPropertyNames(Object.getPrototypeOf(provider)).forEach((method: string) => {
        provider[method] = sinon.spy(provider, method as any);
    });

    return provider;
}
//tslint:enable

describe('event message', () => {
    let bot: UniversalBot;
    let provider: IProvider;
    let eventMessage: IHandoffEventMessage;

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

        return new BotTester(bot, CUSTOMER_ADDRESS)
            .sendMessageToBot(customerIntroMessage)
            .runTest();
    });

    afterEach(() => {
        ensureProviderDidNotTranscribeMessage(eventMessage);
    });

    function ensureProviderDidNotTranscribeMessage(msg: IHandoffEventMessage): void {
        expect(provider.addAgentMessageToTranscript).not.to.have.been.calledWith(msg);
        expect(provider.addBotMessageToTranscript).not.to.have.been.calledWith(msg);
        expect(provider.addCustomerMessageToTranscript).not.to.have.been.calledWith(msg);
    }

    function sendMessageToBotAndGetConversationData(
        msg: IHandoffEventMessage, expectedResponse?: string | IMessage):  Promise<IConversation> {
        return new BotTester(bot, CUSTOMER_ADDRESS)
            .sendMessageToBot(msg, expectedResponse)
            .runTest()
            .then(() => provider.getConversationFromCustomerAddress(CUSTOMER_ADDRESS));
    }

    describe('connect/disconnect', () => {
        it('connect sets converation state to Agent and bot responds with connection message to user', () => {
            eventMessage = createConnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage, 'you\'re now connected to an agent')
                .then((convo: IConversation) => {
                    expect(providerSpy.connectCustomerToAgent).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
                    expect(convo.conversationState).to.be.equal(ConversationState.Agent);
                });
        });

        it('disconnect sets converation state to Bot and bot responds with disconnect message to user', () => {
            eventMessage = createDisconnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(createConnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS))
                .then(() => sendMessageToBotAndGetConversationData(eventMessage, 'you\'re no longer connected to the agent'))
                .then((conversation: IConversation) => {
                    expect(providerSpy.disconnectCustomerFromAgent).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
                    expect(conversation.conversationState).to.be.equal(ConversationState.Bot);
                });
        });

        it('sending connect event to an already connected conversation responds with an error event to the requesting agent', () => {
            eventMessage = createConnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);
            const errorEventMessage: IHandoffErrorEventMessage =
                createHandoffErrorMessage(eventMessage, new AgentAlreadyInConversationError(AGENT_ADDRESS.conversation.id));

            const errorMessage = createHandoffErrorMessage(eventMessage, 'some error goes here');

            const botTester = new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(eventMessage, errorEventMessage);

            return sendMessageToBotAndGetConversationData(eventMessage, 'you\'re now connected to an agent')
                .then(() => botTester.runTest());
        });
    });
});
