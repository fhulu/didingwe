const url = require("url");
const qs = require("querystring")
const merge = require("./deep_merge.js");

class Client {
  constructor(server, id) {
    this.server = server;
    this.id = id;
    this.seq = server.next_seq;
    this.posted = {};
    this.variables = {};
    this.page = {};
  }

  process(request, response) {
    this.response = response;
    console.log(`Processing client ${this.seq}`);
    this.parse_request(request)
      .then(parsed => this.request = request)
      .then(() => this.load_page(this.path[0]))
      .then(page => this.page = page)
      .then(() => this.output() )
      .catch(err=> this.report_error(err) )
  }

  output() {
    console.log("Processed");
    this.response.end();
  }

  report_error(err) {
    console.log("ERROR", err);
    this.response.end();
  }

  parse_request(req) {
    var parsed = url.parse(req.url);
    var path = parsed.pathname.split('/');
    path.shift();
    if (path[0] == '') path[0] == 'index';
    this.path = path;
    var get = parsed.query;
    console.log("REQUEST PATH", this.path, "GET", get);
    if (req.method !== 'POST') return Promise.resolve(get);
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
      .on('end', ()=> {
        post = qs.parse(data);
        console.log("POST", post);
        resolve(merge(get, post));
      });
    });
  }

  load_page(name) {
    if (name == '') name = 'index';
    return this.server.load_terms(null, name)
      .then(terms => this.page = terms)
      .then(terms => console.log("terms", JSON.stringify(terms)))
  }
}


module.exports = Client;
