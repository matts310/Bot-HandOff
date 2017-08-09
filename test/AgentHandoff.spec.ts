import * as Promise from 'bluebird';
import { BotTester } from 'bot-tester';
import { ConsoleConnector, IAddress, Message, Session, UniversalBot } from 'botbuilder';
import { expect } from 'chai';
import { InMemoryProvider } from '../src/provider/prebuilt/InMemoryProvider';
import { applyHandoffMiddleware } from './../src/applyHandoffMiddleware';
import { ConnectEventMessage } from './../src/eventMessages/ConnectEventMessage';
import { IProvider } from './../src/provider/IProvider';

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
    return Promise.resolve(session.message.address.user.name === 'agent');
};

describe('agent handoff', () => {
    let bot: UniversalBot;

    const customerIntroMessage = new Message()
        .text('hello')
        .address(CUSTOMER_ADDRESS)
        .toMessage();

    beforeEach(() => {
        bot = new UniversalBot(connector);
        bot.dialog('/', (session: Session) => {
            session.send('intro!');
        });

        applyHandoffMiddleware(bot, isAgent, new InMemoryProvider());
    });

    it('can handover to agents', () => {
        const customerIntroMessage2 = new Message()
            .text('hello')
            .address(CUSTOMER_ADDRESS)
            .toMessage();

        const agentMessage = new Message()
            .address(AGENT_ADDRESS)
            .text('hello there')
            .toMessage();

        const userReceptionOfAgentMessage = Object.assign({}, agentMessage, { address: CUSTOMER_ADDRESS, text: 'hello there'});

        return new BotTester(bot, CUSTOMER_ADDRESS)
            .sendMessageToBot(customerIntroMessage2, 'intro!')
            .sendMessageToBot(new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS), 'you\'re now connected to an agent')
            .sendMessageToBot(agentMessage, userReceptionOfAgentMessage)
            .runTest();
    });
});
