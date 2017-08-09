export class AgentAlreadyInConversationError extends Error {
    constructor(msg: string = 'agent already in conversation') {
        super(msg);

        this.name = 'AgentAlreadyInConversationError';

        Object.setPrototypeOf(this, AgentAlreadyInConversationError.prototype);
    }
}
