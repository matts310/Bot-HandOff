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

    // describe('connect/disconnect', () => {
    //     beforeEach(() => {
    //         eventMessage = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

    //         return sendMessageToBotAndGetConversationData(eventMessage)
    //             .then((conversation: IConversation) => convo = conversation);
    //     });

    //     it('connect sets converation state to Agent and calls the connect success event handler', () => {
    //         expect(convo.conversationState).to.be.equal(ConversationState.Agent);
    //         expect(providerSpy.connectCustomerToAgent).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
    //         expect(successHandlerSpies.connectSuccess).to.have.been.calledWith(bot, eventMessage);
    //         expect(successHandlerSpies.connectSuccess).to.have.been.calledOnce;
    //     });

    //     it('disconnect sets converation state to Bot and calls the disconnect success event handler', () => {
    //         eventMessage = new DisconnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

    //         return sendMessageToBotAndGetConversationData(eventMessage)
    //             .then((conversation: IConversation) => {
    //                 expect(conversation.conversationState).to.be.equal(ConversationState.Bot);
    //                 expect(providerSpy.disconnectCustomerFromAgent).to.have.been.calledWith(CUSTOMER_ADDRESS, AGENT_ADDRESS);
    //                 expect(successHandlerSpies.disconnectSuccess).to.have.been.calledWith(bot, eventMessage);
    //                 expect(successHandlerSpies.disconnectSuccess).to.have.been.calledOnce;
    //             });
    //     });

    //     //tslint:disable
    //     it('sending connect event to an already connected conversation responds with an error event to the requesting agent and the success event handler is not called', () => {
    //     //tslint:enable
    //         const errorEventMessage =
    //             new ErrorEventMessage(eventMessage, new AgentAlreadyInConversationError(AGENT_ADDRESS.conversation.id));

    //         const errorMessage = new ErrorEventMessage(eventMessage, 'some error goes here');

    //         return new BotTester(bot, CUSTOMER_ADDRESS)
    //             .sendMessageToBot(eventMessage, errorEventMessage)
    //             .runTest()
    //             .then(() => expect(successHandlerSpies.connectSuccess).to.have.been.calledOnce);
    //     });

    //     //tslint:disable
    //     it('throws a CustomerAlreadyConnectedException to an agent that attempts to connect to a user that is already connect to another agent', () => {
    //     //tslint:enable
    //         const connectionEvent1 = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);
    //         const connectionEvent2 = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS_2);

    //         const expectedErrorMsg = new ErrorEventMessage(connectionEvent2, { name: 'CustomerAlreadyConnectedException' });

    //         return new BotTester(bot, CUSTOMER_ADDRESS)
    //             .sendMessageToBot(connectionEvent2, expectedErrorMsg)
    //             .runTest()
    //             .then(() => expect(successHandlerSpies.connectSuccess).to.have.been.calledOnce);
    //     });
    // });

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
            expect.fail(null, null, 'CustomerConnectedToAnotherAgentError not yet implemented');

            eventMessage = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS_2);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then(() => expect.fail(null, null, 'should have returned a CustomerConnectedToAnotherAgentError event'));
        });
    });

    describe('disconnect', () => {
        beforeEach(() => {
            const connectMessage = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);
            const watchMessage = new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS_2);
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
            expect.fail(null, null, 'CustomerNotConnectedToAgentError not yet implemented');

            eventMessage = new DisconnectEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then(() => expect.fail(null, null, 'should have returned a CustomerConnectedToAnotherAgentError event'));
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
                .then(() => sendMessageToBotAndGetConversationData(new UnwatchEventMessage(CUSTOMER_ADDRESS_2, AGENT_ADDRESS_2)))
                .then((conversation: IConversation) => {
                    expect(conversation.agentAddress).to.deep.equal(AGENT_ADDRESS);
                    expect(conversation.conversationState).to.equal(ConversationState.Agent);
                });
        });

        it('unwatch sets the conversation state to bot when in a watch state', () => {
            eventMessage = new UnwatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversationt: IConversation) => {
                    expect(conversationt.conversationState).to.be.equal(ConversationState.Bot);
                    expect(conversationt.customerAddress).to.be.equal(CUSTOMER_ADDRESS);
                    expect(conversationt.agentAddress).to.be.undefined;
                    expect(successHandlerSpies.unwatchSuccess).to.have.been.calledWith(bot, eventMessage);
                    expect(successHandlerSpies.unwatchSuccess).to.have.been.calledThrice;
                });
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
            expect.fail(null, null, 'CustomerAlreadQueuedError not yet implemented');

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => convo = conversation);
        });
    });

    describe('dequeue (unwait)', () => {
        beforeEach(() => {
            eventMessage = new DequeueEventMessage(CUSTOMER_ADDRESS);

            return sendMessageToBotAndGetConversationData(eventMessage)
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
            const queueMessage = new QueueEventMessage(CUSTOMER_ADDRESS);
            eventMessage = new DequeueEventMessage(CUSTOMER_ADDRESS);

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
            expect.fail(null, null, 'CustomerAlreadQueuedError not yet implemented');

            return sendMessageToBotAndGetConversationData(eventMessage)
                .then((conversation: IConversation) => convo = conversation);
        });
    });

    xdescribe('conversation state unchanged error is thrown when', () => {
        let expectedErrorEvent: ErrorEventMessage;

        it('wait event message is sent to a conversation that is already waiting', () => {
            eventMessage = new QueueEventMessage(CUSTOMER_ADDRESS);

            expectedErrorEvent = new ErrorEventMessage(eventMessage, new ConversationStateUnchangedException('conversation was already in state wait'));

            return new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(eventMessage)
                .sendMessageToBot(eventMessage, expectedErrorEvent)
                .runTest();
        });

        it('watch event message is sent to a conversation that is already in watch state', () => {
            eventMessage = new WatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

            expectedErrorEvent = new ErrorEventMessage(eventMessage, new ConversationStateUnchangedException(''));

            return new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(eventMessage)
                .sendMessageToBot(eventMessage, expectedErrorEvent)
                .runTest();
        });
    });
});
