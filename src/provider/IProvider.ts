import * as Promise from 'bluebird';
import { IAddress, IMessage } from 'botbuilder';
import { ConversationState, MessageSource } from '../constants';
import { IConversation } from '../IConversation';
import { IHandoffEventMessage } from './../IHandoffMessage';
import { IHandoffMessage } from './../IHandoffMessage';

export class AgentNotInConversationError extends Error {
    constructor(agentConversationId: string) {
        super(`no customer conversation found for agent with conversation id ${agentConversationId}`);

        this.name = 'AgentNotInConversationError';

        Object.setPrototypeOf(this, AgentNotInConversationError.prototype);
    }
}

export class AgentAlreadyInConversationError extends Error {
    constructor(agentConversationId: string) {
        super(`agent cannot have two conversations with customers on same conversation id ${agentConversationId}`);

        this.name = 'AgentAlreadyInConversationError';

        Object.setPrototypeOf(this, AgentAlreadyInConversationError.prototype);
    }
}

export class BotAttemptedToRecordMessageWhileAgentHasConnection extends Error {
    constructor(customerConversationId: string) {
        super(`A bot attempted to record a message on customer conversation ${customerConversationId}, which is connected to an agent`);

        this.name = 'BotAttemptedToRecordMessageWhileAgentHasConnection';

        Object.setPrototypeOf(this, BotAttemptedToRecordMessageWhileAgentHasConnection.prototype);
    }
}

//tslint:disable
export class AgentWithConvoIdNotEqualToWatchingAgentConvoId extends Error {
    constructor(customerConvoId: string, agentConvoId: string) {
        super(`Agent attempted to connect convo ${agentConvoId} to customer convo ${customerConvoId}`);

        this.name = 'AgentWithConvoIdNotEqualToWatchingAgentConvoId';

        Object.setPrototypeOf(this, AgentWithConvoIdNotEqualToWatchingAgentConvoId.prototype);
    }
}
//tslint:enable

export interface IProvider {

    // Update
    addCustomerMessageToTranscript(message: IHandoffMessage): Promise<IConversation>;
    addAgentMessageToTranscript(message: IHandoffMessage): Promise<IConversation>;
    addBotMessageToTranscript(message: IHandoffMessage): Promise<IConversation>;
    addBotMessageToTranscriptIgnoringConversationState(message: IHandoffMessage): Promise<IConversation>;
    /*
        there are 3 basic pairwise actions that can be performed
            1. connect/disconnect customer to/from agent
            2. queue/dequeue customer for agent
            3. watch/unwatch customer conversation (agent)
    */

    connectCustomerToAgent(customerAddress: IAddress, agentAddress: IAddress): Promise<IConversation>;
    disconnectCustomerFromAgent(customerAddress: IAddress, agentAddress: IAddress): Promise<IConversation>;

    queueCustomerForAgent(customerAddress: IAddress): Promise<IConversation>;
    dequeueCustomerForAgent(customerAddress: IAddress): Promise<IConversation>;

    watchConversation(customerAddress: IAddress, agentAddress: IAddress): Promise<IConversation>;
    unwatchConversation(customerAddress: IAddress, agentAddress: IAddress): Promise<IConversation>;

    // Get
    getConversationFromCustomerAddress(customerAddress: IAddress): Promise<IConversation>;
    getConversationFromAgentAddress(agentAddress: IAddress): Promise<IConversation>;
    getCurrentConversations(): Promise<IConversation[]>;
}
