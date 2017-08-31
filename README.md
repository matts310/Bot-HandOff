# bot-handoff [![CircleCI](https://circleci.com/gh/microsoftly/Bot-HandOff.svg?style=shield)](https://circleci.com/gh/microsoftly/BotTester) [![npm version](https://badge.fury.io/js/bot-handoff.svg)](https://badge.fury.io/js/bot-tester) [![Coverage Status](https://coveralls.io/repos/github/microsoftly/Bot-HandOff/badge.svg?branch=master)](https://coveralls.io/github/microsoftly/Bot-HandOff?branch=master)

A common request from companies and organizations considering bots is the ability to "hand off" a customer from a bot to a human agent, as seamlessly as possible.

This project provides an unopinionated framework called **bot-handoff**, which enables bot authors to implement several scenrios including, but not limited to a full fledged call center service, with minimal changes to the bot

A demo is not included yet. Expect it down the line.

While the docs are being written, you can refer to the tests.

Just an initial note: if you wish to have a data provider that is not in memory, you must implement the ```IProvider``` interface and pass the provider tests. Just add your implementation to ```provider.spec.ts```'s runner and run the suite or use the exported test runner from ```test/providerTests.ts```. If your provider passes all tests it will work as expected with the routing layer. If you wish to make your implementation public, please provide submit a PR and it will be reviewed.

MIT License
