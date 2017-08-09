export class CustomerAlreadyQueuedError extends Error {
    constructor(msg: string = 'customer is already queued') {
        super(msg);

        this.name = 'CustomerAlreadyQueuedError';

        Object.setPrototypeOf(this, CustomerAlreadyQueuedError.prototype);
    }
}
