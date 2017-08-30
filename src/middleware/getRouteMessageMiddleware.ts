import { Session } from 'botbuilder';
import { IHandoffMessage } from './../IHandoffMessage';

export function getRouteMessgeMiddleware(
    routeCustomerMessage: (session: Session, next: Function) => void,
    routeAgentMessage: (session: Session) => void
): (session: Session, next: Function) => void {
    return (session: Session, next: Function) => {
        if (session.message.type === 'message') {
            const message = session.message as IHandoffMessage;
            console.log('routing!')
            if (message.agentAddress) {
                console.log("ROUTING TO AGENT")
                routeAgentMessage(session);
            } else {
                console.log("ROUTING TO CUSTOMER")
                routeCustomerMessage(session, next);
            }
        } else {
            next();
        }
    };
}
