import * as Promise from 'bluebird';
import { BotTester } from 'bot-tester';
import { ConsoleConnector, IAddress, IMessage, Message, Session, UniversalBot } from 'botbuilder';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { setTimeout } from 'timers';
import { QueueEventMessage } from '../src/eventMessages/QueueEventMessage';
import { EventSuccessHandler, EventSuccessHandlers } from '../src/EventSuccessHandlers';
import { InMemoryProvider } from '../src/provider/prebuilt/InMemoryProvider';
import { applyHandoffMiddleware } from './../src/applyHandoffMiddleware';
import { ConnectEventMessage } from './../src/eventMessages/ConnectEventMessage';
import { DequeueEventMessage } from './../src/eventMessages/DequeueEventMessage';
import { DisconnectEventMessage } from './../src/eventMessages/DisconnectEventMessage';
import { ErrorEventMessage } from './../src/eventMessages/ErrorEventMessage';
import { HandoffEventMessage } from './../src/eventMessages/HandoffEventMessage';
import { UnwatchEventMessage } from './../src/eventMessages/UnwatchEventMessage';
import { WatchEventMessage } from './../src/eventMessages/WatchEventMessage';
import { defaultSuccessHandlers } from './../src/EventSuccessHandlers';
import { ConversationState, IConversation } from './../src/IConversation';
import { addCustomerAddressToMessage, IHandoffMessage } from './../src/IHandoffMessage';
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

function createSuccessHandlerSpies(): EventSuccessHandlers {
    const defaultHandlers = defaultSuccessHandlers;

    return {
        connectSuccess: sinon.spy() as EventSuccessHandler,
        disconnectSuccess: sinon.spy() as EventSuccessHandler,
        queueSuccess: sinon.spy() as EventSuccessHandler,
        dequeueSuccess: sinon.spy() as EventSuccessHandler,
        watchSuccess: sinon.spy() as EventSuccessHandler,
        unwatchSuccess: sinon.spy() as EventSuccessHandler
    };
}

function expectConvoIsInWaitAndWatchState(convo: IConversation): void {
    expect(convo.agentAddress).to.deep.equal(AGENT_ADDRESS);
    expect(convo.customerAddress).to.deep.equal(CUSTOMER_ADDRESS);
    expect(convo.conversationState).to.be.equal(ConversationState.WatchAndWait);
}

function expectCallCount(count: number, ...spies: {}[]): void {
    spies.forEach((spy: {}) => expect(spy).to.have.been.callCount(count));
}

function expectZeroCallsToSpies(...spies: {}[]): void {
    expectCallCount(0, ...spies);
}

