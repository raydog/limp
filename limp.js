var nextTick = require('next-tick');
var util = require('util');


// Exported API:
module.exports = Limp;
module.exports.LimpError = LimpError;


// Any error we return is an instance of this:
function LimpError(message) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
};
util.inherits(LimpError, Error);


// Internal util to easily throw new LimpErrors in various circumstances:
function _limpAssert(cond) {
  if (cond) { return; }
  var args = Array.prototype.slice.call(arguments, 1);
  var msg = util.format.apply(util, args);
  throw new LimpError(msg);
}


function Limp() {
  var state = {
    cur: 0,
    len: arguments.length,
    fns: arguments
  };
  _asyncAdvance(state, null, [], []);
}

function _asyncAdvance(state, err, errs, data) {
  nextTick(function () {
    _handleStep(state, err, errs, data);
  });
}

function _handleStep(state, err, errs, data) {

  var result_data = [];
  var result_errs = [];
  var result_err = null;

  var no_more = false;
  var rest_used = false;
  var cur_idx = 0;
  var returned = 0;

  Object.defineProperty(_main, "errors", { value: errs });
  Object.defineProperty(_main, "rest", { value: _rest });
  Object.defineProperty(_main, "parallel", { value: _parallel });
  Object.defineProperty(_main, "group", { value: _group });
  Object.defineProperty(_main, "await", { value: _promise });

  // Call fn synchronously:
  var fn = state.fns[state.cur];
  var args = [ err ].concat(data);

  fn.apply(_main, args);

  // ... and don't accept any more args:
  no_more = true;
  return _maybeNext();

  function _main(err) {
    _limpAssert(false, "TODO: main");
  }

  function _rest() {
    _limpAssert(!no_more, "this.rest() used after current step completed.");
    _limpAssert(!rest_used, "this.rest() was already used in this step.");
    rest_used = true;
    return _multiResultCb(cur_idx++);
  }

  function _parallel() {
    _limpAssert(!no_more, "this.parallel() used after current step completed.");
    _limpAssert(!rest_used, "this.parallel() used after this.rest() was used.");
    return _singleResultCb(cur_idx++);
  }

  function _group() {
    _limpAssert(false, "TODO: group");
  }
  function _promise(p) {
    _limpAssert(!no_more, "this.await() used after current step completed.");
    _limpAssert(!rest_used, "this.await() used after this.rest() was used.");
    _limpAssert(_isPromise(p), "this.await() requires a promise to be passed in");
    var cb = _singleResultCb(cur_idx++);
    p.then(
      function onResolve(val) { cb(null, val); },
      function onReject(err) { cb(err); }
    );
  }

  function _singleResultCb(idx) {
    var times_called = 0;
    return function (err, val) {
      _limpAssert(++times_called === 1, "Callback was called " + times_called + " times!");

      // Store error if we don't have one already:
      if (err && !result_err) { result_err = err; }

      // Store the result no matter what:
      result_errs[idx] = err;
      result_data[idx] = val;
      returned ++;

      // ... and move on:
      _maybeNext();
    }
  }

  function _multiResultCb(idx) {
    var times_called = 0;
    return function (err) {
      _limpAssert(++times_called === 1, "Callback was called " + times_called + " times!");

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
    }
  }

  // function _arrayResultCb(idx) {
  //   var times_called = 0;
  //   var array_data = [];
  //   var array_errs = [];
  //   return function () {
  //     function (err, val) {
  //       _limpAssert(++times_called === 1, "Callback was called " + times_called + " times!");

  //       // Store error if we don't have one already:
  //       if (err && !result_err) { result_err = err; }

  //       // Store the result no matter what:
  //       result_errs[idx] = err;
  //       result_data[idx] = val;
  //       returned ++;

  //       // ... and move on:
  //       _maybeNext();
  //     }
  //   };
  // }

  function _maybeNext() {
    // All async callbacks should be accounted for:
    if (returned < cur_idx) { return; }

    // The step function should have finished synchronous execution:
    if (!no_more) { return; }

    // Else, this step is done. Increment index, and (maybe) advance:
    state.cur ++;
    if (state.cur < state.len) {
      _asyncAdvance(state, result_err, result_errs, result_data);
    }
  }
}

function _isPromise(p) {
  return Boolean(p && typeof p.then === 'function');
}
