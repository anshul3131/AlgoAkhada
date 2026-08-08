import { EventEmitter } from 'events';

// Create a single, global instance of the event emitter
class AppEventEmitter extends EventEmitter {}
export const appEvents = new AppEventEmitter();
