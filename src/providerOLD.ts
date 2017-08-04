// import * as builder from 'botbuilder';
// import { ConversationState }  from './constants';
// import { IConversation } from './IConversation';
// import { IHandoffRoutingAddress, IProvider } from './IProvider';

// export let conversations: IConversation[];

// export const  init = async () => {
//     conversations = [];
// };

// // Update

// const addToTranscript = async (by: IHandoffRoutingAddress, message: builder.IMessage, from: string): Promise<void> => {
//     const conversation = await getConversation(by);
//     const text = message.text;

//     if (!conversation) {
//         conversation.transcript.push({
//             timestamp: message.localTimestamp,
//             from: by.agentConversationId ? 'Agent' : 'Customer',
//             sentimentScore: 1,
//             state: conversation.state,
//             text
//         });
//     }

//     return Promise.resolve();
// };

// const connectCustomerToAgent = async (by: IHandoffRoutingAddress, agentAddress: builder.IAddress): Promise<IConversation> => {
//     const conversation = await getConversation(by);
//     if (conversation) {
//         conversation.state = ConversationState.Agent;
//         conversation.agent = agentAddress;
//     }

//     return Promise.resolve(conversation);
// };

// const queueCustomerForAgent = async (by: IHandoffRoutingAddress): Promise<void> => {
//     const conversation = await getConversation(by);
//     if (!conversation) {
//         return Promise.resolve();
//     }

//     conversation.state = ConversationState.Waiting;

//     if (conversation.agent) {
//         delete conversation.agent;
//     }

//     return Promise.resolve();
// };

// const connectCustomerToBot = async (by: IHandoffRoutingAddress): Promise<void> => {
//     const conversation = await getConversation(by);
//     if (!conversation) {
//         return Promise.resolve();
//     }

//     conversation.state = ConversationState.Bot;

//     if (conversation.agent) {
//         delete conversation.agent;
//     }

//     return Promise.resolve();
// };

// // Get
// const getConversation = async (
//     by: IHandoffRoutingAddress,
//     customerAddress?: builder.IAddress // if looking up by customerConversationId, create new conversation if one doesn't already exist
// ): Promise<IConversation> => {
//     // local function to create a conversation if customer does not already have one
//     const createConversation = (customerAddress: builder.IAddress) => {
//         const conversation = {
//             customer: customerAddress,
//             state: ConversationState.Bot,
//             transcript: []
//         };
//         conversations.push(conversation);

//         return Promise.resolve(conversation);
//     };

//     if (by.bestChoice) {
//         const waitingLongest = conversations
//             .filter(conversation => conversation.state === ConversationState.Waiting)
//             .sort((x, y) => y.transcript[y.transcript.length - 1].timestamp - x.transcript[x.transcript.length - 1].timestamp);
//         return await Promise.resolve(waitingLongest.length > 0 && waitingLongest[0]);
//     }
//     if (by.customerName) {
//         return Promise.resolve(conversations.find(conversation =>
//             conversation.customer.user.name === by.customerName
//         ));
//     } else if (by.agentConversationId) {
//         return Promise.resolve(conversations.find(conversation =>
//             conversation.agent && conversation.agent.conversation.id === by.agentConversationId
//         ));
//     } else if (by.customerConversationId) {
//         let conversation = conversations.find(conversation =>
//             conversation.customer.conversation.id === by.customerConversationId
//         );
//         if (!conversation && customerAddress) {
//             conversation = await createConversation(customerAddress);
//         }
//         return Promise.resolve(conversation);
//     }
//     return null;
// };

// const getCurrentConversations = (): Promise<IConversation[]> =>
//     Promise.resolve(conversations);

// export const defaultProvider: IProvider = {
//     // Update
//     addToTranscript,
//     connectCustomerToAgent,
//     connectCustomerToBot,
//     queueCustomerForAgent,

//     // Get
//     getConversation,
//     getCurrentConversations
// };
