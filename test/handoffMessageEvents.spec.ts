import * as Promise from 'bluebird';
import { BotTester } from 'bot-tester';
import { ConsoleConnector, IAddress, IMessage, Message, Session, UniversalBot } from 'botbuilder';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { QueueEventMessage } from '../src/eventMessages/QueueEventMessage';
import { InMemoryProvider } from '../src/provider/prebuilt/InMemoryProvider';
import { applyHandoffMiddleware } from './../src/applyHandoffMiddleware';
import { ConnectEventMessage } from './../src/eventMessages/ConnectEventMessage';
import { DequeueEventMessage } from './../src/eventMessages/DequeueEventMessage';
import { DisconnectEventMessage } from './../src/eventMessages/DisconnectEventMessage';
import { ErrorEventMessage } from './../src/eventMessages/ErrorEventMessage';
import { HandoffEventMessage } from './../src/eventMessages/HandoffEventMessage';
import { UnwatchEventMessage } from './../src/eventMessages/UnwatchEventMessage';
import { WatchEventMessage } from './../src/eventMessages/WatchEventMessage';
import { ConversationState, IConversation } from './../src/IConversation';
import { IHandoffMessage } from './../src/IHandoffMessage';
import { AgentAlreadyInConversationError } from './../src/provider/errors/AgentAlreadyInConversationError';
import { ConversationStateUnchangedException } from './../src/provider/errors/ConversationStateUnchangedException';
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

