export enum ConversationState {
    Bot = 'bot',
    Wait = 'wait',
    Agent = 'agent',
    Watch = 'watch',
    WatchAndWait = 'watch & wait'
}

export enum MessageType {
    Connect = '__connect__',
    Disconnect = '__disconnect__',
    Watch = '__watch__',
    Unwatch = '__unwatch__',
    Queue = '__queue__',
    Dequeue = '__dequeue__'
}

export enum MessageSource {
    Bot = 'Bot',
    Agent = 'Agent',
    Customer = 'Customer'
}
