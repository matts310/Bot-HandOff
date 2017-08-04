import * as Promise from 'bluebird';
import * as builder from 'botbuilder';
import * as _ from 'lodash';
import { ConversationState, MessageSource } from '../constants';
import { createDefaultConversation, IConversation, ITranscriptLine } from '../IConversation';
import { IHandoffMessage } from '../IHandoffMessage';
import {
    AgentAlreadyInConversationError,
    AgentNotInConversationError,
    AgentWithConvoIdNotEqualToWatchingAgentConvoId,
    BotAttemptedToRecordMessageWhileAgentHasConnection,
    IProvider
} from './IProvider';

type InMemoryConversationStore = {[s: string]: IConversation};

type AgentToCustomerConversationMap = {
    [s: string]: builder.IAddress
};

function createTranscriptLineFromMessage(message: builder.IMessage, from: string): ITranscriptLine {
    return {
        timestamp: message.timestamp,
        text: message.text,
        from
    };
}

function ensureCustomerAddressDefinedOnHandoffMessage(msg: IHandoffMessage): void {
    if (!msg.customerAddress) {
        throw new Error('customer address must be defined on a Handoff message in this function');
    }
}

function ensureAgentAddressDefinedOnHandoffMessage(msg: IHandoffMessage): void {
    if (!msg.agentAddress) {
        throw new Error('agent address must be defined on a Handoff message in this function');
    }
}

function ensureCustomerAndAgentAddressDefined(customerAddress: builder.IAddress, agentAddress: builder.IAddress): void {
    if (!agentAddress) {
        throw new Error('agent address must be defined');
    }

    if (!customerAddress) {
        throw new Error('customer address must be defined');
    }
}

export class InMemoryProvider implements IProvider {
    private conversations: InMemoryConversationStore;
    private agentToCustomerConversationMap: AgentToCustomerConversationMap;

    constructor() {
        this.conversations = {};
        this.agentToCustomerConversationMap = {};
    }

    public addBotMessageToTranscript(message: IHandoffMessage): Promise<IConversation> {
        ensureCustomerAddressDefinedOnHandoffMessage(message);

        const customerAddress = message.customerAddress;

        return this.getConversationFromCustomerAddress(customerAddress)
            .then((convo: IConversation) => {
                if (convo && convo.conversationState === ConversationState.Agent) {
                    return Promise.reject(new BotAttemptedToRecordMessageWhileAgentHasConnection(customerAddress.conversation.id));
                }
            })
            .then(() => this.addBotMessageToTranscriptIgnoringConversationState(message));
    }

    public addBotMessageToTranscriptIgnoringConversationState(message: IHandoffMessage): Promise<IConversation> {
        ensureCustomerAddressDefinedOnHandoffMessage(message);

        const customerAddress = message.customerAddress;

        return Promise.resolve(this.addToTranscriptOrCreateNewConversation(customerAddress, message, MessageSource.Bot));
    }

    public addCustomerMessageToTranscript(message: IHandoffMessage): Promise<IConversation> {
        ensureCustomerAddressDefinedOnHandoffMessage(message);

        const customerAddress = message.customerAddress;

        return Promise.resolve(this.addToTranscriptOrCreateNewConversation(customerAddress, message, customerAddress.user.name));
    }

