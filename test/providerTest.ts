import * as Promise from 'bluebird';
import { IAddress, Message } from 'botbuilder';
import { expect } from 'chai';
import { find, isEqual } from 'lodash';
import { CustomerCannotQueueError } from '../src/provider/errors/CustomerCannotQueueError';
import { ConversationState, IConversation, ITranscriptLine } from './../src/IConversation';
import { addAgentAddressToMessage, addCustomerAddressToMessage } from './../src/IHandoffMessage';
import { IHandoffMessage } from './../src/IHandoffMessage';
import { AgentAlreadyInConversationError } from './../src/provider/errors/AgentAlreadyInConversationError';
import { AgentConnectingIsNotSameAsWatching } from './../src/provider/errors/AgentConnectingIsNotSameAsWatching';
import { AgentNotInConversationError } from './../src/provider/errors/AgentNotInConversationError';
import {
    BotAttemptedToRecordMessageWhileAgentHasConnection
} from './../src/provider/errors/BotAttemptedToRecordMessageWhileAgentHasConnection';
import { CustomerAlreadyQueuedError } from './../src/provider/errors/CustomerAlreadyQueuedError';
import { CustomerConnectedToAnotherAgentError } from './../src/provider/errors/CustomerConnectedToAnotherAgentError';
import { CustomernotConnectedToAgentError } from './../src/provider/errors/CustomernotConnectedToAgentError';
import { IProvider } from './../src/provider/IProvider';

const CUSTOMER_1_ADDRESS: IAddress = { channelId: 'console',
    user: { id: 'c1Id', name: 'c1' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'c1Conversation' }
};

const CUSTOMER_2_ADDRESS: IAddress = { channelId: 'console',
    user: { id: 'c2Id', name: 'c2' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'c2Conversation' }
};

const AGENT_1_ADDRESS: IAddress = { channelId: 'console',
    user: { id: 'a1Id', name: 'a1' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'a1Conversation' }
};

const AGENT_2_ADDRESS: IAddress = { channelId: 'console',
    user: { id: 'a2Id', name: 'a2' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'a2Conversation' }
};

