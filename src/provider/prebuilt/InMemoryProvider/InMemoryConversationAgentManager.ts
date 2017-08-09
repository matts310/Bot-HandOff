import { IAddress } from 'botbuilder';
import { isEqual, remove } from 'lodash';
import { CustomerConnectedToAnotherAgentError } from '../../errors/CustomerConnectedToAnotherAgentError';
import { IConversation } from './../../../IConversation';
import { AgentAlreadyInConversationError } from './../../errors/AgentAlreadyInConversationError';

function getConversationIdFromAddresOrString(addressOrConvoId: string | IAddress): string {
    return typeof(addressOrConvoId) === 'string' ? addressOrConvoId : addressOrConvoId.conversation.id;
}

export class InMemoryConversationAgentManager {
    private conversations: {[s: string]: IConversation};

    constructor(conversations: {[s: string]: IConversation}) {
        this.conversations = conversations;
    }

    /**
     * adds agent from conversation with customer with customerAddress
     *
     * @param customerAddressOrConvoId address of customer conversation
     * @param agentAddress agent address to be added
     */
    public addWatchingAgent(customerAddressOrConvoId: string | IAddress, agentAddress: IAddress): void {
        const convo = this.getConvo(customerAddressOrConvoId);
        const agentAlreadyWatching = !!convo.watchingAgents.find((curAgentAddress: IAddress) => isEqual(curAgentAddress, agentAddress));

        if (!agentAlreadyWatching) {
            convo.watchingAgents.push(agentAddress);
        }
    }

    /**
     * removes an agent from the watching collection
     * @param customerAddressOrConvoId address of customer conversation
     * @param agentAddress agent address to be removed
     * @returns true if agent was removed, false if agent was not in collection
     */
    public removeWatchingAgent(customerAddressOrConvoId: string | IAddress, agentAddress: IAddress): boolean {
        const convo = this.getConvo(customerAddressOrConvoId);
        const initialAgentWatchCount = convo.watchingAgents.length;

        remove(convo.watchingAgents, (addr: IAddress) => isEqual(addr, agentAddress));

        return convo.watchingAgents.length !== initialAgentWatchCount;
    }

    /**3
     * sets the conversation to be connected to agent. Adds the agent address to the watch list if it is not already present
     *
     * @param customerAddressOrConvoId address of customer conversation
     * @param agentAddress agent that is going to be connected.
     */
    public connectConversationToAgent(customerAddressOrConvoId: string | IAddress, agentAddress: IAddress): void {
        const convo = this.getConvo(customerAddressOrConvoId);

        if (convo.agentAddress) {
            if (isEqual(convo.agentAddress, agentAddress)) {
                throw new AgentAlreadyInConversationError();
            } else {
                throw new CustomerConnectedToAnotherAgentError();
            }
        }

        convo.agentAddress = agentAddress;
        this.addWatchingAgent(customerAddressOrConvoId, agentAddress);
    }

    /**
     * sets the conversation to no longer be set to agent. The agent address that was connected is removed from the watch list
     *
     * @param customerAddressOrConvoId address of customer conversation
     */
    public removeConnectedAgent(customerAddressOrConvoId: string | IAddress): void {
        const convo = this.getConvo(customerAddressOrConvoId);
        const connectedAgentAddress = convo.agentAddress;

        if (!connectedAgentAddress) {
            throw new Error('no agent is connected');
        }

        this.removeWatchingAgent(customerAddressOrConvoId, connectedAgentAddress);
        delete convo.agentAddress;
    }

    private getConvo(customerAddressOrConvoId: string | IAddress): IConversation {
        const customerConvoId = getConversationIdFromAddresOrString(customerAddressOrConvoId);

        return this.conversations[customerConvoId];
    }
}
