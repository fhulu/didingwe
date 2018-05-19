const header_items = [ 'user-agent', 'host', 'accept']

class Post {
  constructor(handler) {
    this.handler = handler;
    this.request = handler.request;
    this.result = {};
  }

  function read_headers(...args) {
    for (var arg of args) {
      this.reesult[arg] = this.request.headers[arg];
    }
  }

  function reply_if() {
    
  }
}
