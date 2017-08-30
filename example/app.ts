import { HandoffEventMessage } from '../src/eventMessages/HandoffEventMessage';
import { InMemoryProvider } from '../src/provider/prebuilt/InMemoryProvider';
require('dotenv').config();
import * as Promise from 'bluebird';
import * as bodyParser from 'body-parser';
import * as builder from 'botbuilder';
import * as cors from 'cors';
import * as express from 'express';
import * as handoff from '../src/applyHandoffMiddleware';

//=========================================================
// Normal Bot Setup
//=========================================================

const app = express();

// Setup Express Server
app.listen(process.env.port || process.env.PORT || 3978, '::', () => {
    console.log('Server Up');
});

// Create chat bot
const connector = new builder.ChatConnector({
    appId: process.env.MSFT_APP_ID,
    appPassword: process.env.MSFT_APP_PASSWORD
});

console.log({
    appId: process.env.MSFT_APP_ID,
    appPassword: process.env.MSFT_APP_PASSWORD
});

app.post('/api/messages', connector.listen());
const provider = new InMemoryProvider();
const bot = new builder.UniversalBot(connector, [
    function (session) {
        const msg = session.message;
        if (msg.type !== 'message') {
            const address = (msg as HandoffEventMessage).agentAddress || (msg as HandoffEventMessage).customerAddress;
            console.log('handoff event!');
        } else {
            console.log('HERE', session.message.text);
            console.log(JSON.stringify(session.message.address, null, 2));
            // console.log(JSON.stringify(session.message, null, 2));
            session.send(session.message.text);
            // bot.send(session.message);
            // session.endConversation('Echo ' + session.message.text);
        }
    }
]);
bot.use({receive: (a, next) => {
    // console.log('WHY DOES THIS NOT GET HIT');
    console.log(JSON.stringify(a, null, 2));
    next();
}});
//=========================================================
// Hand Off Setup
//=========================================================

// Replace this function with custom login/verification for agents
const isAgent = (session: builder.Session) => Promise.resolve(!!session.message.user.name.startsWith('Agent'));

handoff.applyHandoffMiddleware(bot, isAgent, provider);

// handoff.setup(bot, app, isAgent, {
//     mongodbProvider: process.env.MONGODB_PROVIDER,
//     directlineSecret: process.env.MICROSOFT_DIRECTLINE_SECRET,
//     textAnalyticsKey: process.env.CG_SENTIMENT_KEY,
//     appInsightsInstrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
//     retainData: process.env.RETAIN_DATA,
//     customerStartHandoffCommand: process.env.CUSTOMER_START_HANDOFF_COMMAND
// });

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use('/webchat', express.static('public'));
app.get('/api/conversations', (req, res) => {
    provider.getAllConversations()
        .then((convos) =>  res.send(convos).status(200));
});
app.get('/api/convoKeys', (req, res) => {
    res.send(provider.conversations).status(200);
        // .then((convos) =>  res.send(convos).status(200));
});