export function providerTest(getNewProvider: () => Promise<IProvider>, providerName: string): void {
    let provider: IProvider;
    const CUSTOMER_1_INTRO_MESSAGE =
        new Message()
            .text('c1 intro')
            .address(CUSTOMER_1_ADDRESS)
            .toMessage() as IHandoffMessage;

    const CUSTOMER_2_INTRO_MESSAGE =
        new Message()
            .text('c2 intro')
            .address(CUSTOMER_2_ADDRESS)
            .toMessage() as IHandoffMessage;

    // needed for routing. These are added by the management layer above the provider layer. This is the only place we need to mock that
    // layer
    CUSTOMER_1_INTRO_MESSAGE.customerAddress = CUSTOMER_1_ADDRESS;
    CUSTOMER_2_INTRO_MESSAGE.customerAddress = CUSTOMER_2_ADDRESS;

    describe(providerName, () => {
        beforeEach(() => {
            return getNewProvider()
                .then((newProvider: IProvider) => provider = newProvider)
                .then(() => provider.addCustomerMessageToTranscript(CUSTOMER_1_INTRO_MESSAGE))
                .then(() => provider.addCustomerMessageToTranscript(CUSTOMER_2_INTRO_MESSAGE));
        });

        it('add customer message adds customer message to the respective customer conversation', () => {
            const customer1SecondMessage = new Message()
                .text('c1 second message')
                .address(CUSTOMER_1_ADDRESS)
                .toMessage() as IHandoffMessage;

            customer1SecondMessage.customerAddress = CUSTOMER_1_ADDRESS;

            return provider.addCustomerMessageToTranscript(customer1SecondMessage)
                .then((convo: IConversation) => {
                    expect(convo.transcript.length).to.be.equal(2);

                    expect(convo.transcript[0].from).to.deep.equal(CUSTOMER_1_ADDRESS);
                    expect(convo.transcript[0].text).to.equal(CUSTOMER_1_INTRO_MESSAGE.text);

                    expect(convo.transcript[1].from).to.deep.equal(CUSTOMER_1_ADDRESS);
                    expect(convo.transcript[1].text).to.equal(customer1SecondMessage.text);
                })
                .then(() => provider.getConversationFromCustomerAddress(CUSTOMER_2_ADDRESS))
                .then((convo: IConversation) => {
                    expect(convo.transcript.length).to.be.equal(1);

                    expect(convo.transcript[0].from).to.deep.equal(CUSTOMER_2_ADDRESS);
                    expect(convo.transcript[0].text).to.equal(CUSTOMER_2_INTRO_MESSAGE.text);
                });
        });

        describe('customer queue for agent (customer in wait state)', () => {
            let convo: IConversation;

            beforeEach(() => {
                return provider.queueCustomerForAgent(CUSTOMER_1_ADDRESS)
                    .then((conversation: IConversation) => convo = conversation);
            });

            it('sets the conversation state to wait', () => {
                expect(convo.conversationState).to.equal(ConversationState.Wait);
            });

            it('does not cuase any agents to be watching or connected', () => {
                expect(convo.agentAddress).to.be.undefined;
                expect(convo.watchingAgents).to.be.empty;
            });

            it('is not affected by the addition of watching agents', () => {
                return provider.watchConversation(CUSTOMER_1_ADDRESS, AGENT_1_ADDRESS)
                    .then(() =>  provider.watchConversation(CUSTOMER_1_ADDRESS, AGENT_2_ADDRESS))
                    .then((conversation: IConversation) => {
                        expect(convo.conversationState).to.equal(ConversationState.Wait);
                        expect(convo.watchingAgents.length).to.equal(2);
                        expect(convo.watchingAgents).to.deep.include(AGENT_1_ADDRESS);
                        expect(convo.watchingAgents).to.deep.include(AGENT_2_ADDRESS);
                    });
            });

            it('throw CustomerAlreadyQueuedError if the customer is already in a wait state', () => {
                return provider.queueCustomerForAgent(CUSTOMER_1_ADDRESS)
                    .then(() => expect.fail(null, null, 'expected throw CustomerAlreadyQueuedError'))
                    .catch(CustomerAlreadyQueuedError, (e: CustomerAlreadyQueuedError) => {
                        expect(e).to.be.an.instanceOf(CustomerAlreadyQueuedError);
                    });
            });

            it('throws a CustomerCannotQueueError if the customer is connected to an agent', () => {
                return provider.connectCustomerToAgent(CUSTOMER_2_ADDRESS, AGENT_2_ADDRESS)
                    .then(() => provider.queueCustomerForAgent(CUSTOMER_2_ADDRESS))
                    .then(() => expect.fail(null, null, 'expected CustomerCannotQueue error to be thrown'))
                    .catch(CustomerCannotQueueError, (e: CustomerCannotQueueError) => {
                        expect(e).to.be.an.instanceOf(CustomerCannotQueueError);
                    });
            });
        });

        describe('customer dequeue for agent (customer was not connected to agent, chooses to cancel)', () => {
            it('sets the conversation state to bot', () => {
                return provider.queueCustomerForAgent(CUSTOMER_1_ADDRESS)
                    .then(() => provider.dequeueCustomerForAgent(CUSTOMER_1_ADDRESS))
                    .then((convo: IConversation) => {
                        expect(convo.conversationState).to.equal(ConversationState.Bot);
                    });
            });
        });

        describe('agent connecting to customer', () => {
            let convo: IConversation;

            beforeEach(() => {
                return provider.connectCustomerToAgent(CUSTOMER_1_ADDRESS, AGENT_1_ADDRESS)
                    .then((conversation: IConversation) => convo = conversation);
            });

            it('sets the conversation state to Agent', () => {
                expect(convo.conversationState).to.equal(ConversationState.Agent);
            });

            it('adds the connected agent to the watching agent list', () => {
                expect(convo.watchingAgents.length).to.equal(1);
                expect(convo.watchingAgents[0]).to.deep.equal(AGENT_1_ADDRESS);
            });

            it('sets the connected agent address to the connecting agent', () => {
                expect(convo.agentAddress).to.deep.equal(AGENT_1_ADDRESS);
            });

            it('throws a CustomerConnectedToAnotherAgentError if the customer is connected to another agent', () => {
                // expect.fail(null, null, 'this is not yet defined');
                return provider.connectCustomerToAgent(CUSTOMER_1_ADDRESS, AGENT_2_ADDRESS)
                    .then(() => expect.fail(null, null, 'should have thrown CustomerConnectedToAnotherAgentError'))
                    .catch(CustomerConnectedToAnotherAgentError, (e: CustomerConnectedToAnotherAgentError) => {
                        expect(e).to.be.an.instanceOf(CustomerConnectedToAnotherAgentError);
                    });
            });

            it('does not hinder agent connecting to additional customers', () => {
                return provider.connectCustomerToAgent(CUSTOMER_2_ADDRESS, AGENT_1_ADDRESS)
                    .then((conversation: IConversation) => {
                        expect(convo.conversationState).to.equal(ConversationState.Agent);
                        expect(convo.watchingAgents.length).to.equal(1);
                        expect(convo.watchingAgents[0]).to.deep.equal(AGENT_1_ADDRESS);
                        expect(convo.agentAddress).to.deep.equal(AGENT_1_ADDRESS);
                    });
            });

            it('does not affect the connection of other agents connected to other customers', () => {
                return provider.connectCustomerToAgent(CUSTOMER_2_ADDRESS, AGENT_2_ADDRESS)
                    .then((customer2Convo: IConversation) => {
                        expect(customer2Convo.conversationState).to.equal(ConversationState.Agent);
                        expect(customer2Convo.watchingAgents.length).to.equal(1);
                        expect(customer2Convo.watchingAgents[0]).to.deep.equal(AGENT_2_ADDRESS);
                        expect(customer2Convo.agentAddress).to.deep.equal(AGENT_2_ADDRESS);
                    });
            });

            it('does not affect the watch list if the agent is already watching the conversation', () => {
                return provider.watchConversation(CUSTOMER_2_ADDRESS, AGENT_2_ADDRESS)
                    .then(() => provider.connectCustomerToAgent(CUSTOMER_2_ADDRESS, AGENT_2_ADDRESS))
                        .then((customer2Convo: IConversation) => {
                            expect(customer2Convo.conversationState).to.equal(ConversationState.Agent);
                            expect(customer2Convo.watchingAgents.length).to.equal(1);
                            expect(customer2Convo.watchingAgents[0]).to.deep.equal(AGENT_2_ADDRESS);
                            expect(customer2Convo.agentAddress).to.deep.equal(AGENT_2_ADDRESS);
                        });
            });
        });

        describe('customer-agent disconnection', () => {
            let convo: IConversation;

            beforeEach(() => {
                return provider.connectCustomerToAgent(CUSTOMER_1_ADDRESS, AGENT_1_ADDRESS)
                    .then(() => provider.disconnectCustomerFromAgent(CUSTOMER_1_ADDRESS))
                    .then((conversation: IConversation) => convo = conversation);
            });

            it('sets the conversation state to bot', () => {
                expect(convo.conversationState).to.equal(ConversationState.Bot);
            });

            it('removes the formerly conencted agent from the connected agent field', () => {
                expect(convo.agentAddress).to.be.undefined;
            });

            it('removes the formerly connected agent from the watching agent list', () => {
                expect(convo.watchingAgents).to.be.empty;
            });

            // should test the wait and bot state here
            it('throws a CustomerNotConnectedToAgentError if the customer is not connected to an agent', () => {
                // expect.fail(null, null, 'this is not yet implemented');
                return provider.disconnectCustomerFromAgent(CUSTOMER_2_ADDRESS)
                    .then(() => expect.fail(null, null, 'should have thrown CustomernotConnectedToAgentError'))
                    .catch(CustomernotConnectedToAgentError, (e: CustomernotConnectedToAgentError) => {
                        expect(e).to.be.an.instanceOf(CustomernotConnectedToAgentError);
                    });
            });
        });
    });
}
