const url = require("url");
const qs = require("querystring")
const util = require("./util.js");

class Client {
  constructor(server, id) {
    this.server = server;
    this.id = id;
    this.seq = server.next_seq;
    this.variables = {};
  }

  process(request, response) {
    this.response = response;
    console.log(`Processing client ${this.seq}`);
    this.parse_request(request)
      .then((request) => this.rewrite_path(request))
      .then(() => this.server.load_page(this.page))
      .then(types => this.respond(types))
      .catch(err=> this.report_error(err) )
  }

  report_error(err) {
    console.log("ERROR", err);
    this.response.end();
  }

  parse_request(req) {
    var parsed = url.parse(req.url, true);
    var get = parsed.query;
    console.log("REQUEST GET", get);

    if (req.method !== 'POST') return Promise.resolve(this.request = get);
    return this.read_post(req)
      .then(post => this.request = Object.assign(post, get));
  }

  rewrite_path(request) {
    var path = request.path.split('/');
    this.page = path[0];

    // if no branch given, assume page = branch
    if (path.length ==1) path.unshift(path[0]);
    return this.path = path.join('/');
  }

  read_post(req) {
    return new Promise((resolve, reject) => {
      var body = '';
      var post;
      req.on('data', data=>{
        body += data;
        if (body.length >= 1e6) {
          req.connection.destroy();
          return reject("body too long");
        }
      })
      .on('end', qs.parse(data))
    });
  }

  respond(types) {
    var action = this.request.action;
    if (!action) action = 'read';
    this[action](types);
  }

  read(types) {
    console.log("path", this.path)
    var response = this.server.read(this.path, types);
    this.output(response);
  }

  output(response) {
    this.response.writeHead(200, {'Content-Type': 'application/json'})
    this.response.end(JSON.stringify(response));
  }
}


module.exports = Client;