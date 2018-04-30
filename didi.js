"use strict";

var http = require("http");
const yaml = require("yamljs");
const util = require("./util.js");
const fs = require("fs");
const after = require("./after.js");
const Client = require("./client.js");
var async = require("async");
var sessions = require("client-sessions");
const debug = require("debug")("didi");

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
    this.next_seq = 0;
    this.types = {};
    this.pages = {};
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
    var file = name;
    if (!/\.\w+$/.test(name)) file += ".yml";
    var me = this;
    return after(async.reduce, paths, terms, (terms, path, callback)=>{
      path = `${path}/${file}`;
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
    .then(terms => {
      if (!terms)
        throw new Error(`File(s) for '${name}' must exist`);
      console.log(`loaded ${name}`)
      return this.files[name] = terms;
    })
  }

  read_config() {
    return this.load_terms({}, "app-config")
      .then(config => this.load_terms(config, config.site_config, '[.]'))
      .then(config => this.config = config)
  }

  load_fields() {
    return this.load_terms({}, "controls")
      .then(controls => this.load_terms(controls, "fields"))
      .then(fields => this.types = this.fields = fields)
  }

  load_validators() {
    return this.load_terms({}, "validators")
      .then(validators => this.validators = validators)

  }

  merge(x,y) {
    const enforce_reset = (a, b) =>  b[0]=='_reset'? (b.shift(), b): util.merge_array(a,b);
    return util.merge(x, y, { array_merger: enforce_reset });
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
      return null;

    var cookies = req.headers.cookie.split(";");
    for (var c of cookies) {
      var [name,value] = c.split("=");
      if (name == cookie) return value;
    }
    return null;
  }

  process_request(req, res) {
    var id = this.get_cookie(req, "didi");
    var client = this.clients[id];
    if (!client)
      client = new Client(this, id);
    this.client = client;
    client.process(req, res);
    if (!id) return;
    this.next_seq++;
    this.clients[id] = client;
  }

  init_server() {
    http.createServer((req, res) => {
      session(req, res, () => {
        if (req.didi.seenyou) {
          res.setHeader('X-Seen-You', 'true');
        } else {
          req.didi.seenyou = true;
          res.setHeader('X-Seen-You', 'false');
        }
        this.process_request(req, res);
      })
    }).listen(this.config.server_port);
    console.log("listening on port",this.config.server_port);
  }

  load_page(page) {
    var existing = this.pages[page];
    if (existing) return Promise.resolve(existing);

    return this.load_terms(null, page)
      .then(terms => this.update_page_terms(page, terms))
  }

  update_page_terms(page, terms) {
    var types = {};
    for (var key in terms) {
      if (!terms.hasOwnProperty(key)) continue;
      types[key] = this.merge(this.types[key], terms[key]);
    }
    return this.pages[page] = this.merge(this.types, types);
  }
};

var didi = new Didi();
