import * as Promise from 'bluebird';
import * as builder from 'botbuilder';
import * as _ from 'lodash';
import { ConversationState, IConversation} from '../../../IConversation';
import { IHandoffMessage } from '../../../IHandoffMessage';
import { AgentAlreadyInConversationError} from '../../errors/AgentAlreadyInConversationError';
import { AgentNotInConversationError} from '../../errors/AgentNotInConversationError';
import { BotAttemptedToRecordMessageWhileAgentHasConnection} from '../../errors/BotAttemptedToRecordMessageWhileAgentHasConnection';
import { CustomerConnectedToAnotherAgentError } from '../../errors/CustomerConnectedToAnotherAgentError';
import { IProvider } from '../../IProvider';
import { CustomernotConnectedToAgentError } from './../../errors/CustomernotConnectedToAgentError';
import { AgentConvoIdToCustomerAddressProvider } from './AgentConvoIdToCustomerAddressProvider';
import { InMemoryConversationProvider } from './InMemoryConversationProvider';

type InMemoryConversationStore = {[s: string]: IConversation};

type AgentToCustomerConversationMap = {
    [s: string]: builder.IAddress
};

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
    private conversationProvider: InMemoryConversationProvider;

    constructor() {
        this.conversations = {};
        this.agentConvoToCustomerAddressProvider = new AgentConvoIdToCustomerAddressProvider();
        this.conversationProvider = new InMemoryConversationProvider(this.conversations);
    }

    public addBotMessageToTranscript(message: IHandoffMessage): Promise<IConversation> {
        ensureCustomerAddressDefinedOnHandoffMessage(message);

        const customerAddress = message.customerAddress;

        const convo = this.conversationProvider.getConversationFromCustomerAddress(customerAddress);

        if (convo && convo.conversationState === ConversationState.Agent) {
            return Promise.reject(new BotAttemptedToRecordMessageWhileAgentHasConnection(customerAddress.conversation.id));
        }

        return this.addBotMessageToTranscriptIgnoringConversationState(message);
    }

    public addBotMessageToTranscriptIgnoringConversationState(message: IHandoffMessage): Promise<IConversation> {
        ensureCustomerAddressDefinedOnHandoffMessage(message);

        const customerAddress = message.customerAddress;

        return Promise.resolve(
            this.conversationProvider.addToTranscriptOrCreateNewConversation(customerAddress, message));
    }

    public addCustomerMessageToTranscript(message: IHandoffMessage): Promise<IConversation> {
        ensureCustomerAddressDefinedOnHandoffMessage(message);

        const customerAddress = message.customerAddress;

        return Promise.resolve(
            this.conversationProvider.addToTranscriptOrCreateNewConversation(customerAddress, message, customerAddress));
    }

    public addAgentMessageToTranscript(message: IHandoffMessage): Promise<IConversation> {
        ensureAgentAddressDefinedOnHandoffMessage(message);

        const agentAddress = message.agentAddress;

        const customerAddress = this.agentConvoToCustomerAddressProvider.getCustomerAddress(agentAddress);

        if (!customerAddress) {
            const rejectionMessage = `no customer conversation found for agent with conversation id ${agentAddress.conversation.id}`;

            return Promise.reject(new AgentNotInConversationError(agentAddress.conversation.id));
        }

        const convo = this.conversationProvider.addToTranscriptOrCreateNewConversation(customerAddress, message, agentAddress);

        if (convo.conversationState !== ConversationState.Agent) {
            try {
                return Promise.resolve(this.conversationProvider.setConversationStateToAgent(customerAddress, agentAddress));
            } catch (e) {
                return Promise.reject(e);
            }
        } else {
            return Promise.resolve(convo);
        }
    }

    // CONNECT/DISCONNECT ACTIONS
    public connectCustomerToAgent(customerAddress: builder.IAddress, agentAddress: builder.IAddress): Promise<IConversation> {
        ensureCustomerAndAgentAddressDefined(customerAddress, agentAddress);

        const customerConvoId: string = customerAddress.conversation.id;
        const agentConvoId: string = agentAddress.conversation.id;

        try {
            this.conversationProvider.setConversationStateToAgent(customerAddress, agentAddress);
            this.agentConvoToCustomerAddressProvider.linkCustomerAddressToAgentConvoId(agentConvoId, customerAddress);

            return Promise.resolve(this.conversationProvider.getConversationFromCustomerAddress(customerAddress));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    // TODO remove agent address
    public disconnectCustomerFromAgent(customerAddress: builder.IAddress): Promise<IConversation> {
        try {
            const convo = this.conversationProvider.getConversationFromCustomerAddress(customerAddress);

            if (!convo.agentAddress) {
                throw new CustomernotConnectedToAgentError();
            }

            this.agentConvoToCustomerAddressProvider.removeAgentConvoId(convo.agentAddress.conversation.id);
            this.conversationProvider.unsetConversationStateToAgent(customerAddress);

            return Promise.resolve(convo);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    // QUEUE/DEQUEUE ACTIONS
    public queueCustomerForAgent(customerAddress: builder.IAddress): Promise<IConversation> {
        const customerConvoId: string = customerAddress.conversation.id;

        try {
            return Promise.resolve(this.conversationProvider.setConversationStateToWait(customerConvoId));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public dequeueCustomerForAgent(customerAddress: builder.IAddress): Promise<IConversation> {
        const customerConvoId: string = customerAddress.conversation.id;

        try {
            return Promise.resolve(this.conversationProvider.unsetConversationWait(customerConvoId));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    // WATCH/UNWATCH ACTIONS
    public watchConversation(customerAddress: builder.IAddress, agentAddress: builder.IAddress): Promise<IConversation> {
        this.agentConvoToCustomerAddressProvider.linkCustomerAddressToAgentConvoId(agentAddress.conversation.id, customerAddress);

        try {
            return Promise.resolve(this.conversationProvider.setConversationStateToWatch(customerAddress, agentAddress));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public unwatchConversation(customerAddress: builder.IAddress, agentAddress: builder.IAddress): Promise<IConversation> {
        this.agentConvoToCustomerAddressProvider.removeAgentConvoId(agentAddress.conversation.id);

        try {
            return Promise.resolve(this.conversationProvider.removeAgentFromWatch(customerAddress, agentAddress));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public getConversationFromCustomerAddress(customerAddress: builder.IAddress): Promise<IConversation> {
        return Promise.resolve(this.conversationProvider.getConversationFromCustomerAddress(customerAddress));
    }

    public getConversationFromAgentAddress(agentAddress: builder.IAddress): Promise<IConversation> {
        const customerAddress = this.agentConvoToCustomerAddressProvider.getCustomerAddress(agentAddress);

        if (customerAddress) {
            return this.getConversationFromCustomerAddress(customerAddress);
        }

        return Promise.resolve(undefined);
    }

    public getAllConversations(): Promise<IConversation[]> {
        return Promise.resolve(_.reduce(this.conversations, (accumulator: IConversation[], currentConvo: IConversation) => {
            accumulator.push(_.cloneDeep(currentConvo));

            return accumulator;
        //tslint:disable
        }, []));
        //tslint:enable
    }

    private agentConversationAlreadyConnected(agentConversationId: string): boolean {
        const customerAddress = this.agentConvoToCustomerAddressProvider.getCustomerAddress(agentConversationId);

        // if the customer address does not exist, there is no mapping from the agent conversationId to the customer, therefore there is no
        // conversation between the agent and customer. If one does exist, it can be in a watching state. We only care if the fetched
        // conversation is in an Agent state.
        return !!customerAddress &&
            this.conversationProvider.getConversationFromCustomerAddress(customerAddress).conversationState === ConversationState.Agent;
    }

    private customerIsConnectedToAgent(customerConvoId: string): boolean {
        const convo = this.conversations[customerConvoId];

        return convo.conversationState === ConversationState.Agent;
    }
}
