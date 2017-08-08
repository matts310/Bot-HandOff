import * as Promise from 'bluebird';
import * as builder from 'botbuilder';
import * as _ from 'lodash';
import { ConversationState, MessageSource } from '../../../constants';
import { createDefaultConversation, IConversation, ITranscriptLine } from '../../../IConversation';
import { IHandoffMessage } from '../../../IHandoffMessage';
import { AgentAlreadyInConversationError} from '../../errors/AgentAlreadyInConversationError';
import { AgentConnectingIsNotSameAsWatching } from '../../errors/AgentConnectingIsNotSameAsWatching';
import { AgentNotInConversationError} from '../../errors/AgentNotInConversationError';
import { BotAttemptedToRecordMessageWhileAgentHasConnection} from '../../errors/BotAttemptedToRecordMessageWhileAgentHasConnection';
import { CustomerAlreadyConnectedException } from '../../errors/CustomerAlreadyConnectedException';
import { IProvider } from '../../IProvider';
import { AgentConvoIdToCustomerAddressProvider } from './AgentConvoIdToCustomerAddressProvider';

type InMemoryConversationStore = {[s: string]: IConversation};

type AgentToCustomerConversationMap = {
    [s: string]: builder.IAddress
};

function createTranscriptLineFromMessage(message: builder.IMessage, from: string): ITranscriptLine {
    return Object.assign({ from }, _.cloneDeep(message));
}

function ensureCustomerAddressDefinedOnHandoffMessage(msg: IHandoffMessage): void {
    if (!msg.customerAddress) {
        throw new Error('customer address must be defined on a Handoff message in this function');
    }
}

function ensureAgentAddressDefinedOnHandoffMessage(msg: IHandoffMessage): void {
    if (!msg.agentAddress) {
        throw new Error('agent address must be defined');
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
    private agentConvoToCustomerAddressProvider: AgentConvoIdToCustomerAddressProvider;

    constructor() {
        this.conversations = {};
        this.agentConvoToCustomerAddressProvider = new AgentConvoIdToCustomerAddressProvider();
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

        const customerAddress = this.agentConvoToCustomerAddressProvider.getCustomerAddress(agentAddress);

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

        if (this.customerIsConnectedToAgent(customerConvoId)) {
            return Promise.reject(
                new CustomerAlreadyConnectedException(`customer ${customerAddress.user.name} is already speaking to an agent`));
        }

        this.agentConvoToCustomerAddressProvider.linkCustomerAddressToAgentConvoId(agentConvoId, customerAddress);

        try {
            return Promise.resolve(this.setConversationStateToAgent(customerConvoId, agentAddress));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public disconnectCustomerFromAgent(customerAddress: builder.IAddress, agentAddress: builder.IAddress): Promise<IConversation> {
        const customerConvoId: string = customerAddress.conversation.id;
        const agentConvoId: string = agentAddress.conversation.id;

        this.agentConvoToCustomerAddressProvider.removeAgentConvoId(agentConvoId);
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
        this.agentConvoToCustomerAddressProvider.linkCustomerAddressToAgentConvoId(agentAddress.conversation.id, customerAddress);

        return Promise.resolve(this.setConversationStateToWatch(customerAddress.conversation.id, agentAddress));
    }

    public unwatchConversation(customerAddress: builder.IAddress, agentAddress: builder.IAddress): Promise<IConversation> {
        this.agentConvoToCustomerAddressProvider.removeAgentConvoId(agentAddress.conversation.id);

        return Promise.resolve(this.unsetConversationWatch(customerAddress.conversation.id));
    }

    public getConversationFromCustomerAddress(customerAddress: builder.IAddress): Promise<IConversation> {
        return Promise.resolve(this.getConversationSynchronously(customerAddress));
    }

    public getConversationFromAgentAddress(agentAddress: builder.IAddress): Promise<IConversation> {
        const customerAddress = this.agentConvoToCustomerAddressProvider.getCustomerAddress(agentAddress);

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
        const customerAddress = this.agentConvoToCustomerAddressProvider.getCustomerAddress(agentConversationId);

        // if the customer address does not exist, there is no mapping from the agent conversationId to the customer, therefore there is no
        // conversation between the agent and customer. If one does exist, it can be in a watching state. We only care if the fetched
        // conversation is in an Agent state.
        return !!customerAddress && this.getConversationSynchronously(customerAddress).conversationState === ConversationState.Agent;
    }

    private customerIsConnectedToAgent(customerConvoId: string): boolean {
        const convo = this.conversations[customerConvoId];

        return convo.conversationState === ConversationState.Agent;
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
                // tslint:disable
                throw new AgentConnectingIsNotSameAsWatching(`agent ${convo.agentAddress.user.name} is attempting to connect to customer ${convo.customerAddress.user.name}, but was not the same agent that was watching`);
                //tslint:enable
        }

        return this.setConversationState(customerConvoId, ConversationState.Agent, agentAddress);
    }

    private setConversationStateToWait(customerConvoId: string): IConversation {
        if (this.conversations[customerConvoId].conversationState === ConversationState.Watch) {
            return this.setConversationStateToWatchAndWait(customerConvoId);
        }

        return this.setConversationState(customerConvoId, ConversationState.Wait);
    }

    private setConversationStateToWatch(customerConvoId: string, agentAddress: builder.IAddress): IConversation {
        if (this.conversations[customerConvoId].conversationState === ConversationState.Wait) {
            return this.setConversationStateToWatchAndWait(customerConvoId, agentAddress);
        }

        return this.setConversationState(customerConvoId, ConversationState.Watch, agentAddress);
    }

    private setConversationStateToWatchAndWait(customerConvoId: string, agentAddress?: builder.IAddress): IConversation {
        if (!agentAddress) {
            agentAddress = this.conversations[customerConvoId].agentAddress;
        }

        return this.setConversationState(customerConvoId, ConversationState.WatchAndWait, agentAddress);
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
            return this.setConversationStateToWatch(customerConvoId, conversation.agentAddress);
        }

        return this.setConversationStateToBot(customerConvoId);
    }
}
