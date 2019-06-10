var isNumeric = require('fast-isnumeric');

var mouseEvent = require('./mouse_event');
var touchEvent = require('./touch_event');
var getNodeCoords = require('./get_node_coords');
var delay = require('./delay');

/**
 * Inside `opts`:
 *
 * @param {array of 2 numbers} pos0 :
 *  px position of start of drag motion, default computed using `node` and `edge`
 * @param {DOM element} node :
 *  element to drag on, default found using `pos0`
 * @param {string} edge :
 *  combinations of 'n', 's', 'e', 'w' used to find `pos0` of `node`
 *
 * Set one of:
 * @param {array of 2 numbers} dpos :
 *  px position delta
 * @param {array of arrays of numbers} path :
 *  px position drag path
 * @param {number} nsteps :
 *  set number of steps to take between `pos0` and `pos0` + `dpos`, default is 1
 *
 * @param {boolean} touch :
 *  pass `true` to simulate touch events
 * @param {boolean} shiftKey, altKey, ctrlKey ....
 * pass `true to simulate <shift>, alt, ctrl drag (see ./mouse_event.js for more info)
 *
 * @param {function} clearThrottle :
 *  pass Lib.clearThrottle to clear throttle for all mouse/touch event
 * @param {boolean} noCover :
 *  do not wait for "drag cover" element to start "move" events
 *
 * @return {object}
 *  - {function} start
 *  - {function} end
 */
function makeFns(opts) {
    opts = opts || {};

    var pos0 = opts.pos0 || [];
    var dpos = opts.dpos || [];
    var path;

    if(Array.isArray(opts.path) && opts.path.length > 2 &&
        Array.isArray(opts.path[0]) && Array.isArray(opts.path[1])) {
        path = opts.path;
    } else {
        var nsteps = opts.nsteps || 1;
        var p0;
        path = [];

        if(isNumeric(pos0[0]) && isNumeric(pos0[1]) &&
            isNumeric(dpos[0]) && isNumeric(dpos[1])) {
            p0 = opts.pos0;
        } else if(opts.node &&
            isNumeric(dpos[0]) && isNumeric(dpos[1])) {
            var coords = getNodeCoords(opts.node, opts.edge || '');
            p0 = [coords.x, coords.y];
        } else {
            throw new Error('Cannot determine a drag path from the given options');
        }

        for(var i = 0; i <= nsteps; i++) {
            path[i] = [
                p0[0] + i * dpos[0] / nsteps,
                p0[1] + i * dpos[1] / nsteps
            ];
        }
    }

    function extendOpts(patch) {
        var out = {};
        var k;
        for(k in opts) out[k] = opts[k];
        for(k in patch) out[k] = patch[k];
        return out;
    }

    var dragCoverNode;

    function start() {
        if(opts.clearThrottle) opts.clearThrottle();

        var x0 = path[0][0];
        var y0 = path[0][1];

        var _opts = extendOpts({element: opts.node});

        if(opts.touch) {
            touchEvent('touchstart', x0, y0, _opts);
        } else {
            mouseEvent('mousemove', x0, y0, _opts);
            mouseEvent('mousedown', x0, y0, _opts);
        }

        return (opts.noCover ? Promise.resolve(opts.node) : waitForDragCover())
        .then(function(_dragCoverNode) {
            dragCoverNode = _dragCoverNode;

            var _opts = extendOpts({element: _dragCoverNode});

            path.slice(1).forEach(function(p) {
                if(opts.clearThrottle) opts.clearThrottle();
                // TODO element -> dragCoverNode
                if(opts.touch) {
                    touchEvent('touchmove', p[0], p[1], _opts);
                } else {
                    mouseEvent('mousemove', p[0], p[1], _opts);
                }
            });
        });
    }

    function end() {
        var iN = path.length - 1;
        var xN = path[iN][0];
        var yN = path[iN][1];

        var _opts = extendOpts({element: opts.noCover ? opts.node : dragCoverNode});

        if(opts.touch) {
            touchEvent('touchend', xN, yN, _opts);
        } else {
            mouseEvent('mouseup', xN, xN, _opts);
        }

        return opts.noCover || waitForDragCoverRemoval();
    }

    return {
        start: start,
        end: end
    };
}

/**
 * Inside `opts`:
 *
 * Same as in makeDragFns plus:
 *
 * @param {number} timeDelay :
 *  time delay between drag start promise resolve and drag end call
 */
function drag(opts) {
    var fns = makeFns(opts);
    var timeDelay = opts.timeDelay || 0;
    return fns.start().then(delay(timeDelay)).then(fns.end);
}

function waitForDragCover() {
    return new Promise(function(resolve) {
        var interval = 5;
        var timeout = 5000;

        var id = setInterval(function() {
            var dragCoverNode = document.querySelector('.dragcover');
            if(dragCoverNode) {
                clearInterval(id);
                resolve(dragCoverNode);
            }

            timeout -= interval;
            if(timeout < 0) {
                clearInterval(id);
                throw new Error('waitForDragCover: timeout');
            }
        }, interval);
    });
}

function waitForDragCoverRemoval() {
    return new Promise(function(resolve) {
        var interval = 5;
        var timeout = 5000;

        var id = setInterval(function() {
            var dragCoverNode = document.querySelector('.dragcover');
            if(!dragCoverNode) {
                clearInterval(id);
                resolve(dragCoverNode);
            }

            timeout -= interval;
            if(timeout < 0) {
                clearInterval(id);
                throw new Error('waitForDragCoverRemoval: timeout');
            }
        }, interval);
    });
}

module.exports = drag;
drag.makeFns = makeFns;
drag.waitForDragCover = waitForDragCover;
drag.waitForDragCoverRemoval = waitForDragCoverRemoval;
