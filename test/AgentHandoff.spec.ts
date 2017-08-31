import * as Promise from 'bluebird';
import { BotTester } from 'bot-tester';
import { ConsoleConnector, IAddress, Message, Session, UniversalBot } from 'botbuilder';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { QueueEventMessage } from '../src/eventMessages/QueueEventMessage';
import { IConversation } from '../src/IConversation';
import { MessageReceivedWhileWaitingHandler } from '../src/options/MessageReceivedWhileWaitingHandler';
import { InMemoryProvider } from '../src/provider/prebuilt/InMemoryProvider';
import { applyHandoffMiddleware } from './../src/applyHandoffMiddleware';
import { ConnectEventMessage } from './../src/eventMessages/ConnectEventMessage';
import { IProvider } from './../src/provider/IProvider';

chai.use(sinonChai);

const expect = chai.expect;

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
    let provider: IProvider;

    const customerIntroMessage = new Message()
        .text('hello')
        .address(CUSTOMER_ADDRESS)
        .toMessage();

    const agentMessage = new Message()
        .address(AGENT_ADDRESS)
        .text('hello there')
        .toMessage();

    beforeEach(() => {
        provider = new InMemoryProvider();
        bot = new UniversalBot(connector);
        bot.dialog('/', (session: Session) => {
            session.send('intro!');
        });
    });

    it('can handover to agents', () => {
        applyHandoffMiddleware(bot, isAgent, provider);

        const userReceptionOfAgentMessage = Object.assign({}, agentMessage, { address: CUSTOMER_ADDRESS, text: 'hello there'});
        const userResponseToAgent = Object.assign({}, customerIntroMessage, {text: 'I\'m responding'});
        const agentReceptionOfResponse = Object.assign({}, userResponseToAgent, { address: AGENT_ADDRESS });

        return new BotTester(bot, CUSTOMER_ADDRESS)
            .sendMessageToBot(customerIntroMessage, 'intro!')
            .sendMessageToBot(new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS), 'you\'re now connected to an agent')
            .sendMessageToBot(agentMessage, userReceptionOfAgentMessage)
            .sendMessageToBot(userResponseToAgent, agentReceptionOfResponse)
            .runTest()
            .then(() => provider.getAllConversations())
            .then((convos: IConversation[]) => {
                convos.forEach((convo: IConversation) => {
                    expect(convo.transcript).not.to.be.empty;
                });
            });
    });

    describe('Handoff Options', () => {
        it('will not transcribe if shouldTranscribeMessages option is set to false', () => {
            applyHandoffMiddleware(bot, isAgent, provider, {shouldTranscribeMessages: false});

            const userReceptionOfAgentMessage = Object.assign({}, agentMessage, { address: CUSTOMER_ADDRESS, text: 'hello there'});

            return new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(customerIntroMessage, 'intro!')
                .sendMessageToBot(new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS), 'you\'re now connected to an agent')
                .sendMessageToBot(agentMessage, userReceptionOfAgentMessage)
                .runTest()
                .then(() => provider.getAllConversations())
                .then((convos: IConversation[]) => {
                    convos.forEach((convo: IConversation) => {
                        expect(convo.transcript).to.be.empty;
                    });
                });
        });

        it('calls the MessageReceivedWhileWaitingHandler when in a waiting state', () => {
        // limitations of the BotTester famework require next to be called for the test to pass
            const messageReceivedHandler: MessageReceivedWhileWaitingHandler = (_0: UniversalBot, _1: Session, next: Function) => {
                next();
            };
            const spy = sinon.spy(messageReceivedHandler);
            const resetSpy = () => spy.reset();
            const messageReceivedWhileWaitingHandlerSpy = spy as MessageReceivedWhileWaitingHandler;
            const expectMessageReceivedWhileWaitingNotToHaveBeenCalled =
                () => expect(messageReceivedWhileWaitingHandlerSpy).not.to.have.been.called;
            const expectMessageReceivedWhileWaitingToHaveBeenCalledOnce =
                () => expect(messageReceivedWhileWaitingHandlerSpy).to.have.been.calledOnce;

            applyHandoffMiddleware(bot, isAgent, provider, { messageReceivedWhileWaitingHandler: messageReceivedWhileWaitingHandlerSpy });

            const userReceptionOfAgentMessage = Object.assign({}, agentMessage, { address: CUSTOMER_ADDRESS, text: 'hello there'});

            return new BotTester(bot, CUSTOMER_ADDRESS)
                .sendMessageToBot(customerIntroMessage, 'intro!')
                .then(expectMessageReceivedWhileWaitingNotToHaveBeenCalled)

                .sendMessageToBot(new QueueEventMessage(CUSTOMER_ADDRESS))
                .then(expectMessageReceivedWhileWaitingNotToHaveBeenCalled)

                .sendMessageToBot(customerIntroMessage)
                .then(expectMessageReceivedWhileWaitingToHaveBeenCalledOnce)
                .then(resetSpy)

                .sendMessageToBot(new ConnectEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS), 'you\'re now connected to an agent')
                .then(expectMessageReceivedWhileWaitingNotToHaveBeenCalled)

                .sendMessageToBot(agentMessage, userReceptionOfAgentMessage)
                .then(expectMessageReceivedWhileWaitingNotToHaveBeenCalled)
                .runTest();
        });
    });
});
