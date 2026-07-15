(function registerPromiseWithResolversPolyfill() {
  if (typeof Promise.withResolvers === 'function') {
    window.__MIO_PROMISE_WITH_RESOLVERS__ = 'native';
    return;
  }

  Object.defineProperty(Promise, 'withResolvers', {
    configurable: true,
    writable: true,
    value: function withResolvers() {
      let resolve;
      let reject;

      const promise = new this((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
      });

      return {
        promise,
        resolve,
        reject,
      };
    },
  });

  window.__MIO_PROMISE_WITH_RESOLVERS__ = 'polyfilled';
})();
