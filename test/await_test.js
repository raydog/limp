var expect = require('expect');
var limp = require('../limp');
require('setimmediate');


describe("this.await()", function () {
  var libs = [
    { name: "Promisejs.org Promises", promise: require('promise') },
    { name: "ES6 Promises", promise: require('es6-promise').Promise },
    { name: "Q Promises", promise: require('q').Promise },
    { name: "Bluebird Promises", promise: require('bluebird').Promise },
    { name: "RSVP Promises", promise: require('rsvp').Promise },
    { name: "Mongoose Promises", promise: require('mpromise') },
  ];

  libs.forEach(function (obj) {
    var PromiseLib = obj.promise;

    // These abstractions are needed because Mongoose Promises are both heavily
    // used, and follow a different API from the other libraries:

    function _makeResolved(val) {
      if (PromiseLib.resolve)   { return PromiseLib.resolve(val); }
      if (PromiseLib.fulfilled) { return PromiseLib.fulfilled(val); }
      throw new Error("Can't create promise");
    }

    function _makeRejected(err) {
      if (PromiseLib.reject)   { return PromiseLib.reject(err); }
      if (PromiseLib.rejected) { return PromiseLib.rejected(err); }
      throw new Error("Can't create promise");
    }

    function _makePromise(fn) {
      if (PromiseLib.prototype.fulfill) {
        // Hack to support Mongoose promises:
        var P = new PromiseLib();
        setImmediate(fn.bind(null, P.fulfill.bind(P), P.reject.bind(P)));
        return P;
      }
      return new PromiseLib(fn);
    }

    describe("when using " + obj.name, function () {
      it("can pass along a resolve", function (done) {
        limp(
          function () {
            this.await(_makeResolved("foo"));
            this.await(_makePromise(function (resolve) {
              setTimeout(function () {
                resolve("bar");
              }, 10);
            }));
          },
          function (err, a, b) {
            if (err) { return done(err); }
            expect(a).toBe("foo");
            expect(b).toBe("bar");
            done();
          }
        );
      });

      it("can pass along a reject", function (done) {
        limp(
          function () {
            this.await(_makeResolved("foo"));
            this.await(_makePromise(function (resolve, reject) {
              setTimeout(function () {
                reject(new Error("bar"));
              }, 10);
            }));
            this.await(_makeRejected(new Error("blah")));
          },
          function (err, a, b, c) {
            expect(err).toExist();
            expect(err.message).toBe("blah");

            expect(a).toBe("foo");
            expect(b).toBe(undefined);
            expect(c).toBe(undefined);

            expect(this.errors[0]).toNotExist();
            expect(this.errors[1]).toExist();
            expect(this.errors[1].message).toBe("bar");
            expect(this.errors[2]).toExist();
            expect(this.errors[2].message).toBe("blah");
            done();
          }
        );
      });

      it("makes sure that an empty rejection has SOMETHING passed along", function (done) {
        limp(
          function () {
            this.await(_makeResolved("whatever"));
            this.await(_makePromise(function (resolve, reject) {
              setTimeout(function () {
                reject();
              }, 10);
            }));
          },
          function (err, a, b) {
            expect(err).toExist();
            expect(err).toBeAn(Error);
            expect(err).toBeA(limp.EmptyRejectionError);
            expect(err.message).toMatch(/rejected without an error/i);

            expect(a).toBe("whatever");
            expect(b).toBe(undefined);

            done();
          }
        );
      });

      it("rejects a cb created after the stage", function (done) {
        limp(
          function () {
            var self = this;

            self.await(_makePromise(function () {}));

            setTimeout(function () {
              expect(function () {
                self.await(_makeResolved());
              }).toThrow(/after current stage/i);
              done();
            }, 10);
          }
        );
      });

      it("rejects non-promises", function (done) {
        limp(
          function () {
            var self = this;
            expect(function () {
              self.await("nope");
            }).toThrow(/requires a promise/i);
            done();
          }
        );
      });

      it("rejects use after a this.rest()", function (done) {
        limp(
          function () {
            var self = this;
            self.rest();

            expect(function () {
              self.await(_makeResolved());
            }).toThrow(/used after this\.rest\(\)/i);

            done();
          }
        );
      });
    });
  });
});
