import { IAddress, IMessage } from 'botbuilder';
import { clone } from 'lodash';
import { AgentConnectingIsNotSameAsWatching } from '../../errors/AgentConnectingIsNotSameAsWatching';
import { ConversationStateUnchangedException } from '../../errors/ConversationStateUnchangedException';
import { ConversationState, createDefaultConversation, IConversation } from './../../../IConversation';

function getConversationIdFromAddresOrString(addressOrConvoId: string | IAddress): string {
    return typeof(addressOrConvoId) === 'string' ? addressOrConvoId : addressOrConvoId.conversation.id;
}

function isNewConversationStateTheSame(convo: IConversation, newState: ConversationState): boolean {
    return convo.conversationState === newState;
}

export class InMemoryConversationProvider {
    private conversations: {[s: string]: IConversation};

    constructor(conversations?: {[s: string]: IConversation}) {
        this.conversations = conversations || {};
    }

    public getConversationFromCustomerAddress(customerAddressOrConvoId: string | IAddress): IConversation {
        const customerConvoId = getConversationIdFromAddresOrString(customerAddressOrConvoId);

        return this.conversations[customerConvoId];
    }

    public addToTranscriptOrCreateNewConversation(customerAddress: IAddress, message: IMessage, from: string): IConversation {
        const newLine = Object.assign({from}, clone(message));
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

        if ((convo.conversationState === ConversationState.Watch || convo.conversationState === ConversationState.WatchAndWait) &&
            (convo.agentAddress && convo.agentAddress.conversation.id !== agentConvoId)) {
                // tslint:disable
                throw new AgentConnectingIsNotSameAsWatching(`agent ${convo.agentAddress.user.name} is attempting to connect to customer ${convo.customerAddress.user.name}, but was not the same agent that was watching`);
                //tslint:enable
        }

        return this.setConversationState(customerAddressOrConvoId, ConversationState.Agent, agentAddress);
    }

    public unsetConversationStateToAgent(customerAddressOrConvoId: string | IAddress): IConversation {
        return this.setConversationStateToBot(customerAddressOrConvoId);
    }

    public setConversationStateToWait(customerAddress: string | IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerAddress);

        if (convo.conversationState === ConversationState.Watch) {
            return this.setConversationStateToWaitAndWatch(customerAddress);
        }

        return this.setConversationState(customerAddress, ConversationState.Wait);
    }

    public unsetConversationWait(customerConvo: string): IConversation {
        const conversation = this.getConversationFromCustomerAddress(customerConvo);

        if (conversation.conversationState === ConversationState.WatchAndWait) {
            return this.setConversationStateToWatch(customerConvo, conversation.agentAddress);
        }

        return this.setConversationStateToBot(customerConvo);
    }

    public setConversationStateToWatch(customerAddress: string | IAddress, agentAddress?: IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerAddress);
        agentAddress = agentAddress || convo.agentAddress;

        if (convo.conversationState === ConversationState.Wait) {
            return this.setConversationStateToWaitAndWatch(customerAddress, agentAddress);
        }

        return this.setConversationState(customerAddress, ConversationState.Watch, agentAddress);
    }

    public unsetConversationToWatch(customerAddress: string | IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerAddress);

        if (convo.conversationState === ConversationState.WatchAndWait) {
            return this.setConversationStateToWait(customerAddress);
        }

        return this.setConversationStateToBot(customerAddress);
    }

    private setConversationStateToWaitAndWatch(customerAddressOrConvoId: string | IAddress, agentAddress?: IAddress): IConversation {
        if (!agentAddress) {
            agentAddress = this.getConversationFromCustomerAddress(customerAddressOrConvoId).agentAddress;
        }

        return this.setConversationState(customerAddressOrConvoId, ConversationState.WatchAndWait, agentAddress);
    }

    private setConversationStateToBot(customerAddress: string | IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerAddress);

        convo.conversationState = ConversationState.Bot;
        delete convo.agentAddress;

        return convo;
    }

    private setConversationState(customerConvo: string | IAddress, state: ConversationState, agentAddress?: IAddress): IConversation {
        const convo = this.getConversationFromCustomerAddress(customerConvo);

        if (isNewConversationStateTheSame(convo, state)) {
            throw new ConversationStateUnchangedException(`conversation was already in state ${state}`);
        }

        convo.conversationState = state;
        convo.agentAddress = agentAddress;

        return convo;
    }
}
