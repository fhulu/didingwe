"use strict";

var http = require("http");
const yaml = require("yamljs");
const merge = require("./deep_merge.js");
const fs = require("fs");
const after = require("./after.js");

class Didi {
  constructor() {
    this.files = {};
    this.read_config();
    var controls = this.load_terms("controls");
    var fields = this.load_terms("fields");
    this.terms = controls;//this.merge(controls, fields);
  }

  load_terms(name, paths) {
    var loaded = this.files[name];
    if (loaded)
      return loaded;
    paths = paths || ['./didi', '.'];
    var terms = {};
    if (!/\.\w+$/.test(name)) name += ".yml";
    paths.forEach(path => {
      var file = `${path}/${name}`;
      if (!fs.existsSync(file)) return;
      console.log(`loading ${file} ...`);
      var file_terms = yaml.load(file);
      terms = this.merge(terms, file_terms);
    });
    this.files[name] = terms;
    return terms;
  }

  read_config() {
    var config = this.load_terms("app-config");
    var site_config = this.load_terms(config.site_config, ['.']);
    console.log("site config", site_config)
    this.config = this.merge(config, site_config);
    console.log("config loaded")
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

};

var didi = new Didi();
//create a server object:
http.createServer(function (req, res) {
  console.log(req.url);
  res.write(JSON.stringify(didi.config)); //write a response to the client
  res.end(); //end the response
}).listen(1234);
