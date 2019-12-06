// @flow strict

const SYMBOL = typeof Symbol === 'function' ? Symbol : undefined;
const SYMBOL_ITERATOR = SYMBOL && SYMBOL.iterator;
const SYMBOL_ASYNC_ITERATOR = SYMBOL && SYMBOL.asyncIterator;

function AsyncFromSyncIterator(iterator) {
  this._i = iterator;
}

AsyncFromSyncIterator.prototype[$$asyncIterator] = function() {
  return this;
};

AsyncFromSyncIterator.prototype.next = function() {
  const step = this._i.next();
  return Promise.resolve(step.value).then(value => ({
    value,
    done: step.done,
  }));
};

function ArrayLikeIterator(obj) {
  this._o = obj;
  this._i = 0;
}

ArrayLikeIterator.prototype[$$iterator] = function() {
  return this;
};

ArrayLikeIterator.prototype.next = function() {
  if (this._o === undefined || this._i >= this._o.length) {
    this._o = undefined;
    return { value: undefined, done: true };
  }
  return { value: this._o[this._i++], done: false };
};

export const $$iterator = SYMBOL_ITERATOR || '@@iterator';

export function isIterable(obj) {
  return Boolean(getIteratorMethod(obj));
}

export function isArrayLike(obj) {
  const length = obj != null && obj.length;
  return typeof length === 'number' && length >= 0 && length % 1 === 0;
}

export function isCollection(obj) {
  return Object(obj) === obj && (isArrayLike(obj) || isIterable(obj));
}

export function getIterator(iterable) {
  const method = getIteratorMethod(iterable);
  if (method) {
    return method.call(iterable);
  }
}

export function getIteratorMethod(iterable) {
  if (iterable != null) {
    const method =
      (SYMBOL_ITERATOR && iterable[SYMBOL_ITERATOR]) || iterable['@@iterator'];
    if (typeof method === 'function') {
      return method;
    }
  }
}

export function createIterator(collection) {
  if (collection != null) {
    const iterator = getIterator(collection);
    if (iterator) {
      return iterator;
    }
    if (isArrayLike(collection)) {
      return new ArrayLikeIterator(collection);
    }
  }
}

export function forEach(collection, callback, thisArg) {
  if (collection != null) {
    if (typeof collection.forEach === 'function') {
      return collection.forEach(callback, thisArg);
    }
    let i = 0;
    const iterator = getIterator(collection);
    if (iterator) {
      let step;
      while (!(step = iterator.next()).done) {
        callback.call(thisArg, step.value, i++, collection);
        if (i > 9999999) {
          throw new TypeError('Near-infinite iteration.');
        }
      }
    } else if (isArrayLike(collection)) {
      for (; i < collection.length; i++) {
        if (Object.prototype.hasOwnProperty.call(collection, i)) {
          callback.call(thisArg, collection[i], i, collection);
        }
      }
    }
  }
}

export const $$asyncIterator = SYMBOL_ASYNC_ITERATOR || '@@asyncIterator';

export const isAsyncIterable = obj => Boolean(getAsyncIteratorMethod(obj));

export const getAsyncIterator = asyncIterable => {
  const method = getAsyncIteratorMethod(asyncIterable);
  if (method) {
    return method.call(asyncIterable);
  }
};

export const getAsyncIteratorMethod = asyncIterable => {
  if (asyncIterable != null) {
    const method =
      (SYMBOL_ASYNC_ITERATOR && asyncIterable[SYMBOL_ASYNC_ITERATOR]) ||
      asyncIterable['@@asyncIterator'];
    if (typeof method === 'function') {
      return method;
    }
  }
};

export const createAsyncIterator = source => {
  if (source != null) {
    const asyncIterator = getAsyncIterator(source);
    if (asyncIterator) {
      return asyncIterator;
    }
    const iterator = createIterator(source);
    if (iterator) {
      return new AsyncFromSyncIterator(iterator);
    }
  }
};

export const forAwaitEach = (source, callback, thisArg) => {
  const asyncIterator = createAsyncIterator(source);
  if (asyncIterator) {
    let i = 0;
    return new Promise((resolve, reject) => {
      function next() {
        asyncIterator
          .next()
          .then(step => {
            if (!step.done) {
              Promise.resolve(callback.call(thisArg, step.value, i++, source))
                .then(next)
                .catch(reject);
            } else {
              resolve();
            }
            return null;
          })
          .catch(reject);
        return null;
      }
      next();
    });
  }
};
