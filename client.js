const url = require("url");
const qs = require("querystring")
const util = require("./util.js");
var debug = require("debug")("didi");

class Client {
  constructor(server, id) {
    this.server = server;
    this.id = id;
    this.seq = server.client_seq;
    this.variables = {};
  }

  process(req, res, seq) {
    var request = { request: req, response: res}
    this.response = req;
    debug(`Processing client ${this.id} ${this.seq} seq ${seq}`);
    this.parse_query(request)
      .then(query => this.load_page(request))
      .then(types => this.respond(request, types))
      .catch(err=> this.report_error(request.response, err) )
  }

  report_error(response, err) {
    debug("ERROR", err);
    response.end();
  }

  parse_query(request) {
    var req = request.request;
    var parsed = url.parse(req.url, true);
    var get = Object.assign({}, parsed.query);

    if (req.method !== 'POST') return Promise.resolve(request.query = get);
    return this.read_post(req)
      .then(post => request.query = Object.assign(post, get));
  }

  load_page(request) {

    util.replace_fields(request.query, request.query);
    debug("REQUEST", JSON.stringify(request.query));

    var path = request.query.path.split('/');
    if (path[0] == '') path.shift();
    var page = path[0];

    // if no branch given, assume page = branch
    if (path.length ==1) path.unshift(path[0]);
    request.query.path = path.join('/');

    return this.server.load_page(page);
  }

  read_post(req) {
    return new Promise((resolve, reject) => {
      var body = '';
      var post;
      req.on('data', data=>{
        debug("READ POST", data)
        body += data;
        if (body.length >= 1e6) {
          req.connection.destroy();
          return reject("body too long");
        }
      })
      .on('end', qs.parse(data))
    });
  }

  respond(request, types) {
    this[request.query.action](request, types);
  }

  read(request, types) {
    debug("RESPONDING TO", request.query.path);
    var result = this.server.read(request.query.path, types);
    this.output(request.response, result);
  }

  output(response, result) {
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify(result));
  }
}


module.exports = Client;
