var expect = require('expect');
var limp = require('../limp');
var PromiseLib = require('bluebird').Promise;


describe("this.rest()", function () {
  describe("is fine with", function () {
    it("no args", function (done) {
      limp(
        function () {
          this.rest()();
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
          var cb = this.rest();
          setTimeout(function () {
            cb(null, 42);
          }, 10);
        },
        function (err, a) {
          if (err) { return done(err); }
          expect(arguments.length).toBe(2);
          expect(a).toBe(42);
          done();
        }
      );
    });

    it("many args", function (done) {
      limp(
        function () {
          var cb = this.rest();
          setTimeout(function () {
            cb(null, 3.14159, null, "foobar", function () {});
          }, 15);
        },
        function (err, a, b, c, d) {
          if (err) { return done(err); }
          expect(arguments.length).toBe(5);
          expect(a).toBe(3.14159);
          expect(b).toBe(null);
          expect(c).toBe("foobar");
          expect(d).toBeInstanceOf(Function);
          done();
        }
      );
    });

    it("mixing with others", function (done) {
      limp(
        function () {
          this.parallel()(null);
          this.await(PromiseLib.resolve(42));
          var cb = this.rest();
          setTimeout(function () {
            cb(null, "hello", "world", "foobar");
          }, 15);
        },
        function (err, a, b, c, d, e) {
          if (err) { return done(err); }
          expect(arguments.length).toBe(6);
          expect(a).toBe(undefined);
          expect(b).toBe(42);
          expect(c).toBe("hello");
          expect(d).toBe("world");
          expect(e).toBe("foobar");
          done();
        }
      );
    });

    it("works with errors", function (done) {
      limp(
        function () {
          var cb = this.rest();
          setTimeout(function () {
            cb(new Error("ruh-roh"));
          }, 15);
        },
        function (err) {
          expect(arguments.length).toBe(1);
          expect(err).toBeTruthy();
          expect(err.message).toBe("ruh-roh");
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
          self.rest();

          expect(function () {
            self.rest();
          }).toThrow(/was already used/i);

          done();
        }
      );
    });

    it("calling after stage", function (done) {
      limp(
        function () {
          var self = this;
          self.parallel();
          setTimeout(function () {
            expect(function () {
              self.rest();
            }).toThrow(/after current stage/i);
            done();
          }, 10);
        }
      );
    });
  });
});
