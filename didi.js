"use strict";

var http = require("http");
const yaml = require("yamljs");
const merge = require("./deep_merge.js");
const fs = require("fs");
const after = require("./after.js");
const Client = require("./client.js");
var async = require("async");
var sessions = require("client-sessions");

var session = sessions({
  cookieName: 'didi',
  secret: 'blargadeeblargblarg',
  duration: 24 * 60 * 60 * 1000,
  activeDuration: 1000 * 60 * 5
});


class Didi {
  constructor() {
    this.files = {};
    this.clients = {};
    this.next_seq = 1;
    this.read_config()
      .then(()=>this.load_fields())
      .then(()=>this.load_validators())
      .then(()=>this.init_server())
      .catch(error=>console.log(error))
  }

  load_terms(terms, name, paths) {
    var loaded = this.files[name];
    if (loaded)
      return Promise.resolve(loaded);
    paths = paths || ['./didi', '.'];
    if (!/\.\w+$/.test(name)) name += ".yml";
    var me = this;
    return after(async.reduce, paths, terms, (terms, path, callback)=>{
      path = `${path}/${name}`;
      if (!fs.existsSync(path))
        return callback(null, terms);
      console.log(`loading ${path} ...`);
      fs.readFile(path, "utf8", (err,data)=>{
        try {
          var term = yaml.parse(data);
          terms = me.merge(terms, term);
          callback(null, terms);
        }
        catch(e) {
          callback(`Parsing error reading ${path} at line ${e.parsedLine}: ${e.message}`, terms);
        }
      });
    })
    .then(terms=>this.files[name] = terms)
  }

  read_config() {
    return this.load_terms({}, "app-config")
      .then(config => this.load_terms(config, config.site_config, '[.]'))
      .then(config => this.config = config)
  }

  load_fields() {
    return this.load_terms({}, "controls")
      .then(controls => this.load_terms(controls, "fields"))
      .then(fields => this.fields = fields)
  }

  load_validators() {
    return this.load_terms({}, "validators")
      .then(validators => this.validators = validators)

  }

  merge(x,y) {
    const enforce_reset = (a, b) => b[0]=='_reset'? b: merge.array_merger;
    return merge(x, y, { array_merger: enforce_reset });
  }

  merge_type(obj, type, types, must_exist) {
    var expanded = types[type];
    if (!expanded) {
      if (must_exist) throw new Error(`Unknown type ${type}`, type);
      return obj;
    }
    type = expanded.type;
    expanded = this.merge(expanded, obj);
    if (!type) return expanded;
    return this.merge_type(expanded, type, types);
  }

  get_cookie(req, cookie) {
    if (!req.headers.cookie)
      return "unknown";

    var cookies = req.headers.cookie.split(";");
    console.log("cookies", cookies)
    for (var c of cookies) {
      var [name,value] = c.split("=");
      if (name == cookie) return value;
    }
    return 'unknown';
  }

  process_request(req, res) {
    var id = this.get_cookie(req, "didi");
    var client = this.clients[id];
    if (!client) {
      client = new Client(this, req, res);
      this.clients[id] = client;
    }
    client.process();
  }

  init_server() {
    var server = this;
    http.createServer(function (req, res) {
      session(req, res, ()=>{
        if (req.didi.seenyou) {
          res.setHeader('X-Seen-You', 'true');
        } else {
          req.didi.seenyou = true;
          res.setHeader('X-Seen-You', 'false');
        }
        server.process_request(req, res);
      })
      res.end(); //end the response
    }).listen(this.config.server_port);
    console.log("listening on port",this.config.server_port);
  }
};

var didi = new Didi();
