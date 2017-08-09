export class CustomerCannotQueueError extends Error {
    constructor(msg: string = 'customer cannot be queued') {
        super(msg);

        this.name = 'CustomerCannotQueueError';

        Object.setPrototypeOf(this, CustomerCannotQueueError.prototype);
    }
}
