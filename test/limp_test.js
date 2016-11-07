var limp = require('../limp');
var expect = require('expect');


describe("Overall Limp behavior", function () {

  it("rejects no args", function () {
    expect(function () {
      limp();
    }).toThrow(/called without any functions/i);
  });

  it("rejects non-function args", function () {
    expect(function () {
      limp(
        function () {},
        123,
        function () {}
      );
    }).toThrow(/#2 is not a function/i);
  });

  it("returned values are not passed along", function (done) {
    limp(
      function () {
        return 42;
      },
      function () {
        done(new Error("Next stage entered"));
      }
    );
    _delay(15, done, []);
  });

  it("handles long pipelines safely", function (done) {
    this.slow(200);

    var inside = false;
    var first = true;
    function _step(err, val) {
      if (err) { return done(err); }

      expect(inside).toBe(false);
      if (!first) { expect(val).toBe("foo"); }

      first = false;
      inside = true;

      this.parallel()(null, "foo");
      inside = false;
    }
    var args = [];
    for (var i=0; i<6000; i++) {
      args.push(_step);
    }
    args.push(done);

    limp.apply(null, args);
  });

  it("works with stupid numbers of crazy groups", function (done) {
    this.slow(200);

    limp(
      function () {
        var group = this.group();
        for (var i=0; i<5000; i++) {
          // Distribute cb times between 0ms and 50ms. Also, 0ms == called sync.
          var rnd = Math.floor(Math.random() * 50);
          if (rnd) {
            setTimeout(group().bind(null, null, "lol-" + i), rnd);
          } else {
            group()(null, "lol-" + i);
          }
        }
      },
      function (err, res) {
        if (err) { return done(err); }

        expect(res).toBeAn(Array);
        expect(res.length).toBe(5000);
        for(var i=0; i<res.length; i++) {
          expect(res[i]).toBe("lol-" + i);
        }

        done();
      }
    );
  });

  it("steps wait for all cbs even during error", function (done) {
    this.slow(200);

    var start;
    limp(
      function () {
        start = Date.now();
        setTimeout(this.parallel().bind(null, new Error("blah")), 0);
        setTimeout(this.parallel().bind(null, null, "foobar"), 50);
      },
      function (err, a, b) {
        expect(err).toExist();
        expect(err.message).toBe("blah");
        expect(a).toBe(undefined);
        expect(b).toBe("foobar");
        expect(Date.now() - start).toBeGreaterThan(30);
        done();
      }
    );
  });

  it("thrown errors are the correct type", function (done) {
    limp(
      function () {
        var cb = this.parallel();
        cb();
        try {
          cb();
        } catch (ex) {
          expect(ex).toBeAn(Error);
          expect(ex).toBeA(limp.LimpError);
        }
        done();
      }
    );
  });

  it("alright with nested calls", function (done) {
    limp(
      function () {
        var next = this.parallel();
        limp(
          function () {
            setTimeout(this.bind(null, null, "foo"), 10);
          },
          function (err, a) {
            if (err) { return done(err); }
            expect(a).toBe("foo");
            next(null, "bar");
          }
        );
      },
      function (err, b) {
        if (err) { return done(err); }
        expect(b).toBe("bar");
        done();
      }
    );
  });

  it("alright with parallel calls", function (done) {
    limp(
      function () {
        var past_first = false;

        var cb_a = this.parallel();
        limp(
          function () {
            expect(past_first).toBe(false);
            setTimeout(this.bind(null, null, "lol"), 10);
          },
          function (err, a) {
            if (err) { return done(err); }
            past_first = true;
            expect(a).toBe("lol");
            cb_a(null, "123");
          }
        );

        var cb_b = this.parallel();
        limp(
          function () {
            expect(past_first).toBe(false);
            setTimeout(this.bind(null, null, "blah"), 10);
          },
          function (err, a) {
            if (err) { return done(err); }
            past_first = true;
            expect(a).toBe("blah");
            cb_b(null, "456");
          }
        );

      },
      function (err, a, b) {
        if (err) { return done(err); }
        expect(a).toBe("123");
        expect(b).toBe("456");
        done();
      }
    );
  });

  describe("error handling", function () {

    var mocha_handler;
    before(function () {
      mocha_handler = process.listeners('uncaughtException').shift();
      process.removeListener('uncaughtException', mocha_handler);
    });

    after(function () {
      process.on('uncaughtException', mocha_handler);
    });

    it("leaves thrown exceptions alone", function (done) {

      process.once('uncaughtException', function (err) {
        expect(err).toExist();
        expect(err.message).toBe("Derp");
        done();
      });

      limp(
        function () {
          throw new Error("Derp");
        },
        function () {
          done(new Error("Limp passed along an exception!"));
        }
      );
    });

    it("throws callback errors after final stage", function (done) {
      process.once('uncaughtException', function (err) {
        expect(err).toExist();
        expect(err.message).toBe("Derp");
        done();
      });

      limp(
        function () {
          this(new Error("Derp"));
        }
      );
    });
  });
});

function _delay(ms, fn, args) {
  setTimeout(function () { fn.apply(null, args); }, ms);
}
