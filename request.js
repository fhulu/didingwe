class Request {
  constructor(request, result) {
    this.request = request;
    this.result = result;
  }

  process() {
    var me = this;
    return new Promise(resolve, reject) {
      me.resolve = resolve;
      me.reject = reject;
    }
  }
}


module.exports = Client;
