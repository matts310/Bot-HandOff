import { Session } from 'botbuilder';
import { MessageReceivedWhileWaitingHandler } from '../options/MessageReceivedWhileWaitingHandler';
import { AgentMessageRouter } from '../routers/AgentMessageRouter';
import { CustomerMessageRouter } from '../routers/CustomerMessageRouter';
import { IHandoffMessage } from './../IHandoffMessage';

export function getRouteMessgeMiddleware(
    customerMessageRouter: CustomerMessageRouter,
    agentMessageRouter: AgentMessageRouter
): (session: Session, next: Function) => void {
    return (session: Session, next: Function) => {
        if (session.message.type === 'message') {
            const message = session.message as IHandoffMessage;

            if (message.agentAddress) {
                agentMessageRouter.Route(session);
            } else {
                customerMessageRouter.Route(session, next);
            }
        } else {
            next();
        }
    };
}
