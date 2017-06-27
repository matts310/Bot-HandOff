import * as express from 'express';
import * as builder from 'botbuilder';
import { Message , IAddress} from 'botbuilder';
import * as chai from 'chai';
import { BotTester } from 'bot-tester';
import * as Promise from 'bluebird';
import handoff = require('../handoff-publish');

const { MongoClient } = require('mongodb');

const isAgent = (session: builder.Session) => session.message.user.name.startsWith("Agent");

const userAddress = { channelId: 'console',
    user: { id: 'user', name: 'user' }, 
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'userConversation' } 
};

const agentAddress = { channelId: 'console',
    user: { id: 'Agent', name: 'Agent' }, 
    bot: { id: 'bot', name: 'Bot' },
    conversation: { id: 'agentConversation' } 
};

const MONGO_PORT = 26017; // 27017;

const connectionString = 'mongodb://localhost:26017/test';

describe('Handoff tests', () => {
    let bot;
    let db;
    let server;
    let app;

    before((done) => {
        MongoClient.connect(connectionString, (err, database) => {
            if(err) throw err;

            db = database;
            const connector = new builder.ConsoleConnector();
            app = express();

            bot = new builder.UniversalBot(connector);

            connector.listen();

            bot.dialog('/', (session) => {
                session.send('Echo ' + session.message.text)
            });

            server = app.listen(3978, '::', () => {
                console.log('Server Up');
            });
            done()
            // handoff.setup(bot, app, isAgent, {
            //     mongodbProvider: process.env.MONGODB_PROVIDER || connectionString,
            //     directlineSecret: process.env.MICROSOFT_DIRECTLINE_SECRET || 'secret',
            //     textAnalyticsKey: process.env.CG_SENTIMENT_KEY,
            //     appInsightsInstrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
            //     retainData: false,
            //     customerStartHandoffCommand: 'HELP'
            // });
            // setTimeout(done, 2000)
        }, );
    })

    after((done) => {
        server.close();
        db.close(done);
    })

    afterEach((done) => {        
        db.dropDatabase(done);
    })

    xit('can do things!', () => {
        const {
            executeDialogTest,
            sendMessageToBot,
            InspectSessionDialogStep,
            SendMessageToBotDialogStep
        }
        = BotTester(bot, userAddress);

        const userMessage = new Message().text('HELP').address(userAddress).toMessage();
        const connectMessage = new Message().text('connect user').address(agentAddress).toMessage();
        const testSendUserMessage = new Message().text('Hi there home slice!').address(agentAddress).toMessage();
        const testSendUserReceiveMessage = new Message().text('Hi there home slice!').address(userAddress).toMessage();

        return executeDialogTest([
            new SendMessageToBotDialogStep(userMessage, 'Connecting you to the next available agent.'),
            new SendMessageToBotDialogStep(connectMessage, 'You are connected to user', agentAddress),
            new SendMessageToBotDialogStep(testSendUserMessage, testSendUserReceiveMessage)
        ]);
    });

    it('can inspect session!!', () => {

        handoff.setup(bot, app, isAgent, {
                mongodbProvider: process.env.MONGODB_PROVIDER || connectionString,
                directlineSecret: process.env.MICROSOFT_DIRECTLINE_SECRET || 'secret',
                textAnalyticsKey: process.env.CG_SENTIMENT_KEY,
                appInsightsInstrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
                retainData: false,
                customerStartHandoffCommand: 'HELP'
            });

        const {
            executeDialogTest,
            sendMessageToBot,
            InspectSessionDialogStep,
            SendMessageToBotDialogStep
        }
        = BotTester(bot, userAddress);
        
        const userMessage = new Message().text('HELP').address(userAddress).toMessage();
        const connectMessage = new Message().text('connect user').address(agentAddress).toMessage();
        const testSendUserMessage = new Message().text('Hi there home slice!').address(agentAddress).toMessage();
        const testSendUserReceiveMessage = new Message().text('Hi there home slice!').address(userAddress).toMessage();

        return executeDialogTest([
            new SendMessageToBotDialogStep(userMessage, 'Connecting you to the next available agent.'),
            new InspectSessionDialogStep((session) => {
                console.log(session.userData);
                console.log(JSON.stringify(session.userData, null, 2));
            }),
            new SendMessageToBotDialogStep(connectMessage, 'You are connected to user', agentAddress),
            new SendMessageToBotDialogStep(testSendUserMessage, testSendUserReceiveMessage)
        ])
    });
});
