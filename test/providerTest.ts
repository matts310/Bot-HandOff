import * as Promise from 'bluebird';
import { IAddress, IMessage, Message } from 'botbuilder';
import { expect } from 'chai';
import { ConversationState, MessageSource } from './../src/constants';
import { IConversation, ITranscriptLine } from './../src/IConversation';
import { addAgentAddressToMessage, addCustomerAddressToMessage, IHandoffMessage } from './../src/IHandoffMessage';
import { InMemoryProvider } from './../src/provider/prebuilt/InMemoryProvider';

import { AgentAlreadyInConversationError } from './../src/provider/errors/AgentAlreadyInConversationError';
import { AgentConnectingIsNotSameAsWatching } from './../src/provider/errors/AgentConnectingIsNotSameAsWatching';
import { AgentNotInConversationError } from './../src/provider/errors/AgentNotInConversationError';
import {
    BotAttemptedToRecordMessageWhileAgentHasConnection
} from './../src/provider/errors/BotAttemptedToRecordMessageWhileAgentHasConnection';
import { IProvider } from './../src/provider/IProvider';

const ADDRESS_1: IAddress = { channelId: 'console',
    user: { id: 'userId1', name: 'user1' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'user1Conversation' }
};

const ADDRESS_2: IAddress = { channelId: 'console',
    user: { id: 'userId2', name: 'user2' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'user2Conversation' }
};

const ADDRESS_3: IAddress = { channelId: 'console',
    user: { id: 'userId3', name: 'user3' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'user3Conversation' }
};

