import * as Promise from 'bluebird';
import { BotTester } from 'bot-tester';
import { ConsoleConnector, IAddress, IMessage, Message, Session, UniversalBot } from 'botbuilder';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { setTimeout } from 'timers';
import { QueueEventMessage } from '../src/eventMessages/QueueEventMessage';
import { EventSuccessHandler, EventSuccessHandlers } from '../src/EventSuccessHandlers';
import { CustomerCannotQueueError } from '../src/provider/errors/CustomerCannotQueueError';
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
import { AgentNotWatchingConversationError } from './../src/provider/errors/AgentNotWatchingConversationError';
import { ConversationStateUnchangedException } from './../src/provider/errors/ConversationStateUnchangedException';
import { CustomerAlreadyQueuedError } from './../src/provider/errors/CustomerAlreadyQueuedError';
import { CustomerConnectedToAnotherAgentError } from './../src/provider/errors/CustomerConnectedToAnotherAgentError';
import { CustomernotConnectedToAgentError } from './../src/provider/errors/CustomernotConnectedToAgentError';
import { CustomerNotQueuedError } from './../src/provider/errors/CustomerNotQueuedError';
import { IProvider } from './../src/provider/IProvider';

chai.use(sinonChai);

const expect = chai.expect;

const connector = new ConsoleConnector();

const CUSTOMER_ADDRESS: IAddress = { channelId: 'console',
    user: { id: 'userId1', name: 'user1' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'user1Conversation' }
};

