"use strict";

var http = require("http");
const yaml = require("yamljs");
const merge = require("./deep_merge.js");
const fs = require("fs");
const after = require("./after.js");
// const Request = require("./request.js");
var async = require("async");

class Didi {
  constructor() {
    this.files = {};
    this.read_config()
      .then(config=>this.init_server(config))
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
      .then(config=>this.load_terms(config, config.site_config, '[.]'))
      .then(config=>this.config=config)
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

  init_server(config) {
    var me = this;
    http.createServer(function (req, res) {
      res.write(JSON.stringify(me.config));
      res.end(); //end the response
    }).listen(config.server_port);
    console.log("listening on port",config.server_port);
  }
};

var didi = new Didi();
