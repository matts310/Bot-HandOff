import * as Promise from 'bluebird';
import { IAddress, IMessage } from 'botbuilder';
import { IConversation } from '../IConversation';
import { IHandoffMessage } from './../IHandoffMessage';

export interface IProvider {
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

    getConversationFromCustomerAddress(customerAddress: IAddress): Promise<IConversation>;
    getConversationFromAgentAddress(agentAddress: IAddress): Promise<IConversation>;
    getAllConversations(): Promise<IConversation[]>;
}
