import { Session, UniversalBot } from 'botbuilder';

//tslint:disable
export type MessageReceivedWhileWaitingHandler = (bot: UniversalBot, session: Session, next: Function) => any;
//tslint:enable

export const defaultMessageReceivedWhileWaitingHandler: MessageReceivedWhileWaitingHandler =
//tslint:disable
    (bot: UniversalBot, session: Session, next: Function): any => {
//tslint:enable
        session.send('please hold on while we connect you to an agent');
};
