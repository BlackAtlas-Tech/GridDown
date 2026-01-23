/**
 * GridDown Events - Pub/Sub Event System
 */
const Events = (function() {
    'use strict';
    const listeners = new Map();

    const on = (event, cb, opts = {}) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push({ cb, once: opts.once || false });
        return () => off(event, cb);
    };

    const once = (event, cb) => on(event, cb, { once: true });

    const off = (event, cb) => {
        if (!listeners.has(event)) return;
        const arr = listeners.get(event);
        const idx = arr.findIndex(l => l.cb === cb);
        if (idx > -1) arr.splice(idx, 1);
    };

    const emit = (event, data) => {
        if (!listeners.has(event)) return;
        const arr = listeners.get(event);
        const toRemove = [];
        arr.forEach((l, i) => { try { l.cb(data); if (l.once) toRemove.push(i); } catch (e) { console.error(`Event error [${event}]:`, e); } });
        toRemove.reverse().forEach(i => arr.splice(i, 1));
    };

    const EVENTS = {
        APP_READY: 'app:ready', PANEL_CHANGE: 'panel:change',
        MAP_CLICK: 'map:click', MAP_RENDER: 'map:render',
        WAYPOINT_ADD: 'waypoint:add', WAYPOINT_SELECT: 'waypoint:select',
        ROUTE_ADD: 'route:add', ROUTE_SELECT: 'route:select',
        MODAL_OPEN: 'modal:open', MODAL_CLOSE: 'modal:close',
        TOAST_SHOW: 'toast:show'
    };

    return { on, once, off, emit, EVENTS };
})();
window.Events = Events;
