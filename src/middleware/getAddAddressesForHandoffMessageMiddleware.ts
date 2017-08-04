import * as Promise from 'bluebird';
import { Session } from 'botbuilder';
import { addAgentAddressToMessage, addCustomerAddressToMessage, IHandoffEventMessage } from './../IHandoffMessage';

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
            const message = session.message;

            this.isAgent(session)
                .then((isAgent: boolean) => {
                    if (isAgent) {
                        addAgentAddressToMessage(message, message.address);
                    } else {
                        addCustomerAddressToMessage(message, message.address);
                    }

                    next();
                });
        };
    }
}