const CUSTOMER_ADDRESS_2: IAddress = { channelId: 'console',
    user: { id: 'userId2', name: 'user2' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'user2Conversation' }
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

    const customer2IntroMessage = new Message()
        .text('hello')
        .address(CUSTOMER_ADDRESS_2)
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
            .sendMessageToBot(customer2IntroMessage)
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
            .then(() => provider.getConversationFromCustomerAddress(msg.customerAddress));
    }

    describe('connect', () => {
        beforeEach(() => {
            eventMessage = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => convo = conversation);
        });

        it('calls the connectSuccess handler', () => {
            expect(successHandlerSpies.connectSuccess).to.have.been.calledOnce;
            expect(successHandlerSpies.connectSuccess).to.have.been.calledWith(bot, eventMessage);
        });

        it('sets the conversation state to agent', () => {
            expect(convo.conversationState).to.equal(ConversationState.Agent);
        });

        it('adds the agent the watching agents list', () => {
            expect(convo.watchingAgents.length).to.equal(1);
            expect(convo.watchingAgents[0]).to.deep.equal(AGENT_ADDRESS);
        });

        it('sets the connected agent address to the connecting agent address', () => {
            expect(convo.agentAddress).to.deep.equal(AGENT_ADDRESS);
        });

        it('returns a CustomerConnectedToAnotherAgentError event if the customer is already connected to another agent', () => {
            eventMessage = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS_2);
            const errorMessage = new ErrorEventMessage(eventMessage, new CustomerConnectedToAnotherAgentError());

            return sendMessageToBotAndGetConversationData(eventMessage, errorMessage)
                .then(() => expect(successHandlerSpies.connectSuccess).not.to.have.been.calledWith(bot, eventMessage));
        });
    });

    describe('disconnect', () => {
        beforeEach(() => {
            const connectMessage = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);
            const watchMessage = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS_2);
            eventMessage = new DisconnectEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(connectMessage)
                .then(() => sendMessageToBotAndGetConversationData(watchMessage))
                .then(() => sendMessageToBotAndGetConversationData(eventMessage))
                .then((conversation: IConversation) => convo = conversation);
        });

        it('calls the disconnectSucces handler', () => {
            expect(successHandlerSpies.disconnectSuccess).to.have.been.calledOnce;
            expect(successHandlerSpies.disconnectSuccess).to.have.been.calledWith(bot, eventMessage);
        });

        it('sets the conversation state to bot', () => {
            expect(convo.conversationState).to.equal(ConversationState.Bot);
        });

        it('removes the formerly connected agent from the watching agents list', () => {
            expect(convo.watchingAgents.length).to.equal(1);

            // added a second watcher to ensure that the array was not just reset
            expect(convo.watchingAgents[0]).to.deep.equal(AGENT_ADDRESS_2);
        });

        it('sets the connected agent address undefined', () => {
            expect(convo.agentAddress).to.be.undefined;
        });

        it('returns a CustomerNotConnectedToAgentError event if the customer is not connected to an agent', () => {
            eventMessage = new DisconnectEventMessage(CUSTOMER_ADDRESS);
            const errorMessage = new ErrorEventMessage(eventMessage, new CustomernotConnectedToAgentError());

            return sendMessageToBotAndGetConversationData(eventMessage, errorMessage);
        });
    });

    describe('watch', () => {
        beforeEach(() => {
            eventMessage = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => convo = conversation);
        });

        it('watch adds agent to the watching agent list', () => {
            expect(convo.watchingAgents.length).to.equal(1);
            expect(convo.watchingAgents[0]).to.deep.equal(AGENT_ADDRESS);
        });

        it('calls the watchSuccess handler', () => {
            expect(successHandlerSpies.watchSuccess).to.have.been.calledWith(bot, eventMessage);
            expect(successHandlerSpies.watchSuccess).to.have.been.calledOnce;
        });

        it('watch does not set the connected agent', () => {
            expect(convo.agentAddress).to.be.undefined;
        });

        it('multiple agents can watch a single conversation', () => {
            eventMessage = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS_2);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => {
                    expect(conversation.watchingAgents.length).to.equal(2);
                    expect(conversation.watchingAgents).to.deep.include(AGENT_ADDRESS);
                    expect(conversation.watchingAgents).to.deep.include(AGENT_ADDRESS_2);

                    expect(successHandlerSpies.watchSuccess).to.have.been.calledWith(bot, eventMessage);
                    expect(successHandlerSpies.watchSuccess).to.have.been.calledTwice;
                });
        });

        it('multuple agents can watch separate conversations separately', () => {
            eventMessage = new WatchEventMessage(CUSTOMER_ADDRESS_2, AGENT_ADDRESS_2);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => {
                    expect(conversation.watchingAgents.length).to.equal(1);
                    expect(conversation.watchingAgents[0]).to.deep.equal(AGENT_ADDRESS_2);

                    expect(successHandlerSpies.watchSuccess).to.have.been.calledWith(bot, eventMessage);
                    expect(successHandlerSpies.watchSuccess).to.have.been.calledTwice;
                });
        });
    });

    describe('unwatch', () => {
        beforeEach(() => {
            const watch1Message = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);
            const watch2Message = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS_2);
            const watch3Message = new WatchEventMessage(CUSTOMER_ADDRESS_2, AGENT_ADDRESS_2);

            eventMessage = new UnwatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(watch1Message)
                .then(() => sendMessageToBotAndGetConversationData(watch2Message))
                .then(() => sendMessageToBotAndGetConversationData(watch3Message))
                .then(() => sendMessageToBotAndGetConversationData(eventMessage))
                .then((conversation: IConversation) => convo = conversation);
        });

        it('calls the unwatchSuccess handler', () => {
            expect(successHandlerSpies.unwatchSuccess).to.have.been.calledOnce;
            expect(successHandlerSpies.unwatchSuccess).to.have.been.calledWith(bot, eventMessage);
        });

        it('removes the agent from the watching agent collection', () => {
            expect(convo.watchingAgents.length).to.equal(1);
            expect(convo.watchingAgents).to.deep.include(AGENT_ADDRESS_2);
        });

        it('does not affect a conversation with a connected agent', () => {
            expect(convo.agentAddress).to.be.undefined;

            const connectMessage = new ConnectEventMessage(CUSTOMER_ADDRESS_2, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(connectMessage)
                .then((conversation: IConversation) => {
                    expect(conversation.agentAddress).to.deep.equal(AGENT_ADDRESS);
                    expect(conversation.conversationState).to.equal(ConversationState.Agent);
                })
                .then(() => {
                    return sendMessageToBotAndGetConversationData(new UnwatchEventMessage(CUSTOMER_ADDRESS_2, AGENT_ADDRESS_2));
                })
                .then((conversation: IConversation) => {
                    expect(conversation.agentAddress).to.deep.equal(AGENT_ADDRESS);
                    expect(conversation.conversationState).to.equal(ConversationState.Agent);
                });
        });

        it('throws an AgentNotWatchingConversationError error event', () => {
            eventMessage = new UnwatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            const expectedErrorMessage = new ErrorEventMessage(eventMessage, new AgentNotWatchingConversationError());

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then(() => sendMessageToBotAndGetConversationData(eventMessage, expectedErrorMessage));
        });
    });

    describe('queue (wait)', () => {
        beforeEach(() => {
            eventMessage = new QueueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => convo = conversation);
        });

        it('calls the queue success handler', () => {
            expect(successHandlerSpies.queueSuccess).to.have.been.calledOnce;
            expect(successHandlerSpies.queueSuccess).to.have.been.calledWith(bot, eventMessage);
        });

        it('causes the converation to go into a wait state', () => {
            expect(convo.conversationState).to.equal(ConversationState.Wait);
        });

        it('does NOT go to connected when there are agents watching', () => {
            const watchMessage = new WatchEventMessage(CUSTOMER_ADDRESS_2, AGENT_ADDRESS);
            eventMessage = new QueueEventMessage(CUSTOMER_ADDRESS_2);

            return sendMessageToBotAndGetConversationData(watchMessage)
                .then(() => sendMessageToBotAndGetConversationData(eventMessage))
                .then((conversation: IConversation) => {
                    expect(conversation.agentAddress).to.be.undefined;
                    expect(conversation.conversationState).to.equal(ConversationState.Wait);
                    expect(conversation.watchingAgents.length).to.equal(1);
                    expect(conversation.watchingAgents[0]).to.deep.equal(AGENT_ADDRESS);

                });
        });

        it('returns a CustomerAlreadQueuedError error message when sent to a customer that is already waiting', () => {
            const errorMessage = new ErrorEventMessage(eventMessage, new CustomerAlreadyQueuedError());

            return sendMessageToBotAndGetConversationData(eventMessage, errorMessage);
        });
    });

    describe('dequeue (unwait)', () => {
        beforeEach(() => {
            const waitMessage = new QueueEventMessage(CUSTOMER_ADDRESS);
            eventMessage = new DequeueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(waitMessage)
                .then(() => sendMessageToBotAndGetConversationData(eventMessage))
                .then((conversation: IConversation) => convo = conversation);
        });

        it('sets the conversation state to bot', () => {
            expect(convo.conversationState).to.be.equal(ConversationState.Bot);
        });

        it('calls the dequeueSuccessHandler', () => {
            expect(successHandlerSpies.dequeueSuccess).to.have.been.calledOnce;
            expect(successHandlerSpies.dequeueSuccess).to.have.been.calledWith(bot, eventMessage);
        });

        it('does NOT affect any watching agents', () => {
            const watch1Message = new WatchEventMessage(CUSTOMER_ADDRESS_2, AGENT_ADDRESS);
            const watch2Message = new WatchEventMessage(CUSTOMER_ADDRESS_2, AGENT_ADDRESS_2);
            const queueMessage = new QueueEventMessage(CUSTOMER_ADDRESS_2);
            eventMessage = new DequeueEventMessage(CUSTOMER_ADDRESS_2);

            return sendMessageToBotAndGetConversationData(watch1Message)
                .then(() => sendMessageToBotAndGetConversationData(watch2Message))
                .then(() => sendMessageToBotAndGetConversationData(queueMessage))
                .then(() => sendMessageToBotAndGetConversationData(eventMessage))
                .then((conversation: IConversation) => {
                    expect(conversation.watchingAgents.length).to.equal(2);
                    expect(conversation.watchingAgents).to.deep.include(AGENT_ADDRESS);
                    expect(conversation.watchingAgents).to.deep.include(AGENT_ADDRESS_2);
                    expect(conversation.conversationState).to.equal(ConversationState.Bot);
                });
        });

        // includes bot AND agent state
        it('returns a CustomerNotQueuedError event when the customer dequeue message is sent to customer that is not queued', () => {
            const errorMessage = new ErrorEventMessage(eventMessage, new CustomerNotQueuedError());

            // conversation state === Bot
            return sendMessageToBotAndGetConversationData(eventMessage, errorMessage)
                .then(() => sendMessageToBotAndGetConversationData(new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS)))

                // conversation state === Agent
                .then(() => sendMessageToBotAndGetConversationData(eventMessage, errorMessage));
        });
    });
});
