import * as Promise from 'bluebird';
import { Session } from 'botbuilder';
import { HandoffEventMessage } from '../eventMessages/HandoffEventMessage';

export function getAddAddressesForHandoffMessageMiddleware(
    isAgent: (session: Session) => Promise<boolean>
): (session: Session, next: Function) => void {
    return new AddAddressesForHandoffMessageMiddleware(isAgent).getMiddleware();
}

class AddAddressesForHandoffMessageMiddleware {
    private readonly isAgent: (session: Session) => Promise<boolean>;

    constructor(isAgent: (session: Session) => Promise<boolean>) {
        this.isAgent = isAgent;
    }

    public getMiddleware(): (session: Session, next: Function) => void {
        return  (session: Session, next: Function) => {
            const message = session.message as HandoffEventMessage;

            this.isAgent(session)
                .then((isAgent: boolean) => {
                    if (isAgent) {
                        message.agentAddress = message.address;
                    } else {
                        message.customerAddress = message.address;
                    }

                    next();
                });
        };
    }
}