export function providerTest(getNewProvider: () => Promise<IProvider>, providerName: string): void {
    const customer1Address = ADDRESS_1;
    const customer2Address = ADDRESS_2;
    const agent1Address1 = ADDRESS_3;

    // agent1Adress1 and agent2Address 2 both belong to user agent1, however they have different conversation ids
    const agent1Address2 = Object.assign({}, agent1Address1, {conversation: { id: `${agent1Address1.conversation.id}2`}});

    let provider: IProvider;

    describe(providerName, () => {
        beforeEach(() => {
            return getNewProvider()
                .then((newProvider: IProvider) => {
                    provider = newProvider;
                });
        });

        describe('customer messages', () => {
            const message1Address1 = new Message()
                .address(ADDRESS_1)
                .text('first message')
                .toMessage();

            const message2Address1 = new Message()
                .address(ADDRESS_1)
                .text('second message')
                .toMessage();

            const message3Address1 = new Message()
                .address(ADDRESS_1)
                .text('third message')
                .toMessage();

            const message1Address2 = new Message()
                .address(ADDRESS_2)
                .text('first message')
                .toMessage();

            const message2Address2 = new Message()
                .address(ADDRESS_2)
                .text('second message')
                .toMessage();

            const message3Address2 = new Message()
                .address(ADDRESS_2)
                .text('third message')
                .toMessage();

            addCustomerAddressToMessage(message1Address1, ADDRESS_1);
            addCustomerAddressToMessage(message2Address1, ADDRESS_1);
            addCustomerAddressToMessage(message3Address1, ADDRESS_1);
            addCustomerAddressToMessage(message1Address2, ADDRESS_2);
            addCustomerAddressToMessage(message2Address2, ADDRESS_2);
            addCustomerAddressToMessage(message3Address2, ADDRESS_2);

            beforeEach(() => {
                return Promise.join(
                    provider.addCustomerMessageToTranscript(message1Address1),
                    provider.addCustomerMessageToTranscript(message2Address1),
                    provider.addCustomerMessageToTranscript(message3Address1),

                    provider.addCustomerMessageToTranscript(message1Address2),
                    provider.addCustomerMessageToTranscript(message2Address2),
                    provider.addCustomerMessageToTranscript(message3Address2)
                );
            });

            const verifyConversationForAddress = (convo: IConversation, address: IAddress): void => {
                expect(convo.customerAddress).to.deep.equal(address);
                expect(convo.agentAddress).to.be.undefined;
                expect(convo.transcript.length).to.be.equal(3);
                const transcript = convo.transcript;

                transcript.forEach((t: ITranscriptLine) => expect(t.from).to.be.equal(address.user.name));
                expect(transcript[0].text).to.be.equal('first message');
                expect(transcript[1].text).to.be.equal('second message');
                expect(transcript[2].text).to.be.equal('third message');
            };

            it('can be retrieved in a conversation form', () => {
                return provider.getConversationFromCustomerAddress(ADDRESS_1)
                    .then((convo: IConversation) => verifyConversationForAddress(convo, ADDRESS_1));
            });

            it('can be uniquely retrieved for separate customers', () => {
                return Promise.join(
                    provider.getConversationFromCustomerAddress(ADDRESS_1),
                    provider.getConversationFromCustomerAddress(ADDRESS_2)
                )
                    .spread((convo1: IConversation, convo2: IConversation) => {
                        verifyConversationForAddress(convo1, ADDRESS_1);
                        verifyConversationForAddress(convo2, ADDRESS_2);
                    });
            });
        });

        describe('customer queue for agent', () => {
            const message = new Message()
                .address(customer1Address)
                .text('message')
                .toMessage();

            addCustomerAddressToMessage(message, customer1Address);

            beforeEach(() => {
                return provider.addCustomerMessageToTranscript(message)
                    .then(() => provider.queueCustomerForAgent(customer1Address));
            });

            it('updates conversation state to be wait', () => {
                return provider.getConversationFromCustomerAddress(customer1Address)
                    .then((conversation: IConversation) => {
                        expect(conversation.agentAddress).to.be.undefined;
                        expect(conversation.conversationState).to.be.equal(ConversationState.Wait);
                        expect(conversation.transcript.length).to.be.equal(1);
                    });
            });

            it('allows bot messages to be recorded withbout affecting state', () => {
                const msg = Object.assign({}, message, { text: 'bot message' });

                return provider.addBotMessageToTranscript(msg)
                    .then(() => provider.getConversationFromCustomerAddress(customer1Address))
                    .then((convo: IConversation) => {
                        expect(convo.agentAddress).to.be.undefined;
                        expect(convo.conversationState).to.be.equal(ConversationState.Wait);
                        expect(convo.transcript.length).to.be.equal(2);
                        expect(convo.transcript[1].text).to.be.equal('bot message');
                        expect(convo.transcript[1].from).to.be.equal(MessageSource.Bot);
                    });
            });

            it('sets conversation state to wait and watch if agent watches conversation', () => {
                return provider.connectCustomerToAgent(customer1Address, agent1Address1)
                    .then(() => provider.getConversationFromCustomerAddress(customer1Address))
                    .then((convo: IConversation) => expect(convo.conversationState === ConversationState.WatchAndWait));
            });
        });

        describe('conversation is in wait and watch state', () => {
            const customerMessage = new Message()
                .address(customer1Address)
                .text('customer 1')
                .toMessage();

            addCustomerAddressToMessage(customerMessage, customer1Address);

            beforeEach(() => {
                return provider.addCustomerMessageToTranscript(customerMessage)
                    .then(() => Promise.join(
                        // js maintains thread safety, this is fine
                        provider.queueCustomerForAgent(customer1Address),
                        provider.watchConversation(customer1Address, agent1Address1)
                    )).then(() => provider.getConversationFromCustomerAddress(customer1Address))
                    .then((convo: IConversation) => expect(convo.conversationState).to.be.equal(ConversationState.WatchAndWait));
            });

            // note, it is not possible to go directly from a wait and watch state to bot state. States need to be decomposed.
            // Bot is the default

            it('can be set to an only wait state', () => {
                return provider.unwatchConversation(customer1Address, agent1Address1)
                    .then(() => provider.getConversationFromCustomerAddress(customer1Address))
                    .then((convo: IConversation) => expect(convo.conversationState).to.be.equal(ConversationState.Wait));
            });

            it('can be set to an only watch state', () => {
                return provider.dequeueCustomerForAgent(customer1Address)
                    .then(() => provider.getConversationFromCustomerAddress(customer1Address))
                    .then((convo: IConversation) => expect(convo.conversationState).to.be.equal(ConversationState.Watch));
            });

            it('can connect to agent', () => {
                return provider.connectCustomerToAgent(customer1Address, agent1Address1)
                    .then(() => provider.getConversationFromCustomerAddress(customer1Address))
                    .then((convo: IConversation) => expect(convo.conversationState).to.be.equal(ConversationState.Agent));
            });

            it('is connected to agent implicitly if an agent sends a message to the user', () => {
                const agentMessage = new Message()
                    .address(agent1Address1)
                    .text('agent')
                    .toMessage();

                addAgentAddressToMessage(agentMessage, agent1Address1);

                return provider.addAgentMessageToTranscript(agentMessage)
                    .then(() => provider.getConversationFromCustomerAddress(customer1Address))
                    .then((convo: IConversation) => expect(convo.conversationState).to.be.equal(ConversationState.Agent));
            });
        });

        describe('customer connecting to agent', () => {
            const customer1Message = new Message()
                .address(customer1Address)
                .text('message')
                .toMessage();

            const agentMessage = new Message()
                .address(agent1Address1)
                .text('agent message')
                .toMessage();

            addCustomerAddressToMessage(customer1Message, customer1Address);
            addAgentAddressToMessage(agentMessage, agent1Address1);

            beforeEach(() => {
                return provider.addCustomerMessageToTranscript(customer1Message)
                    .then(() =>  provider.connectCustomerToAgent(customer1Address, agent1Address1));
            });

            it('updates the customer conversation state to "Agent"', () => {
                return provider.getConversationFromCustomerAddress(customer1Address)
                    .then((convo: IConversation) => expect(convo.conversationState).to.be.equal(ConversationState.Agent));
            });

            it('receives messages from agent after connection is established', () => {
                return provider.addAgentMessageToTranscript(agentMessage)
                    .then((convo: IConversation) => {
                        expect(convo.transcript.length).to.be.equal(2);
                        expect(convo.transcript[0].from).to.be.equal(customer1Address.user.name);
                        expect(convo.transcript[1].from).to.be.equal(agent1Address1.user.name);
                        expect(convo.transcript[1].text).to.be.equal('agent message');
                    });
            });

            it('throws an error if a bot message is recorded while agent-customer connection is established', () => {
                // can reuse the customer address. Addresses are idempotent between bots and users
                return provider.addBotMessageToTranscript(customer1Message)
                    .then(() => expect.fail(null, null, 'expected error thrown when bot sends message to customer in convo with agent'))
                    .catch(BotAttemptedToRecordMessageWhileAgentHasConnection, (e: BotAttemptedToRecordMessageWhileAgentHasConnection) => {
                        expect(e).to.be.an.instanceOf(BotAttemptedToRecordMessageWhileAgentHasConnection);
                        expect(e.message)
                            .to.be.equal(new BotAttemptedToRecordMessageWhileAgentHasConnection(customer1Address.conversation.id).message);
                    });
            });

            it('throws an error if the agent\'s conversation id is alredy occupied', () => {
                const expectedErrorMessage
                    = `agent ${agent1Address1.user.name} with conversation id ${agent1Address1.conversation.id} is already occupied`;

                const customer2Message = new Message()
                    .address(customer2Address)
                    .text('customer 2 message')
                    .toMessage();

                addCustomerAddressToMessage(customer2Message, customer2Address);

                return provider.addCustomerMessageToTranscript(customer2Message)
                    .then(() => provider.connectCustomerToAgent(customer2Address, agent1Address1))
                    .then(() => expect.fail('didn\'t throw error when attempting to connect on an agent conversation id that is occupied'))
                    .catch(AgentAlreadyInConversationError, (e: AgentAlreadyInConversationError) => {
                        expect(e).to.be.an.instanceOf(AgentAlreadyInConversationError);
                    });
            });
        });

        describe('agent messages', () => {
            it('are recorded to the customer transcript', () => {
                const customer1Message = new Message()
                    .address(customer1Address)
                    .text('customer 1')
                    .toMessage();

                const customer2Message = new Message()
                    .address(customer2Address)
                    .text('customer 2')
                    .toMessage();

                const agentMessageConvo1 = new Message()
                    .address(agent1Address1)
                    .text('agent 1')
                    .toMessage();

                const agentMessageConvo2 = new Message()
                    .address(agent1Address2)
                    .text('agent 2')
                    .toMessage();

                addCustomerAddressToMessage(customer1Message, customer1Address);
                addCustomerAddressToMessage(customer2Message, customer2Address);
                addAgentAddressToMessage(agentMessageConvo1, agent1Address1);
                addAgentAddressToMessage(agentMessageConvo2, agent1Address2);

                const expectConversationBetweenAgentAndCustomer
                    = (convo: IConversation, customerAddress: IAddress, agentAddress: IAddress, idCounter: number) => {
                        expect(convo.agentAddress).to.deep.equal(agentAddress);
                        expect(convo.transcript.length).to.be.equal(2);
                        const firstTranscript = convo.transcript[0];
                        const secondTranscript = convo.transcript[1];

                        expect(firstTranscript.from).to.be.equal(customerAddress.user.name);
                        expect(secondTranscript.from).to.be.equal(agentAddress.user.name);

                        expect(firstTranscript.text).to.be.equal(`customer ${idCounter}`);
                        expect(secondTranscript.text).to.be.equal(`agent ${idCounter}`);
                };

                return Promise.join(
                        provider.addCustomerMessageToTranscript(customer1Message),
                        provider.addCustomerMessageToTranscript(customer2Message))
                    .then(() => Promise.join(
                        provider.connectCustomerToAgent(customer1Address, agent1Address1),
                        provider.connectCustomerToAgent(customer2Address, agent1Address2)))
                    .then(() => Promise.join(
                        provider.addAgentMessageToTranscript(agentMessageConvo1),
                        provider.addAgentMessageToTranscript(agentMessageConvo2)))
                    .then(() => Promise.join(
                        provider.getConversationFromCustomerAddress(customer1Address),
                        provider.getConversationFromCustomerAddress(customer2Address)))
                    .spread((convo1: IConversation, convo2: IConversation) => {
                        expectConversationBetweenAgentAndCustomer(convo1, customer1Address, agent1Address1, 1);
                        expectConversationBetweenAgentAndCustomer(convo2, customer2Address, agent1Address2, 2);
                    });
            });

            it('that are sent to customer conversations that do not have a connection get an error', () => {
                const agentMessage = new Message()
                    .address(agent1Address1)
                    .text('This is an agent, how can I help?')
                    .toMessage();

                addAgentAddressToMessage(agentMessage, agent1Address1);

                return provider.addAgentMessageToTranscript(agentMessage)
                    .then(() => expect.fail('did not throw an error as expected'))
                    .catch((e: Error) => expect(e).to.be.an.instanceOf(AgentNotInConversationError));
            });
        });

        describe('agents watching conversation', () => {
            const customerMessage = new Message()
                .address(customer1Address)
                .text('customer message')
                .toMessage();

            const agentMessage = new Message()
                .address(agent1Address1)
                .text('agent message')
                .toMessage();

            addCustomerAddressToMessage(customerMessage, customer1Address);
            addAgentAddressToMessage(agentMessage, agent1Address1);

            beforeEach(() => {
                return provider.addCustomerMessageToTranscript(customerMessage)
                    .then(() => provider.watchConversation(customer1Address, agent1Address1));
            });

            it('update conversation state to watching', () => {
                return provider.getConversationFromCustomerAddress(customer1Address)
                    .then((convo: IConversation) => {
                        expect(convo.conversationState).to.be.equal(ConversationState.Watch);
                    });
            });

            it('binds agent address to conversation', () => {
                return provider.getConversationFromCustomerAddress(customer1Address)
                    .then((convo: IConversation) => {
                        expect(convo.agentAddress).not.to.be.undefined;
                    });
            });

            it('set conversation state to Agent implicitly if an agent sends a message', () => {
                return provider.addAgentMessageToTranscript(agentMessage)
                    .then(() => provider.getConversationFromCustomerAddress(customer1Address))
                    .then((convo: IConversation) => {
                        expect(convo.agentAddress).not.to.be.undefined;
                        expect(convo.conversationState).to.be.equal(ConversationState.Agent);
                        expect(convo.transcript.length).to.be.equal(2);
                        const firstMessage = convo.transcript[0];
                        const secondMessage = convo.transcript[1];

                        expect(firstMessage.from).to.be.equal(customer1Address.user.name);
                        expect(secondMessage.from).to.be.equal(agent1Address1.user.name);
                        expect(firstMessage.text).to.be.equal('customer message');
                        expect(secondMessage.text).to.be.equal('agent message');

                    });
            });

            // this is a weird case that shouldn't be hit, but I wanted to cover my bases
            it('throws error if different agent conversation than watching agent conversation attempts to connect to customer', () => {
                return provider.connectCustomerToAgent(customer1Address, agent1Address2)
                    .then(() => expect.fail(null, null, 'Should have thrown error or wrong convo id to connect'))
                    .catch(AgentConnectingIsNotSameAsWatching, (e: AgentConnectingIsNotSameAsWatching) => {
                        expect(e).to.be.an.instanceOf(AgentConnectingIsNotSameAsWatching);
                    });
            });

            it('can have conversation set to wait and watch if customer queues for agent', () => {
                return provider.queueCustomerForAgent(customer1Address)
                    .then(() => provider.getConversationFromCustomerAddress(customer1Address))
                    .then((convo: IConversation) => expect(convo.conversationState).to.be.equal(ConversationState.WatchAndWait));
            });
        });

        describe('disconnecting user from agent', () => {
            const customerMessage = new Message()
                .address(customer1Address)
                .text('I need to speak to an agent')
                .toMessage();

            const agentMessage = new Message()
                .address(agent1Address1)
                .text('This is an agent, how can I help?')
                .toMessage();

            addCustomerAddressToMessage(customerMessage, customer1Address);
            addAgentAddressToMessage(agentMessage, agent1Address1);

            beforeEach(() => {
                return provider.addCustomerMessageToTranscript(customerMessage)
                    .then(() => provider.connectCustomerToAgent(customer1Address, agent1Address1))
                    .then(() => provider.addAgentMessageToTranscript(agentMessage))
                    .then(() => provider.getConversationFromCustomerAddress(customer1Address))
                    .then((conversation: IConversation) => {
                        expect(conversation.agentAddress).not.to.be.undefined;
                        expect(conversation.transcript.length).to.be.equal(2);
                        const firstTranscript = conversation.transcript[0];
                        const secondTranscript = conversation.transcript[1];

                        expect(firstTranscript.from).to.be.equal(customer1Address.user.name);
                        expect(secondTranscript.from).to.be.equal(agent1Address1.user.name);
                    })
                    .then(() => provider.disconnectCustomerFromAgent(customer1Address, agent1Address1));
            });

            it('changes conversation state to bot', () => {
                return provider.getConversationFromCustomerAddress(customer1Address)
                    .then((convo: IConversation) => expect(convo.conversationState).to.be.equal(ConversationState.Bot));
            });

            it('removes agent address from conversation', () => {
                return provider.getConversationFromCustomerAddress(customer1Address)
                    .then((convo: IConversation) => expect(convo.agentAddress).to.be.undefined);
            });

            it('causes agent to throw error if they attempt to send another message', () => {
                const expectedErrorMessage =
                    `no customer conversation found for agent with conversation id ${agent1Address1.conversation.id}`;

                return provider.addAgentMessageToTranscript(agentMessage)
                    .then(() => expect.fail(null, null, 'agent sending message to user they are not connected to didn\'t throw exception'))
                    .catch(AgentNotInConversationError, (e: AgentNotInConversationError) => {
                        expect(e).to.be.an.instanceOf(AgentNotInConversationError);
                        expect(e.message).to.be.equal(new AgentNotInConversationError(agent1Address1.conversation.id).message);
                    });
            });

        });
    });
}
