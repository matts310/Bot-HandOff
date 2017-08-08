export class AgentNotInConversationError extends Error {
    constructor(msg: string) {
        super(msg);

        this.name = 'AgentNotInConversationError';

        Object.setPrototypeOf(this, AgentNotInConversationError.prototype);
    }
}
