export class AgentNotWatchingConversationError extends Error {
    constructor(msg: string = 'Agent is not watching the customer it is attempting to unwatch') {
        super(msg);

        this.name = 'AgentNotWatchingConversationError';

        Object.setPrototypeOf(this, AgentNotWatchingConversationError.prototype);
    }
}
