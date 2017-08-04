import { IAddress, IMessage } from 'botbuilder';
import { ConversationState } from './constants';

// What an entry in the customer transcript will have
export interface ITranscriptLine {
    timestamp: {};
    from: string;
    sentimentScore?: number;
    text: string;
}

// What is stored in a conversation. Agent only included if customer is talking to an agent
export interface IConversation {
    customerAddress: IAddress;
    agentAddress?: IAddress;
    conversationState: ConversationState;
    transcript: ITranscriptLine[];
}

export function createDefaultConversation(customerAddress: IAddress): IConversation {
    return {
        customerAddress,
        conversationState: ConversationState.Bot,
        transcript: []
    };
}
