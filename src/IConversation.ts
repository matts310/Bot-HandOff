import { IAddress, IMessage } from 'botbuilder';

export enum ConversationState {
    Bot = 'bot',
    Wait = 'wait',
    Agent = 'agent',
    Watch = 'watch',
    WatchAndWait = 'watch & wait'
}

export interface ITranscriptLine extends IMessage {
    // to will always be populated with the address of the message sent
    // from will be populated with the address of the recepient, or null if the originator was the bot
    to: IAddress;
    from?: IAddress;
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
