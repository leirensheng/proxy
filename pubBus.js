class PubSub {
  constructor() {
    // 缓存队列
    this._events = {};
  }

  // 注册
  on(event, callback) {
    if (this._events[event]) {
      this._events[event].push(callback);
    } else {
      this._events[event] = [callback];
    }
  }
  off(event) {
    this._events[event] = [];
  }

  once(event, callback) {
    let newFn = (...args) => {
      callback(...args);
      this._events[event] = [];
    };
    if (this._events[event]) {
      this._events[event].push(newFn);
    } else {
      this._events[event] = [newFn];
    }
  }

  // 发布
  emit(event, ...args) {
    const items = this._events[event];
    if (items && items.length) {
      items.forEach(function (callback) {
        callback.call(this, ...args);
      });
    }
  }
}

module.exports = PubSub;