const AGENT_ADDRESS_2: IAddress = { channelId: 'console',
    user: { id: 'agentId2', name: 'agent2' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'agent_convo2' }
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

function expectConvoIsInWaitAndWatchState(convo: IConversation): void {
    expect(convo.agentAddress).to.deep.equal(AGENT_ADDRESS);
    expect(convo.customerAddress).to.deep.equal(CUSTOMER_ADDRESS);
    expect(convo.conversationState).to.be.equal(ConversationState.WatchAndWait);
}

describe('event message', () => {
    let bot: UniversalBot;
    let provider: IProvider;
    let eventMessage: HandoffEventMessage;

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

    function ensureProviderDidNotTranscribeMessage(msg: HandoffEventMessage): void {
        expect(provider.addAgentMessageToTranscript).not.to.have.been.calledWith(msg);
        expect(provider.addBotMessageToTranscript).not.to.have.been.calledWith(msg);
        expect(provider.addCustomerMessageToTranscript).not.to.have.been.calledWith(msg);
    }

    function sendMessageToBotAndGetConversationData(
        msg: HandoffEventMessage, expectedResponse?: string | IMessage):  Promise<IConversation> {
        return new BotTester(bot, CUSTOMER_ADDRESS)
            .sendMessageToBot(msg, expectedResponse)
            .runTest()
            .then(() => provider.getConversationFromCustomerAddress(CUSTOMER_ADDRESS));
    }

    describe('connect/disconnect', () => {
        it('connect sets converation state to Agent and bot responds with connection message to user', () => {
            eventMessage = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage, 'you\'re now connected to an agent')
                .then((convo: IConversation) => {
                    expect(providerSpy.connectCustomerToAgent).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
                    expect(convo.conversationState).to.be.equal(ConversationState.Agent);
                });
        });

        it('disconnect sets converation state to Bot and bot responds with disconnect message to user', () => {
            eventMessage = new DisconnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS))
                .then(() => sendMessageToBotAndGetConversationData(eventMessage, 'you\'re no longer connected to the agent'))
                .then((conversation: IConversation) => {
                    expect(providerSpy.disconnectCustomerFromAgent).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
                    expect(conversation.conversationState).to.be.equal(ConversationState.Bot);
                });
        });

        it('sending connect event to an already connected conversation responds with an error event to the requesting agent', () => {
            eventMessage = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);
            const errorEventMessage =
                new ErrorEventMessage(eventMessage, new AgentAlreadyInConversationError(AGENT_ADDRESS.conversation.id));

            const errorMessage = new ErrorEventMessage(eventMessage, 'some error goes here');

            const botTester = new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(eventMessage, errorEventMessage);

            return sendMessageToBotAndGetConversationData(eventMessage, 'you\'re now connected to an agent')
                .then(() => botTester.runTest());
        });

        //tslint:disable
        it('throws a CustomerAlreadyConnectedException to an agent that attempts to connect to a user that is already connect to another agent', () => {
        // tstlint:enable
            const connectionEvent1 = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);
            const connectionEvent2 = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS_2);

            const expectedErrorMsg = new ErrorEventMessage(connectionEvent2, { name: "CustomerAlreadyConnectedException" });

            return new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(connectionEvent1, 'you\'re now connected to an agent')
                .sendMessageToBot(connectionEvent2, expectedErrorMsg)
                .runTest()
        });
    });

    describe('watch/unwatch', () => {
        it('watch sets the conversation state to watch when in bot state', () => {
            eventMessage = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((convo: IConversation) => {
                    expect(convo.conversationState).to.be.equal(ConversationState.Watch);
                    expect(convo.customerAddress).to.be.equal(CUSTOMER_ADDRESS);
                    expect(convo.agentAddress).to.deep.equal(AGENT_ADDRESS);
                });
        });

        it('unwatch sets the conversation state to bot when in a watch state', () => {
            eventMessage = new UnwatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS))
                .then(() => sendMessageToBotAndGetConversationData(eventMessage))
                .then((convo: IConversation) => {
                    expect(convo.conversationState).to.be.equal(ConversationState.Bot);
                    expect(convo.customerAddress).to.be.equal(CUSTOMER_ADDRESS);
                    expect(convo.agentAddress).to.be.undefined;
                });
        });

        it('watch sets the conversation to wait and watch when in wait state', () => {
            eventMessage = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(new QueueEventMessage(CUSTOMER_ADDRESS))
                .then((convo: IConversation) => expect(convo.conversationState).to.be.equal(ConversationState.Wait))
                .then(() => sendMessageToBotAndGetConversationData(eventMessage))
                .then(expectConvoIsInWaitAndWatchState);
        });
    });

    describe('wait/unwait', () => {
        it('wait sets the conversation state to wait when in bot state', () => {
            eventMessage = new QueueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(
                eventMessage, 'you\'re all set to talk to an agent. One will be with you as soon as they become available')
                .then((convo: IConversation) => {
                    expect(convo.conversationState).to.be.equal(ConversationState.Wait);
                    expect(convo.customerAddress).to.be.equal(CUSTOMER_ADDRESS);
                    expect(convo.agentAddress).to.be.undefined;
                });
        });

        it('unwait sets the conversation state to bot when in a unwait state', () => {
            eventMessage = new DequeueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(
                new QueueEventMessage(CUSTOMER_ADDRESS))
                .then(() => sendMessageToBotAndGetConversationData(eventMessage, 'you\'re no longer in line for an agent'))
                .then((convo: IConversation) => {
                    expect(convo.conversationState).to.be.equal(ConversationState.Bot);
                    expect(convo.customerAddress).to.be.equal(CUSTOMER_ADDRESS);
                    expect(convo.agentAddress).to.be.undefined;
                });
        });

        it('wait sets the conversation to wait and watch when in watch state', () => {
            eventMessage = new QueueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS))
                .then((convo: IConversation) => expect(convo.conversationState).to.be.equal(ConversationState.Watch))
                .then(() => sendMessageToBotAndGetConversationData(eventMessage))
                .then(expectConvoIsInWaitAndWatchState);
        });
    });

    describe('conversation state in wait & watch', () => {
        beforeEach(() => {
            const watchStateEvent = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);
            const waitStateEvent = new QueueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(watchStateEvent)
                .then((convo: IConversation) => {
                    expect(convo.conversationState).to.be.equal(ConversationState.Watch);
                    expect(convo.agentAddress).to.deep.equal(AGENT_ADDRESS);
                    expect(convo.customerAddress).to.deep.equal(CUSTOMER_ADDRESS);
                })
                .then(() => sendMessageToBotAndGetConversationData(waitStateEvent))
                .then(expectConvoIsInWaitAndWatchState);
        });

        it('returns to wait with an unwatch event', () => {
            eventMessage = new UnwatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((convo: IConversation) => {
                    expect(convo.conversationState).to.be.equal(ConversationState.Wait);
                    expect(convo.agentAddress).to.be.undefined;
                });
        });

        it('returns to watch with an unwait (dequeue) event', () => {
            eventMessage = new DequeueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((convo: IConversation) => {
                    expect(convo.conversationState).to.be.equal(ConversationState.Watch);
                    expect(convo.agentAddress).to.deep.equal(AGENT_ADDRESS);
                });
        });
    });

    describe('conversation state unchanged error is thrown when', () => {
        let expectedErrorEvent: ErrorEventMessage;

        it('wait event message is sent to a conversation that is already waiting', () => {
            eventMessage = new QueueEventMessage(CUSTOMER_ADDRESS);

            expectedErrorEvent = new ErrorEventMessage(eventMessage, new ConversationStateUnchangedException('conversation was already in state wait'))

            return new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(eventMessage, 'you\'re all set to talk to an agent. One will be with you as soon as they become available')
                .sendMessageToBot(eventMessage, expectedErrorEvent)
                .runTest();
        });

        it('watch event message is sent to a conversation that is already in watch state', () => {
            eventMessage = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            expectedErrorEvent = new ErrorEventMessage(eventMessage, new ConversationStateUnchangedException(''))

            return new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(eventMessage)
                .sendMessageToBot(eventMessage, expectedErrorEvent)
                .runTest();
        });
    })
});
