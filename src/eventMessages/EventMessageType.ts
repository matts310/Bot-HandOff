export enum EventMessageType {
    Connect = '__connect__',
    Disconnect = '__disconnect__',
    Watch = '__watch__',
    Unwatch = '__unwatch__',
    Queue = '__queue__',
    Dequeue = '__dequeue__',
    Error = '__handoffError__',
    Success = '__handoffSuccess__'
}
