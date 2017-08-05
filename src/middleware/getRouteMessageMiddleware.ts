import { Session } from 'botbuilder';
import { IHandoffMessage } from './../IHandoffMessage';

export function getRouteMessgeMiddleware(
    routeCustomerMessage: (session: Session, next: Function) => void,
    routeAgentMessage: (session: Session) => void
): (session: Session, next: Function) => void {
    return (session: Session, next: Function) => {
        if (session.message.type === 'message') {
            const message = session.message as IHandoffMessage;
            if (message.agentAddress) {
                console.log('taking agent path');
                routeAgentMessage(session);
            } else {
                routeCustomerMessage(session, next);
            }
        } else {
            next();
        }
    };
}
