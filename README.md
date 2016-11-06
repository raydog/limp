# Limp

Limp is a simple asynchronous control-flow library. It is meant to be a mostly drop-in replacement for the [step](https://github.com/creationix/step) library, and so has a very similar API. Why use it instead of step? While step is a useful library, Limp improves upon it in several ways.

- Limp removes the synchronous behaviors. This is important, because accidentally returning a value in step was an easy way to accidentally advance to the next stage when asynchronous tasks were still running.

- Limp throws exceptions when used incorrectly. This makes debugging incorrect usage of the library easier. Step would often keep running, but with hard-to-predict behaviors.

- Adds several new features, such as `this.await()` for promise support, and `this.rest()` for multi-argument support in combination with other callback types.

## Overview

The idea of Limp is that code is organized in 'stages', which are just functions. We advance from a stage when all callbacks (created by Limp) have been called. Values are then assembled, and passed to the next stage.

```javascript
var limp = require('limp');

function getUsers(cb) {
  limp(
    function () {
      db.getCacheConnection(this.parallel());
      db.getAllUserIds(this.parallel());
    },
    function (err, cache_conn, user_ids) {
      if (err) { return cb(err); }
      var group = this.group();
      user_ids.forEach(function (id) {
        cache_conn.fetchUser(id, group());
      });
    },
    function (err, users_array) {
      if (err) { return cb(err); }
      cb(null, users_array);
    }
  );
}
```

## Features

Features are provided through the `this` variable, which is injected into each stage function. Limp gives you callbacks with many different useful behaviors.

### `this`

The `this` variable is a function that can be used as a callback for simple cases. It will pass all arguments it receives into the next stage. You shouldn't use `this` as a callback with any of the other callback types. Try using `this.rest()` if you'd like that kind of behavior.

```javascript
limp(
  function () {
    someHttpService.request("/example", this);
  },
  function (err, response, body, buffer) {
    // ^^ Notice how all arguments given to the callback were passed into this stage.
  }
);
```

### `this.parallel()`

The `this.parallel()` method will manufacture a new callback for you to use. Each one of these callbacks will take both the error and the first argument that it is called with, and pass them to the next stage. Multiple `this.parallel()` callbacks can be created, and each one will remember its placement relative to the others.

```javascript
limp(
  function () {
    myDatabase.get("User", 123, this.parallel());
    fs.readFile("/opt/limp/README.md", this.parallel());
  },
  function (err, user_object, readme_contents) {
    // ^^ Each this.parallel() callback gets one argument in the next stage.
  }
);
```

### `this.group()`

The `this.group()` method will create a factory function, that will itself produce new callbacks for you to use. Each callback created by a single `this.group()` function will be passed to the next stage in an array.

```javascript
limp(
  function () {
    var group_a = this.group();
    all_user_ids.forEach(function (id) {
      myDatabase.get("User", id, group_a());
    });

    var group_b = this.group();
    url_list.forEach(function (url) {
      someHTTPService.post(url, group_b());
    });
  },
  function (err, users_array, http_responses) {
    // ^^ The users_array is in the same order as the ids in all_user_ids.
    //    SO is the http_responses array. Notice how they weren't mixed, because
    //    we created 2 groups.
  }
);
```

### `this.await(p)`

The `this.await(p)` method waits for a promise. If it resolves to a value, that value is passed along to the next stage. If it rejects, that value will be passed along as an error. This lets you easily merge promises into callback logic.

```javascript
limp(
  function () {
    this.await(cacheDatabase.fetchUserPromise());
    this.await(cacheDatabase.fetchThingPromise());
  },
  function (err, user, thing) {
    // ^^ this.await() behaves similarly to this.parallel(), but with promises.
  }
);
```

### `this.rest()`

The `this.rest()` method will create a callback that takes all arguments passed to it, and passes them to the next stage at the end of the argument list. This lets you mix the multi-argument behavior of the `this` callback with other callback types. A `this.rest()` callback should the last callback used in that stage.

```javascript
limp(
  function () {
    fs.readFile("/home/user/blah.json", this.parallel());
    someHttpService.request("/something", this.rest());
  },
  function (err, blah_file, http_response, http_body, http_buffer) {
    // ^^ All the arguments passed to the this.rest() callback were pushed to
    //    the end of the argument list.
  }
);
```

### `this.errors`

When a callback receives an error, that error is passed to the following stage as the first argument. If multiple callbacks error out, only the first one is passed as the first argument. If you want to see all errors, those are available in the `this.errors` array. This array has the same ordering as the arguments.

```javascript
limp(
  function () {
    db.getUserObject(user_id, this.parallel()); // Errors in 5ms
    db.getTaskObject(task_id, this.parallel()); // Errors in 10ms
    db.getLikeObject(like_id, this.parallel()); // Returns successfully
  },
  function (err, user_obj, task_obj, like_obj) {
    // `err` is the user_obj error, since it came back first.
    // `this.errors` is [ user_err, task_err, null ].
  }
);
```
