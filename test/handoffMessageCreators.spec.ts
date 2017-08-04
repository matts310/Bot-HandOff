import { IAddress } from 'botbuilder';
import { expect } from 'chai';
import { MessageType } from '../src/constants';
import {
    createConnectMessage,
    createDequeueMessage,
    createDisconnectMessage,
    createQueueMessage,
    createUnwatchEventMessage,
    createWatchEventMessage,
    IHandoffEventMessage
} from './../src/IHandoffMessage';

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

describe('Handoff message creators', () => {

    it('createConnectMessage creates connect message    ', () => {
        const msg = createConnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

        expect(msg.type).to.be.equal(MessageType.Connect);
        expect(msg.agentAddress).to.deep.equal(AGENT_ADDRESS);
        expect(msg.customerAddress).to.be.deep.equal(CUSTOMER_ADDRESS);
    });

    it('createDisconnectMessage creates disconnect message    ', () => {
        const msg = createDisconnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

        expect(msg.type).to.be.equal(MessageType.Disconnect);
        expect(msg.agentAddress).to.deep.equal(AGENT_ADDRESS);
        expect(msg.customerAddress).to.be.deep.equal(CUSTOMER_ADDRESS);
    });

    it('createDequeueMessage dequeue message    ', () => {
        const msg = createDequeueMessage(CUSTOMER_ADDRESS);

        expect(msg.type).to.be.equal(MessageType.Dequeue);
        expect(msg.agentAddress).to.be.undefined;
        expect(msg.customerAddress).to.be.deep.equal(CUSTOMER_ADDRESS);
    });

    it('createQueueMessage creates queue message    ', () => {
        const msg = createQueueMessage(CUSTOMER_ADDRESS);

        expect(msg.type).to.be.equal(MessageType.Queue);
        expect(msg.agentAddress).to.be.undefined;
        expect(msg.customerAddress).to.be.deep.equal(CUSTOMER_ADDRESS);
    });

    it('createWatchMessage creates watch message    ', () => {
        const msg = createWatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

        expect(msg.type).to.be.equal(MessageType.Watch);
        expect(msg.agentAddress).to.deep.equal(AGENT_ADDRESS);
        expect(msg.customerAddress).to.be.deep.equal(CUSTOMER_ADDRESS);
    });

    it('createUnwatchMessage creates unwatch message    ', () => {
        const msg = createUnwatchEventMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

        expect(msg.type).to.be.equal(MessageType.Unwatch);
        expect(msg.agentAddress).to.deep.equal(AGENT_ADDRESS);
        expect(msg.customerAddress).to.be.deep.equal(CUSTOMER_ADDRESS);
    });

    it('createConnectMessage creates connect message    ', () => {
        const msg = createConnectMessage(CUSTOMER_ADDRESS, AGENT_ADDRESS);

        expect(msg.type).to.be.equal(MessageType.Connect);
        expect(msg.agentAddress).to.deep.equal(AGENT_ADDRESS);
        expect(msg.customerAddress).to.be.deep.equal(CUSTOMER_ADDRESS);
    });
});
