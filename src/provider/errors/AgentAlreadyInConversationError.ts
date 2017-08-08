export class AgentAlreadyInConversationError extends Error {
    constructor(msg: string) {
        super(msg);

        this.name = 'AgentAlreadyInConversationError';

        Object.setPrototypeOf(this, AgentAlreadyInConversationError.prototype);
    }
}
