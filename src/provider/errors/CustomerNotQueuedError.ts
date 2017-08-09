export class CustomerNotQueuedError extends Error {
    constructor(msg: string = 'Agent is not watching the customer it is attempting to unwatch') {
        super(msg);

        this.name = 'CustomerNotQueuedError';

        Object.setPrototypeOf(this, CustomerNotQueuedError.prototype);
    }
}
