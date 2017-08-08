import { IAddress, IMessage } from 'botbuilder';

export enum ConversationState {
    Bot = 'bot',
    Wait = 'wait',
    Agent = 'agent',
    Watch = 'watch',
    WatchAndWait = 'watch & wait'
}

// What an entry in the customer transcript will have
export interface ITranscriptLine extends IMessage {
    from: string;
    sentimentScore?: number;
}

// What is stored in a conversation. Agent only included if customer is talking to an agent or if agent is watching
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