describe('event message', () => {
    let bot: UniversalBot;
    let provider: IProvider;
    let eventMessage: HandoffEventMessage;
    let convo: IConversation;

    // actually a spy, but allows us to group the related spies and pass them off as the existing functions
    let successHandlerSpies: EventSuccessHandlers;

    // actually a spy, but this allows us to only focus on the relevant methods
    let providerSpy: IProvider;

    const customerIntroMessage = new Message()
        .text('hello')
        .address(CUSTOMER_ADDRESS)
        .toMessage();

    beforeEach(() => {
        provider = new InMemoryProvider();
        providerSpy = createIProviderSpy(provider);
        successHandlerSpies = createSuccessHandlerSpies();
        bot = new UniversalBot(connector);

        bot.dialog('/', (session: Session) => {
            session.send('intro!');
        });

        applyHandoffMiddleware(bot, isAgent, provider, successHandlerSpies);

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
        beforeEach(() => {
            eventMessage = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => convo = conversation);
        });

        it('connect sets converation state to Agent and calls the connect success event handler', () => {
            expect(convo.conversationState).to.be.equal(ConversationState.Agent);
            expect(providerSpy.connectCustomerToAgent).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
            expect(successHandlerSpies.connectSuccess).to.have.been.calledWith(bot, eventMessage);
            expect(successHandlerSpies.connectSuccess).to.have.been.calledOnce;
        });

        it('disconnect sets converation state to Bot and calls the disconnect success event handler', () => {
            eventMessage = new DisconnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => {
                    expect(conversation.conversationState).to.be.equal(ConversationState.Bot);
                    expect(providerSpy.disconnectCustomerFromAgent).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
                    expect(successHandlerSpies.disconnectSuccess).to.have.been.calledWith(bot, eventMessage);
                    expect(successHandlerSpies.disconnectSuccess).to.have.been.calledOnce;
                });
        });

        //tslint:disable
        it('sending connect event to an already connected conversation responds with an error event to the requesting agent and the success event handler is not called', () => {
        //tslint:enable
            const errorEventMessage =
                new ErrorEventMessage(eventMessage, new AgentAlreadyInConversationError(AGENT_ADDRESS.conversation.id));

            const errorMessage = new ErrorEventMessage(eventMessage, 'some error goes here');

            return new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(eventMessage, errorEventMessage)
                .runTest()
                .then(() => expect(successHandlerSpies.connectSuccess).to.have.been.calledOnce);
        });

        //tslint:disable
        it('throws a CustomerAlreadyConnectedException to an agent that attempts to connect to a user that is already connect to another agent', () => {
        //tstlint:enable
            const connectionEvent1 = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);
            const connectionEvent2 = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS_2);

            const expectedErrorMsg = new ErrorEventMessage(connectionEvent2, { name: "CustomerAlreadyConnectedException" });

            return new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(connectionEvent2, expectedErrorMsg)
                .runTest()
                .then(() => expect(successHandlerSpies.connectSuccess).to.have.been.calledOnce);
        });
    });

    describe('watch/unwatch', () => {
        beforeEach(() => {
            eventMessage = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => convo = conversation);
        });

        it('watch sets the conversation state to watch when in bot state', () => {
            expect(convo.conversationState).to.be.equal(ConversationState.Watch);
            expect(convo.customerAddress).to.be.equal(CUSTOMER_ADDRESS);
            expect(convo.agentAddress).to.deep.equal(AGENT_ADDRESS);
            expect(successHandlerSpies.watchSuccess).to.have.been.calledWith(bot, eventMessage);
            expect(successHandlerSpies.watchSuccess).to.have.been.calledOnce;
        });

        it('unwatch sets the conversation state to bot when in a watch state', () => {
            eventMessage = new UnwatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversationt: IConversation) => {
                    expect(conversationt.conversationState).to.be.equal(ConversationState.Bot);
                    expect(conversationt.customerAddress).to.be.equal(CUSTOMER_ADDRESS);
                    expect(conversationt.agentAddress).to.be.undefined;
                    expect(successHandlerSpies.unwatchSuccess).to.have.been.calledWith(bot, eventMessage);
                    expect(successHandlerSpies.unwatchSuccess).to.have.been.calledOnce;
                });
        });

        it('watch sets the conversation to wait and watch when in wait state', () => {
            eventMessage = new QueueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then(expectConvoIsInWaitAndWatchState)
                .then(() => expect(successHandlerSpies.queueSuccess).to.have.been.calledOnce)
        });
    });

    describe('wait/unwait', () => {
        beforeEach(() => {
            eventMessage = new QueueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => convo = conversation);
        });

        it('wait sets the conversation state to wait when in bot state', () => {
            expect(convo.conversationState).to.be.equal(ConversationState.Wait);
            expect(convo.customerAddress).to.be.equal(CUSTOMER_ADDRESS);
            expect(convo.agentAddress).to.be.undefined;
            expect(successHandlerSpies.queueSuccess).to.have.been.calledOnce;
        });

        it('unwait sets the conversation state to bot when in a unwait state', () => {
            eventMessage = new DequeueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((convo: IConversation) => {
                    expect(convo.conversationState).to.be.equal(ConversationState.Bot);
                    expect(convo.customerAddress).to.be.equal(CUSTOMER_ADDRESS);
                    expect(convo.agentAddress).to.be.undefined;
                    expect(successHandlerSpies.dequeueSuccess).to.have.been.calledOnce;
                });
        });

        it('wait sets the conversation to wait and watch when in watch state', () => {
            eventMessage = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS)

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then(expectConvoIsInWaitAndWatchState)
                .then(() => expect(successHandlerSpies.watchSuccess).to.have.been.calledOnce);
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
                .then(expectConvoIsInWaitAndWatchState)
                .then(() => {
                    expect(successHandlerSpies.watchSuccess).to.have.been.calledOnce;
                    expect(successHandlerSpies.queueSuccess).to.have.been.calledOnce;
                })
        });

        it('returns to wait with an unwatch event', () => {
            eventMessage = new UnwatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((convo: IConversation) => {
                    expect(convo.conversationState).to.be.equal(ConversationState.Wait);
                    expect(convo.agentAddress).to.be.undefined;
                    expect(successHandlerSpies.unwatchSuccess).to.have.been.calledOnce;
                });
        });

        it('returns to watch with an unwait (dequeue) event', () => {
            eventMessage = new DequeueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((convo: IConversation) => {
                    expect(convo.conversationState).to.be.equal(ConversationState.Watch);
                    expect(convo.agentAddress).to.deep.equal(AGENT_ADDRESS);
                    expect(successHandlerSpies.dequeueSuccess).to.have.been.calledOnce;
                });
        });
    });

    describe('conversation state unchanged error is thrown when', () => {
        let expectedErrorEvent: ErrorEventMessage;

        it('wait event message is sent to a conversation that is already waiting', () => {
            eventMessage = new QueueEventMessage(CUSTOMER_ADDRESS);

            expectedErrorEvent = new ErrorEventMessage(eventMessage, new ConversationStateUnchangedException('conversation was already in state wait'))

            return new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(eventMessage)
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
    });
});
