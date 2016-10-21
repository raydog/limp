var limp = require('../limp');
var expect = require('expect');


describe("this.parallel()", function () {
  describe("is fine with", function () {
    it("2 sync", function (done) {
      limp(
        function () {
          this.parallel()(null, "foo");
          this.parallel()(null, "bar");
        },
        function (err, a, b) {
          if (err) { return done(err); }
          expect(a).toBe("foo");
          expect(b).toBe("bar");
          done();
        }
      );
    });

    it("2 async", function (done) {
      limp(
        function () {
          _delay(10, "foo", this.parallel());
          _delay(15, "bar", this.parallel());
        },
        function (err, a, b) {
          if (err) { return done(err); }
          expect(a).toBe("foo");
          expect(b).toBe("bar");
          done();
        }
      );
    });

    it("a sync then an async", function (done) {
      limp(
        function () {
          this.parallel()(null, "foo");
          _delay(15, "bar", this.parallel());
        },
        function (err, a, b) {
          if (err) { return done(err); }
          expect(a).toBe("foo");
          expect(b).toBe("bar");
          done();
        }
      );
    });

    it("an async then a sync", function (done) {
      limp(
        function () {
          _delay(10, { derp: "hi" }, this.parallel());
          this.parallel()(null, 3.14159);
        },
        function (err, a, b) {
          if (err) { return done(err); }
          expect(a).toEqual({ derp: "hi" });
          expect(b).toEqual(3.14159);
          done();
        }
      );
    });

    it("crazy timings", function (done) {
      limp(
        function () {
          _delay(10, 1, this.parallel());
          this.parallel()(null, 2);
          _delay(15, 3, this.parallel());
          this.parallel()(null, 4);
          _delay(0, 5, this.parallel());
          _delay(5, 6, this.parallel());
          this.parallel()(null, 7);
        },
        function (err, a, b, c, d, e, f, g) {
          if (err) { return done(err); }
          expect(a).toBe(1);
          expect(b).toBe(2);
          expect(c).toBe(3);
          expect(d).toBe(4);
          expect(e).toBe(5);
          expect(f).toBe(6);
          expect(g).toBe(7);
          done();
        }
      );
    });

    it("odd arguments", function (done) {
      limp(
        function () {
          this.parallel()(null, 1);
          this.parallel()();
          this.parallel()(null, 2);
        },
        function (err, a, b, c) {
          if (err) { return done(err); }
          expect(a).toBe(1);
          expect(b).toBe(undefined);
          expect(c).toBe(2);
          done();
        }
      );
    });

    it("single errors", function (done) {
      limp(
        function () {
          this.parallel()(null, "hello");
          this.parallel()(new Error("blah"));
        },
        function (err, a, b) {
          expect(err).toExist();
          expect(err.message).toBe("blah");

          expect(a).toBe("hello");
          expect(b).toBe(undefined);

          expect(this.errors[0]).toNotExist();
          expect(this.errors[1]).toExist();
          expect(this.errors[1].message).toBe("blah");

          done();
        }
      );
    });

    it("multi errors", function (done) {
      limp(
        function () {
          this.parallel()(new Error("derp"));
          this.parallel()(new Error("blah"));
        },
        function (err, a, b) {
          expect(err).toExist();
          expect(err.message).toBe("derp");

          expect(a).toBe(undefined);
          expect(b).toBe(undefined);

          expect(this.errors[0]).toExist();
          expect(this.errors[0].message).toBe("derp");
          expect(this.errors[1]).toExist();
          expect(this.errors[1].message).toBe("blah");

          done();
        }
      );
    });
  });

  describe("will reject", function () {
    it("a cb called twice", function (done) {
      limp(
        function () {
          var cb = this.parallel();
          cb();

          expect(function () {
            cb();
          }).toThrow(/called 2 times/i);

          done();
        }
      );
    });

    it("a cb created after the step", function (done) {
      limp(
        function () {
          var self = this;
          self.parallel();
          setTimeout(function () {
            expect(function () {
              self.parallel();
            }).toThrow(/after current step/i);
            done();
          }, 10);
        }
      );
    });

    it("use after a this.rest()", function (done) {
      limp(
        function () {
          var self = this;
          self.rest();

          expect(function () {
            self.parallel();
          }).toThrow(/used after this\.rest\(\)/i);

          done();
        }
      );
    });
  });

  describe("handles exceptions", function () {

    var mocha_handler;
    before(function () {
      mocha_handler = process.listeners('uncaughtException').shift();
      process.removeListener('uncaughtException', mocha_handler);
    });

    after(function () {
      process.on('uncaughtException', mocha_handler);
    });

    it("by NOT passing them along", function (done) {

      process.once('uncaughtException', function (err) {
        expect(err).toExist();
        expect(err.message).toBe("Derp");
        done();
      });

      limp(
        function () {
          throw new Error("Derp");
        },
        function (err) {
          done(new Error("Limp passed along an exception!"));
        }
      );
    });
  });

  describe("handles values returned", function () {
    it("by not passing them along", function (done) {
      limp(
        function () {
          return 42;
        },
        function (err, a) {
          expect(err).toNotExist();
          expect(a).toNotExist();
          done();
        }
      );
    });
  });
});

function _delay(ms, data, cb) {
  setTimeout(function () {
    cb(null, data);
  }, ms);
}
