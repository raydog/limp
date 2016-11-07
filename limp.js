var nextTick = require('next-tick');
var util = require('util');


// Exported API:
module.exports = Limp;
module.exports.LimpError = LimpError;
module.exports.EmptyRejectionError = EmptyRejectionError;


// All our assert errors are of this type:
function LimpError(message) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
}
util.inherits(LimpError, Error);


// We use this error when a promise rejects without an error:
function EmptyRejectionError(message) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
}
util.inherits(EmptyRejectionError, Error);


// Internal util to easily throw new LimpErrors in various circumstances:
function _limpAssert(cond) {
  if (cond) { return; }
  var args = Array.prototype.slice.call(arguments, 1);
  var msg = util.format.apply(util, args);
  throw new LimpError(msg);
}


function Limp() {
  var i;
  var state = {
    cur: 0,
    len: arguments.length,
    fns: arguments
  };

  _limpAssert(state.len, "Limp called without any functions!");
  for (i=0; i<state.len; i++) {
    _limpAssert(typeof state.fns[i] === "function", "Limp argument #%d is not a function.", i+1);
  }

  _asyncAdvance(state, null, [], []);
}

function _asyncAdvance(state, err, errs, data) {
  nextTick(function () {
    _handleStage(state, err, errs, data);
  });
}

function _handleStage(state, err, errs, data) {

  if (state.cur >= state.len) {
    // If this is past the final stage, but an error was passed here, just re-throw it:
    if (err) { throw err; }
    return;
  }

  var result_data = [];
  var result_errs = [];
  var result_err = null;

  var no_more = false;
  var rest_name = null; // Equal to 'this()' or 'this.rest()' if one of those was used.
  var this_called = 0;
  var cur_idx = 0;
  var returned = 0;

  Object.defineProperty(_main, "errors", { value: errs });
  Object.defineProperty(_main, "rest", { value: _rest });
  Object.defineProperty(_main, "parallel", { value: _parallel });
  Object.defineProperty(_main, "group", { value: _group });
  Object.defineProperty(_main, "await", { value: _promise });

  // Give a place for a callback to request something to be called immediately
  // after synchronous execution:
  var after_sync = [];

  // Call fn synchronously:
  var fn = state.fns[state.cur];
  var args = [ err ].concat(data);
  fn.apply(_main, args);

  // ... and don't accept any more args:
  no_more = true;
  _maybeNext();
  after_sync.forEach(function (fn) { fn(); });
  return;

  function _main(err) {
    _limpAssert(++this_called === 1, "Callback was called %d times!", this_called);
    _limpAssert(cur_idx === 0, "'this' can't be used with other callbacks.");
    rest_name = "this()";

    // Store error if we don't have one already:
    if (err && !result_err) { result_err = err; }

    var fn_results = Array.prototype.slice.call(arguments, 1);

    // Store the result no matter what:
    result_errs[0] = err;
    result_data = fn_results;

    cur_idx ++;
    returned ++;

    // ... and move on:
    _maybeNext();
  }

  function _rest() {
    _limpAssert(!no_more, "this.rest() used after current stage completed.");
    _limpAssert(!rest_name, "%s was already used in this stage.", rest_name);
    rest_name = "this.rest()";
    return _multiResultCb(cur_idx++);
  }

  function _parallel() {
    _limpAssert(!no_more, "this.parallel() used after current stage completed.");
    _limpAssert(!rest_name, "this.parallel() used after %s was used.", rest_name);
    return _singleResultCb(cur_idx++);
  }

  function _group() {
    _limpAssert(!no_more, "this.group() used after current stage completed.");
    _limpAssert(!rest_name, "this.group() used after %s was used.", rest_name);
    return _groupResultCb(cur_idx++);
  }
  function _promise(p) {
    _limpAssert(!no_more, "this.await() used after current stage completed.");
    _limpAssert(!rest_name, "this.await() used after %s was used.", rest_name);
    _limpAssert(_isPromise(p), "this.await() requires a promise to be passed in");
    var cb = _singleResultCb(cur_idx++);
    p.then(
      function onResolve(val) { cb(null, val); },
      function onReject(err) { cb(err || new EmptyRejectionError("Promise rejected without an error.")); }
    );
  }

  function _singleResultCb(idx) {
    var times_called = 0;
    return function (err, val) {
      _limpAssert(++times_called === 1, "Callback was called %d times!", times_called);

      // Store error if we don't have one already:
      if (err && !result_err) { result_err = err; }

      // Store the result no matter what:
      result_errs[idx] = err;
      result_data[idx] = val;
      returned ++;

      // ... and move on:
      _maybeNext();
    };
  }

  function _multiResultCb(idx) {
    var times_called = 0;
    return function (err) {
      _limpAssert(++times_called === 1, "Callback was called %d times!", times_called);

      // Store error if we don't have one already:
      if (err && !result_err) { result_err = err; }

      // Get ready to push all the arguments to the results:
      var fn_results = Array.prototype.slice.call(arguments, 1);
      var splice_args = [idx, 1].concat(fn_results);

      // Store the results:
      result_errs[idx] = err;
      result_data[idx] = null;
      result_data.splice.apply(result_data, splice_args);
      returned ++;

      // ... and move on:
      _maybeNext();
    };
  }

  function _groupResultCb(idx) {
    var array_counter = 0;
    var array_returned = 0;
    var array_res = [];
    var array_err = [];

    var sync_ended = false;

    // If no groups were created after sync execution, then we have this function
    // to make sure that the empty array is published:
    after_sync.push(_maybePublishArray);

    function _maybePublishArray(is_cb) {
      if (!is_cb) { sync_ended = true; }
      if (array_counter > array_returned) { return; }
      if (!sync_ended) { return; }
      result_errs[idx] = array_err;
      result_data[idx] = array_res;
      returned ++;
      _maybeNext();
    }

    return function () {
      _limpAssert(!no_more, "group() used after current stage completed.");
      var my_idx = array_counter ++;
      var times_called = 0;
      return function (err, val) {
        _limpAssert(++times_called === 1, "Callback was called %d times!", times_called);

        // Store error if we don't have one already:
        if (err && !result_err) { result_err = err; }

        // Store the results:
        array_err[my_idx] = err;
        array_res[my_idx] = val;

        array_returned ++;
        _maybePublishArray(true);
      };
    };
  }

  function _maybeNext() {
    // All async callbacks should be accounted for:
    if (!cur_idx || returned < cur_idx) { return; }

    // The stage function should have finished synchronous execution:
    if (!no_more) { return; }

    // Else, this stage is done. Increment index, and (maybe) advance:
    state.cur ++;
    _asyncAdvance(state, result_err, result_errs, result_data);
  }
}

function _isPromise(p) {
  return Boolean(p && typeof p.then === 'function');
}
