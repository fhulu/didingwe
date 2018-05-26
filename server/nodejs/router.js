const url = require("url");
const qs = require("querystring")
const util = require("./util.js");
const {promise} = util;
const fs = require("fs");
const path_util = require("path");
const mime = require("mime-types");
const UIReader = require("./ui_reader");
const Actioner = require("./actioner");

class Router {
  constructor(server, sequence) {
    this.server = server;
    this.seq = sequence;
    this.terms = {}
  }

  process(client, request, response) {
    this.client = client;
    this.request = request;
    this.response = response;
    var log_context = {seq: this.seq, user_name: client.user_name, host: request.connection.remoteAddress, client_id: client.id};
    this.log = this.server.get_logger(()=>log_context);
    this.server.log = this.log;
    request.url = request.url.replace(/&_=\w+/,'')
    var parsed = url.parse(request.url, true);
    request.pathname = parsed.pathname;
    request.query = Object.assign({}, parsed.query);
    this.serve_mime()
      || this.serve_spa()
      || this.serve_ajax();
  };

  serve_spa() {
    var req = this.request;
    if (req.method != 'GET') return false;

    var query = req.query;
    if (query.action) return false;
    this.log.info("SERVE SPA", req.pathname, JSON.stringify(query));
    this.load_spa()
      .then(html => this.respond("text/html", html))
      .catch(err => this.send404(err))

    return true;
  }

  respond(type, result, code=null) {
    if (['application/json', 'text/plain', 'text/html'].includes(type))
      this.log.debug("RESPONSE", result.length, result.substring(0, this.server.config.logging.max_response).replace(/\r?\n|\r/,'.'));
    var res = this.response;
    if (code)
      res.writeHead(code, {"Content-Type": type})
    else
      res.setHeader("Content-type", type);
    res.end(result);
  }

  load_spa(options = { reload: false }) {
    var {client,server,request,log} = this;
    var cache = server.cached("SPA", this.get_url_key(), options);
    if (cache.data) return cache.promise();

    server.log = log;
    var path, config;
    return server.load_terms("app-config")
    .then(()=> {
      config = util.clone(client.get_spa_config());
      path = this.get_resource_path(config.template);
      return promise(fs.readFile, path, "utf8")
    })
    .then(data=>{
      data = this.replace_links(data, 'script', "<script src='$script'></script>\n");
      data = this.replace_links(data, 'css', "<link href='$script' media='screen' rel='stylesheet' type='text/css' />\n");
      data = data.replace("$request_method", server.config.request_method);

      if (request.pathname != '/')
        config.path = request.pathname;

      util.replace_fields(config, request.query);
      util.replace_fields(config, config);
      var options = { path: config.page, request: config };

      // reload spa when spa template or config changes
      server.watch_terms([path, server.config], ()=>this.load_spa({reload: true}))

      var html = data.replace("$options", JSON.stringify(options));
      return cache.resolve(html);
    })
  }

  get_url_key() {
    var {request, client} = this;
    var roles = client.roles.join('.');
    return `${roles}@${request.url}`;
  }

  replace_links(html, type, template) {
    var urls = this.server.config[type];
    var links = "";
    if (!urls)
      return html;

    for (var url of urls) {
      links += template.replace('$script', url);
    }
    return html.replace(`$${type}_links`, links);
  }

  serve_mime() {
    var req = this.request;
    if (req.method != 'GET') return false;
    let path = req.pathname;
    path = decodeURI(path);
    let ext = path_util.extname(path);
    if (!ext) return false;

    let content_type = mime.contentType(ext);

    if(!content_type)
      return (this.send404(), true);


    var file_path = this.get_resource_path(path);

    if (!file_path)
      return (this.send404(path + " not found"), true);

    this.log.debug("SERVING", path, "from", file_path);
    var headers = {
      "Content-Type": content_type,
      "Cache-Control": `public, max-age=${this.server.config.cache_age}`
    };
    var res = this.response;
    res.writeHead(200, headers);
    fs.createReadStream(file_path).pipe(res, ()=>res.end());
    return true;
  }

  get_resource_path(web_path) {
    var paths = this.server.config.search_paths;
    var file_path = paths.reverse().find(dir => fs.existsSync(path_util.resolve(dir) + '/web/' + web_path))
    if (!file_path)
      return false;
    return file_path + "/web/" + web_path;
  }

  send404(err) {
    this.log.error(err);
    this.respond("text/plain", "Resource not found", 404)
  }

  serve_ajax() {
    this.parse_query()
      .then(()=> this.read_terms())
      .then(()=> this.process_ajax())
      .catch(err=> this.server.report_exception(err) )
  }

  parse_query() {
    var req = this.request;
    if (req.method !== 'POST') return Promise.resolve(req.query);
    return this.read_post(req)
      .then(post => req.query = Object.assign(post, get));
  }

  read_terms() {
    var {query} = this.request;
    util.replace_fields(query, query);
    this.log.info("REQUEST", JSON.stringify(query));

    var path = query.path.split('/');
    if (path[0] == '') path.shift();

    // if no branch given, assume page = branch
    if (path.length == 1)
      path.unshift(path[0]);
    this.page_id = path[1];
    this.path = path;
    return this.load_terms(path[0]);
  }

  load_terms(name, options = { reload: false }) {
    var {server,log} = this;
    server.log = log;
    return (()=> {
      var cache = server.cached("page_terms", name, options);
      if (cache.data) return cache.promise();

      server.log = log;
      return Promise.all([
        server.load_terms("controls"),
        server.load_terms("fields"),
        server.load_terms(name)
      ])
      .then(results => this.include_all(server.merge({}, ...results)))
      .then(terms => cache.resolve(terms, ()=> this.load_terms(name, { reload: true})));
    })()
    .then(terms => {
      var page = terms[this.page_id];
      if (!page) {
        this.path.unshift(this.path[0]);
        this.page_id = this.path[1];
        page = terms[this.page_id];
      }
      this.page = page;
      return this.terms = terms;
    })
  }

  include_all(terms, already=[]) {
    this.server.log = this.log;
    var includes = terms.include;
    if (!includes) return Promise.resolve(terms);
    var promises = includes.map( name => this.include_one(name, already));
    return Promise.all(promises)
      .then(results => this.server.merge({}, ...results, terms))
  }

  include_one(name, already) {
    this.server.log = this.log;
    if (already.includes(name))
      return Promise.resolve({});
    already.push(name);
    return this.server.load_terms(name)
      .then(terms => this.include_all(terms, already))
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
      .on('end', ()=>resolve(qs.parse(body)))
    });
  }

  process_ajax() {
    var {action} = this.request.query;
    var responder;
    if (action == "read")
      responder = new UIReader(this);
    else
      responder = new Actioner(this);

    responder.process(action)
      .then(result=>this.respond("application/json", JSON.stringify(result)));
  }

  follow_path(path) {
    if (!path) path = this.path.slice(2);
    var item = this.page;
    var parent;
    for (var branch of path) {
      parent = item;
      if (util.is_object(item))
        item = item[branch];
      else
        item = util.object_with_key(item, branch);
      if (!item) {
        this.log.error("error on branch", branch, util.is_object(parent),JSON.stringify(parent))
        throw Error("Invalid path " + path.join('/'));
      }
    }

    if (!item.id) item.id = path.length? util.last(path): this.page_id;
    if (!item.name) item.name = util.name(item.id);

    return item;
  }

  output(response, result) {
    result = JSON.stringify(result);
    this.log.debug("RESPONSE", result.substring(0,127));
    response.setHeader('Content-Type', 'application/json')
    response.end(result);
  }
}

module.exports = Router;
