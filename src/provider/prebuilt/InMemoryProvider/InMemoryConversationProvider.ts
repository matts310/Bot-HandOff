import { IAddress, IMessage } from 'botbuilder';
import { clone } from 'lodash';
import { CustomerAlreadyQueuedError } from '../../errors/CustomerAlreadyQueuedError';
import { CustomerCannotQueueError } from '../../errors/CustomerCannotQueueError';
import { CustomerNotQueuedError } from '../../errors/CustomerNotQueuedError';
import { ConversationState, createDefaultConversation, IConversation } from './../../../IConversation';
import { AgentNotWatchingConversationError } from './../../errors/AgentNotWatchingConversationError';
import { InMemoryConversationAgentManager } from './InMemoryConversationAgentManager';

function getConversationIdFromAddresOrString(addressOrConvoId: string | IAddress): string {
    return typeof(addressOrConvoId) === 'string' ? addressOrConvoId : addressOrConvoId.conversation.id;
}

export class InMemoryConversationProvider {
    private conversations: {[s: string]: IConversation};
    private agentManager: InMemoryConversationAgentManager;

    constructor(conversations?: {[s: string]: IConversation}) {
        this.conversations = conversations || {};
        this.agentManager = new InMemoryConversationAgentManager(this.conversations);
    }

    public getConversationFromCustomerAddress(customerAddressOrConvoId: string | IAddress): IConversation {
        const customerConvoId = getConversationIdFromAddresOrString(customerAddressOrConvoId);

        return this.conversations[customerConvoId];
    }

    public addToTranscriptOrCreateNewConversation(customerAddress: IAddress, message: IMessage, from?: IAddress): IConversation {
        const newLine = Object.assign({from, to: message.address}, clone(message));
        let convo = this.getConversationFromCustomerAddress(customerAddress);

        if (!convo) {
            convo = this.createNewConversation(customerAddress);
        }

        convo.transcript.push(newLine);

        return convo;
    }

    public createNewConversation(customerAddress: IAddress): IConversation {
        const newConvo = createDefaultConversation(customerAddress);

        newConvo.customerAddress = customerAddress;

        this.conversations[customerAddress.conversation.id] = newConvo;

        return newConvo;
    }

    public setConversationStateToAgent(customerAddressOrConvoId: string | IAddress, agentAddress: IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerAddressOrConvoId);
        const agentConvoId = agentAddress.conversation.id;

        this.agentManager.connectConversationToAgent(customerAddressOrConvoId, agentAddress);

        return this.setConversationState(customerAddressOrConvoId, ConversationState.Agent, agentAddress);
    }

    public unsetConversationStateToAgent(customerAddressOrConvoId: string | IAddress): IConversation {
        this.agentManager.removeConnectedAgent(customerAddressOrConvoId);

        return this.setConversationStateToBot(customerAddressOrConvoId);
    }

    public setConversationStateToWait(customerAddress: string | IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerAddress);

        if (convo.conversationState === ConversationState.Wait) {
            throw new CustomerAlreadyQueuedError();
        }

        if (convo.conversationState === ConversationState.Agent) {
            throw new CustomerCannotQueueError();
        }

        return this.setConversationState(customerAddress, ConversationState.Wait);
    }

    public unsetConversationWait(customerConvo: string): IConversation {
        const conversation = this.getConversationFromCustomerAddress(customerConvo);

        if (conversation.conversationState === ConversationState.Agent || conversation.conversationState === ConversationState.Bot) {
            throw new CustomerNotQueuedError();
        }

        return this.setConversationStateToBot(customerConvo);
    }

    public setConversationStateToWatch(customerAddress: string | IAddress, agentAddress: IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerAddress);

        this.agentManager.addWatchingAgent(customerAddress, agentAddress);

        return convo;
    }

    public removeAgentFromWatch(customerAddress: string | IAddress, agentAddress: IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerAddress);

        if (!this.agentManager.removeWatchingAgent(customerAddress, agentAddress)) {
            throw new AgentNotWatchingConversationError();
        }

        return convo;
    }

    private setConversationStateToBot(customerAddress: string | IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerAddress);

        convo.conversationState = ConversationState.Bot;
        delete convo.agentAddress;

        return convo;
    }

    private setConversationState(customerConvo: string | IAddress, state: ConversationState, agentAddress?: IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerConvo);

        convo.conversationState = state;

        return convo;
    }
}
