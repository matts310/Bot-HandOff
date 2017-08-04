import * as Promise from 'bluebird';
import { BotTester } from 'bot-tester';
import { ConsoleConnector, IAddress, IMessage, Message, Session, UniversalBot } from 'botbuilder';
import { expect } from 'chai';
import { createConnectMessage } from '../src/IHandoffMessage';
import { InMemoryProvider } from '../src/provider/InMemoryProvider';
import { applyHandoffMiddleware } from './../src/applyHandoffMiddleware';
import { IHandoffMessage } from './../src/IHandoffMessage';

const connector = new ConsoleConnector();

const CUSTOMER_ADDRESS: IAddress = { channelId: 'console',
    user: { id: 'userId1', name: 'user1' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'user1Conversation' }
};

const AGENT_ADDRESS: IAddress = { channelId: 'console',
    user: { id: 'agentId', name: 'agent' },
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'agent_convo' }
};

const isAgent = (session: Session): Promise<boolean> => {
    return Promise.resolve(!!(session.message as IHandoffMessage).agentAddress);
};

describe('agent handoff', () => {
    let bot: UniversalBot;

    beforeEach(() => {
        bot = new UniversalBot(connector);

        bot.dialog('/', (session: Session) => {
            session.send('intro!');
        });

        applyHandoffMiddleware(bot, isAgent, new InMemoryProvider());
    });

    it('can handover to agents', () => {
        const customerIntroMessage = new Message()
            .text('hello')
            .address(CUSTOMER_ADDRESS)
            .toMessage();

        customerIntroMessage.user = { id: 'userId1', name: 'user1' };

        const agentMessage = new Message()
            .address(AGENT_ADDRESS)
            .text('hello there')
            .toMessage();

        agentMessage.user = { id: 'agentId', name: 'agent' };

        const userReceptionOfAgentMessage = Object.assign({}, agentMessage, { address: CUSTOMER_ADDRESS, text: 'hello there'});

        return new BotTester(bot, CUSTOMER_ADDRESS)
            .sendMessageToBot(customerIntroMessage, 'intro!')

            // hacking this for testing purposes. This should be done behind the scenes in the bot
            .sendMessageToBot(createConnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS), 'you\'re now connected to an agent')
            //tslint:disable
            .sendMessageToBot(agentMessage, userReceptionOfAgentMessage)
            .runTest();
    });
});

