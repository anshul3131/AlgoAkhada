/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Global Event Emitter instance bridging asynchronous workers to WebSocket broadcasts
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { EventEmitter } from "events";

// Create a single, global instance of the event emitter
class AppEventEmitter extends EventEmitter {}
export const appEvents = new AppEventEmitter();
