var nextTick = require('next-tick');
var expect = require('expect');
var limp = require('../limp');


describe("this.group()", function () {
  describe("is fine with", function () {
    it("no results", function (done) {
      limp(
        function () {
          this.group();
        },
        function (err, a) {
          if (err) { return done(err); }
          expect(a).toEqual([]);
          done();
        }
      );
    });

    it("one result", function (done) {
      limp(
        function () {
          var g = this.group();
          g()(null, "hello");
        },
        function (err, a) {
          if (err) { return done(err); }
          expect(a).toEqual(["hello"]);
          done();
        }
      );
    });

    it("many results", function (done) {
      limp(
        function () {
          var g = this.group();
          g()(null, "foo");
          _async(10, g(), null, "bar");
          _async(5,  g(), null, "lol");
          _async(15, g(), null, "hello");
          g()(null, 123);
        },
        function (err, a) {
          if (err) { return done(err); }
          expect(a).toEqual(["foo", "bar", "lol", "hello", 123]);
          done();
        }
      );
    });


    it("several groups", function (done) {
      limp(
        function () {
          var g1 = this.group();
          var g2 = this.group();
          _async(10, g1(), null, "HELLO");
          _async(15, g2(), null, "foo");
          _async(5, g1(), null, "WORLD");
          _async(10, g2(), null, "bar");
        },
        function (err, a, b) {
          if (err) { return done(err); }
          expect(a).toEqual(["HELLO", "WORLD"]);
          expect(b).toEqual(["foo", "bar"]);
          done();
        }
      );
    });

    it("one error", function (done) {
      limp(
        function () {
          var g = this.group();
          _async(10, g(), null, "HELLO");
          _async(15, g(), new Error("oh noes"));
        },
        function (err, a) {
          expect(err).toExist();
          expect(err.message).toBe("oh noes");
          expect(a).toEqual(["HELLO", undefined]);
          done();
        }
      );
    });

    it("several errors", function (done) {
      limp(
        function () {
          var g = this.group();
          _async(10, g(), new Error("a problem"));
          _async(15, g(), new Error("and another"));
        },
        function (err, a) {
          expect(err).toExist();
          expect(err.message).toBe("a problem");
          expect(a).toEqual([undefined, undefined]);

          expect(this.errors[0][0]).toExist();
          expect(this.errors[0][1]).toExist();
          expect(this.errors[0][0].message).toBe("a problem");
          expect(this.errors[0][1].message).toBe("and another");

          done();
        }
      );
    });

    it("mixing groups with others", function (done) {
      limp(
        function () {
          this.parallel()(null, "hi");
          var g = this.group();
          g()(null, "lol");
          this.rest()(null, "a", "b", "c");
          g()(null, "whatever");
        },
        function (err, a, b, c, d, e) {
          if (err) { return done(err); }
          expect(a).toEqual("hi");
          expect(b).toEqual(["lol", "whatever"]);
          expect(c).toEqual("a");
          expect(d).toEqual("b");
          expect(e).toEqual("c");
          done();
        }
      );
    });
  });

  describe("will reject", function () {
    it("new group after step", function (done) {
      limp(
        function () {
          var self = this;
          var g = self.group()();
          setTimeout(function () {
            expect(function () {
              self.group();
            }).toThrow(/after current step/i);
            done();
          }, 10);
        }
      );
    });

    it("new group item after step", function (done) {
      limp(
        function () {
          var self = this;
          var g = self.group();
          g();
          setTimeout(function () {
            expect(function () {
              g();
            }).toThrow(/after current step/i);
            done();
          }, 10);
        }
      );
    });

    it("new group item rest used", function (done) {
      limp(
        function () {
          var self = this;
          self.rest();
          expect(function () {
            self.group();
          }).toThrow(/used after this\.rest/i);
          done();
        }
      );
    });

    it("callbacks called multiple times", function (done) {
      limp(
        function () {
          this.group()();
          var cb = this.group()();
          cb(null, "hello");
          expect(function () {
            cb(null, "ruh-roh");
          }).toThrow(/called 2 times/i);
          done();
        }
      );
    });
  });
});

function _async(ms, fn, err, res) {
  setTimeout(function () { fn(err, res); }, ms);
}
