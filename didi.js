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
  }

  load_terms(name, paths) {
    var loaded = this.files[name];
    if (loaded)
      return Promise.resolve(loaded);
    paths = paths || ['./didi', '.'];
    if (!/\.\w+$/.test(name)) name += ".yml";
    var me = this;
    return new Promise((resolve,reject)=>
      async.reduce(paths, {}, (terms, path, callback)=>{
        path = `${path}/${name}`;
        if (!fs.existsSync(path))
          return callback(null, terms);
        console.log(`loading ${path} ...`);
        fs.readFile(path, "utf8", (err,data)=>{
          var term = data? yaml.parse(data): {};
          terms = me.merge(terms, term);
          callback(null, terms);
        });
        //todo: report error
      }, function(err, result) {
        if (err) return reject(err)
        me.files[name] = result;
        return resolve(result);
      })
    );
  }

  read_config() {
    return this.load_terms("app-config")
      .then(config=>{
        this.config = config;
        return this.load_terms(config.site_config);
       })
      .then(site_config=>{
        this.config = this.merge(this.config, site_config);
        return Promise.resolve(this.config)
      });
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
