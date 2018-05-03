const url = require("url");
const qs = require("querystring")
const util = require("./util.js");
var debug = require("debug")("DIDI");

class Client {
  constructor(server, id) {
    this.server = server;
    this.id = id;
    this.seq = 0;
    this.variables = {};
    this.auth_token = null;
    this.config = server.config['landing'];
  }

  process(req, res) {
    var request = { request: req, response: res}
    this.response = req;
    ++this.seq;
    this.parse_query(request)
      .then(query => this.load_page(request))
      .then(types => this.respond(request, types))
      .catch(err=> this.report_error(request.response, err) )
  }

  log(type, message) {
    debug(`CLIENT ${this.id} ${this.seq} ${type} ${message}`);
  }


  report_error(response, err) {
    this.log("ERROR", err);
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
    this.log("REQUEST", JSON.stringify(request.query));

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
    var result = this.server.read(request.query.path, types);
    this.output(request.response, result);
  }

  output(response, result) {
    result = JSON.stringify(result);
    this.log("RESPONSE", result.substring(0,127));
    // response.setHeader('Content-Type', 'application/json')
    response.end(result);
  }

  is_logged_in() {
    return this.auth_token != null;
  }

  get_config() {
    return this.config;
  }

  update_config(config) {
    Object.assign(this.config, config);
  }
}


module.exports = Client;
