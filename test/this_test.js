var expect = require('expect');
var limp = require('../limp');


describe("this()", function () {
  describe("is fine with", function () {
    it("no args", function (done) {
      limp(
        function () {
          this(null);
        },
        function (err) {
          if (err) { return done(err); }
          expect(arguments.length).toBe(1);
          done();
        }
      );
    });

    it("one arg", function (done) {
      limp(
        function () {
          this(null, "foo");
        },
        function (err, a) {
          if (err) { return done(err); }
          expect(a).toBe("foo");
          done();
        }
      );
    });

    it("one async arg", function (done) {
      limp(
        function () {
          _delay(10, this, [null, "hello"]);
        },
        function (err, a) {
          if (err) { return done(err); }
          expect(a).toBe("hello");
          done();
        }
      );
    });

    it("many args", function (done) {
      limp(
        function () {
          this(null, "derp", 1234, { oh: "hi" });
        },
        function (err, a, b, c) {
          if (err) { return done(err); }
          expect(a).toBe("derp");
          expect(b).toBe(1234);
          expect(c).toEqual({ oh: "hi" });
          done();
        }
      );
    });

    it("many async args", function (done) {
      limp(
        function () {
          _delay(10, this, [null, "derp", 1234, { oh: "hi" }]);
        },
        function (err, a, b, c) {
          if (err) { return done(err); }
          expect(a).toBe("derp");
          expect(b).toBe(1234);
          expect(c).toEqual({ oh: "hi" });
          done();
        }
      );
    });

    it("works with errors", function (done) {
      limp(
        function () {
          this(new Error("oh noes"));
        },
        function (err) {
          expect(err).toExist();
          expect(err.message).toBe("oh noes");
          done();
        }
      );
    });

    it("works with async errors", function (done) {
      limp(
        function () {
          _delay(10, this, [ new Error("ruh roh") ]);
        },
        function (err) {
          expect(err).toExist();
          expect(err.message).toBe("ruh roh");
          done();
        }
      );
    });
  });

  describe("will reject", function () {
    it("calling multiple times", function (done) {
      limp(
        function () {
          var self = this;
          self(null, "a");
          expect(function () {
            self(null, "b");
          }).toThrow(/called 2 times/i);
          done();
        }
      );
    });

    it("use after other callbacks", function (done) {
      limp(
        function () {
          var self = this;
          self.parallel();
          expect(function () {
            self(null, "hello");
          }).toThrow(/can't be used with other callbacks/i);
          done();
        }
      );
    });

    it("use before other callbacks", function (done) {
      limp(
        function () {
          var self = this;
          self(null, "blah");
          expect(function () {
            self.parallel();
          }).toThrow(/used after this\(\)/i);
          done();
        }
      );
    });
  });
});

function _delay(ms, fn, vals) {
  setTimeout(function () { fn.apply(null, vals); }, ms);
}
