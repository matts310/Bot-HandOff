export class ConversationStateUnchangedException extends Error {
    constructor(msg: string) {
        super(msg);

        this.name = 'ConversationStateUnchangedException';

        Object.setPrototypeOf(this, ConversationStateUnchangedException.prototype);
    }
}