    public addAgentMessageToTranscript(message: IHandoffMessage): Promise<IConversation> {
        ensureAgentAddressDefinedOnHandoffMessage(message);

        const agentAddress = message.agentAddress;

        const customerAddress = this.agentToCustomerConversationMap[agentAddress.conversation.id];

        if (!customerAddress) {
            const rejectionMessage = `no customer conversation found for agent with conversation id ${agentAddress.conversation.id}`;

            return Promise.reject(new AgentNotInConversationError(agentAddress.conversation.id));
        }

        this.addToTranscriptOrCreateNewConversation(customerAddress, message, agentAddress.user.name);

        try {
            return Promise.resolve(this.setConversationStateToAgent(customerAddress.conversation.id, agentAddress));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    // CONNECT/DISCONNECT ACTIONS
    public connectCustomerToAgent(customerAddress: builder.IAddress, agentAddress: builder.IAddress): Promise<IConversation> {
        ensureCustomerAndAgentAddressDefined(customerAddress, agentAddress);

        const customerConvoId: string = customerAddress.conversation.id;
        const agentConvoId: string = agentAddress.conversation.id;

        if (this.agentConversationAlreadyConnected(agentConvoId)) {
            return Promise.reject(new AgentAlreadyInConversationError(agentConvoId));
        }

        this.mapAgentToCustomer(customerAddress, agentConvoId);

        try {
            return Promise.resolve(this.setConversationStateToAgent(customerConvoId, agentAddress));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public disconnectCustomerFromAgent(customerAddress: builder.IAddress, agentAddress: builder.IAddress): Promise<IConversation> {
        const customerConvoId: string = customerAddress.conversation.id;
        const agentConvoId: string = agentAddress.conversation.id;

        this.unmapAgentToCustomer(agentConvoId);
        this.setConversationStateToBot(customerConvoId);

        return Promise.resolve(this.getConversationFromCustomerAddress(customerAddress));
    }

    // QUEUE/DEQUEUE ACTIONS
    public queueCustomerForAgent(customerAddress: builder.IAddress): Promise<IConversation> {
        const customerConvoId: string = customerAddress.conversation.id;

        return Promise.resolve(this.setConversationStateToWait(customerConvoId));
    }

    public dequeueCustomerForAgent(customerAddress: builder.IAddress): Promise<IConversation> {
        const customerConvoId: string = customerAddress.conversation.id;

        return Promise.resolve(this.unsetConversationWait(customerConvoId));
    }

    // WATCH/UNWATCH ACTIONS
    public watchConversation(customerAddress: builder.IAddress, agentAddress: builder.IAddress): Promise<IConversation> {
        this.mapAgentToCustomer(customerAddress, agentAddress.conversation.id);

        return Promise.resolve(this.setConversationStateToWatch(customerAddress.conversation.id, agentAddress));
    }

    public unwatchConversation(customerAddress: builder.IAddress, agentAddress: builder.IAddress): Promise<IConversation> {
        this.unmapAgentToCustomer(agentAddress.conversation.id);

        return Promise.resolve(this.unsetConversationWatch(customerAddress.conversation.id));
    }

    public getConversationFromCustomerAddress(customerAddress: builder.IAddress): Promise<IConversation> {
        return Promise.resolve(this.getConversationSynchronously(customerAddress));
    }

    public getConversationFromAgentAddress(agentAddress: builder.IAddress): Promise<IConversation> {
        const customerAddress = this.agentToCustomerConversationMap[agentAddress.conversation.id];

        if (customerAddress) {
            return this.getConversationFromCustomerAddress(customerAddress);
        }

        return Promise.resolve(undefined);
    }

    public getCurrentConversations(): Promise<IConversation[]> {
        return Promise.resolve(_.reduce(this.conversations, (accumulator: IConversation[], currentConvo: IConversation) => {
            accumulator.push(_.cloneDeep(currentConvo));

            return accumulator;
        //tslint:disable
        }, []));
        //tslint:enable
    }

    private addToTranscriptOrCreateNewConversation(
        customerAddress: builder.IAddress,
        message: builder.IMessage, from: string
    ): IConversation {
        const currentConversation = this.getConversationSynchronously(customerAddress) || this.createNewConversation(message.address);

        currentConversation.transcript.push(createTranscriptLineFromMessage(message, from));

        return currentConversation;
    }

    private agentConversationAlreadyConnected(agentConversationId: string): boolean {
        const customerAddress = this.agentToCustomerConversationMap[agentConversationId];

        // if the customer address does not exist, there is no mapping from the agent conversationId to the customer, therefore there is no
        // conversation between the agent and customer. If one does exist, it can be in a watching state. We only care if the fetched
        // conversation is in an Agent state.
        return !!customerAddress && this.getConversationSynchronously(customerAddress).conversationState === ConversationState.Agent;
    }

    private mapAgentToCustomer(customerConversation: builder.IAddress, agentConversationId: string): void {
        this.agentToCustomerConversationMap[agentConversationId] = customerConversation;
    }

    private unmapAgentToCustomer(agentConversationId: string): void {
        this.agentToCustomerConversationMap[agentConversationId] = undefined;
    }

    private getConversationSynchronously(customerAddress: string | builder.IAddress): IConversation {
        return this.conversations[typeof(customerAddress) === 'string' ? customerAddress : customerAddress.conversation.id];
    }

    private createNewConversation(customerAddress: builder.IAddress): IConversation {
        const convo: IConversation = createDefaultConversation(customerAddress);
        convo.customerAddress = customerAddress;

        this.conversations[customerAddress.conversation.id] = convo;

        return convo;
    }

    private setConversationState(customerConvoId: string, state: ConversationState, agentAddress?: builder.IAddress): IConversation {
        const conversation = this.getConversationSynchronously(customerConvoId);
        conversation.conversationState = state;
        conversation.agentAddress = agentAddress;

        return conversation;
    }

    private setConversationStateToAgent(customerConvoId: string, agentAddress: builder.IAddress): IConversation {
        const convo = this.getConversationSynchronously(customerConvoId);
        const agentConvoId = agentAddress.conversation.id;

        if ((convo.conversationState === ConversationState.Watch || convo.conversationState === ConversationState.WatchAndWait) &&
            (convo.agentAddress && convo.agentAddress.conversation.id !== agentConvoId)) {
                throw new AgentWithConvoIdNotEqualToWatchingAgentConvoId(customerConvoId, agentConvoId);
        }

        return this.setConversationState(customerConvoId, ConversationState.Agent, agentAddress);
    }

    private setConversationStateToWait(customerConvoId: string): IConversation {
        if (this.conversations[customerConvoId].conversationState === ConversationState.Watch) {
            return this.setConversationStateToWatchAndWait(customerConvoId);
        }

        return this.setConversationState(customerConvoId, ConversationState.Wait);
    }

    private setConversationStateToWatch(customerConvoId: string, agentAddress?: builder.IAddress): IConversation {
        if (this.conversations[customerConvoId].conversationState === ConversationState.Wait) {
            return this.setConversationStateToWatchAndWait(customerConvoId);
        }

        return this.setConversationState(customerConvoId, ConversationState.Watch, agentAddress);
    }

    private setConversationStateToWatchAndWait(customerConvoId: string): IConversation {
        return this.setConversationState(customerConvoId, ConversationState.WatchAndWait);
    }

    private setConversationStateToBot(customerConvoId: string): IConversation {
        return this.setConversationState(customerConvoId, ConversationState.Bot);
    }

    private unsetConversationWatch(customerConvoId: string): IConversation {
        const conversation = this.getConversationSynchronously(customerConvoId);

        if (conversation.conversationState === ConversationState.WatchAndWait) {
            return this.setConversationStateToWait(customerConvoId);
        }

        return this.setConversationStateToBot(customerConvoId);
    }

    private unsetConversationWait(customerConvoId: string): IConversation {
        const conversation = this.getConversationSynchronously(customerConvoId);

        if (conversation.conversationState === ConversationState.WatchAndWait) {
            return this.setConversationStateToWatch(customerConvoId);
        }

        return this.setConversationStateToBot(customerConvoId);
    }
}
