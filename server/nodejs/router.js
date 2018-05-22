const url = require("url");
const qs = require("querystring")
const util = require("./util.js");
const {promise} = util;
const fs = require("fs");
const path_util = require("path");
const mime = require("mime-types");
const UIReader = require("./ui_reader");
const Actioner = require("./actioner");


const non_mergeable = ['action', 'attr', 'audit', 'call', 'clear_session',
  'clear_values', 'error', 'for_each', 'load_lineage', 'keep_values', 'read_session', 'refresh', 'show_dialog',
  'sql_insert', 'sql_update', 'style', 'trigger', 'valid', 'validate', 'write_session'];


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
    this.log = this.server.get_logger({seq: this.seq, user_name: client.user_name, host: request.connection.remoteAddress, client_id: client.id});
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
      .then(data => this.respond("text/html", data.html))
      .catch(err => this.send404(err))

    return true;
  }

  respond(type, result, code=null) {
    if (['application/json', 'text/plain', 'text/html'].includes(type))
      this.log.debug("RESPONSE", result.length, result.substring(0,127).replace(/\r?\n|\r/,'.'));
    var res = this.response;
    if (code)
      res.writeHead(code, {"Content-Type": type})
    else
      res.setHeader("Content-type", type);
    res.end(result);
  }

  load_spa(options = { reload: false }) {
    var {client,server,request} = this;
    var cache = server.cached("SPA", client.get_joined_roles(), options);
    if (cache.data) return cache.promise();

    var config = client.get_spa_config();
    let path = path_util.resolve(server.config['resource_dir'] + '/' + config.template);

    delete config.template;
    return promise(fs.readFile, path, "utf8")
      .then(data=>{
        data = this.replace_links(data, 'script', "<script src='$script'></script>\n");
        data = this.replace_links(data, 'css', "<link href='$script' media='screen' rel='stylesheet' type='text/css' />\n");
        data = data.replace("$request_method", server.config['request_method']);

        util.replace_fields(config, request.query);
        util.replace_fields(config, config);
        var options = { path: config.page, request: config };
        if (this.request.pathname != '/') options.request.content = request.pathname
        var result = { html: data.replace("$options", JSON.stringify(options)) };
        server.watch_terms(server.config, ()=>this.load_spa({reload: true}))
        return cache.resolve(result);
    })
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


    var paths = this.server.config.search_paths;
    var file_path = paths.reverse().find(dir => fs.existsSync(path_util.resolve(dir) + '/web/' + path))

    if (!file_path)
      return (this.send404(path + " not found"), true);

    file_path += '/web/' + path;
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

  send404(err) {
    this.log.error(err);
    this.respond("text/plain", "Resource not found", 404)
  }

  serve_ajax() {
    this.parse_query()
      .then(()=> this.read_page())
      .then(types => this.process_ajax(types))
      .catch(err=> this.server.report_exception(err) )
  }

  parse_query() {
    var req = this.request;
    if (req.method !== 'POST') return Promise.resolve(req.query);
    return this.read_post(req)
      .then(post => req.query = Object.assign(post, get));
  }

  read_page() {
    var {query} = this.request;
    util.replace_fields(query, query);
    this.log.info("REQUEST", JSON.stringify(query));

    var path = query.path.split('/');
    if (path[0] == '') path.shift();
    var page = path[0];

    // if no branch given, assume page = branch
    if (path.length ==1) path.unshift(path[0]);
    query.path = path.join('/');

    return this.load_page(page)
      .then(terms => {
        this.page = terms[page];
        return this.terms = terms;
      });
  }

  load_page(page, options = { reload: false }) {
    var {server} = this;
    server.log = this.log;
    var cache = server.cached("page", page, options);
    if (cache.data) return cache.promise();

    server.log = this.log;

    return Promise.all([
      server.load_terms("controls"),
      server.load_terms("fields"),
      server.load_terms(page).then(terms => this.include_all(terms))
    ])
    .then(results => {
        var terms = server.merge({}, ...results);
        server.watch_terms(terms, ()=> this.load_page(page, true))
        return cache.resolve(terms);
      })
  }

  include_all(terms, already=[]) {
    this.server.log = this.log;
    var includes = terms.include;
    if (!includes) return Promise.resolve(terms);
    var promises = includes.map( page => this.include_one(page, already));
    return Promise.all(promises)
      .then(results => this.server.merge({}, ...results, terms))
  }

  include_one(page, already) {
    this.server.log = this.log;
    if (already.includes(page))
      return Promise.resolve({});
    already.push(page);
    return this.server.load_terms(page)
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

  process_ajax(types) {
    var query = this.request.query;
    var item = this.root = this.follow_path(query.path, types);
    var responder;
    if (query.action == "read")
      responder = new UIReader(this);
    else
      responder = new Actioner(this);

    responder.process(item, types, query.action)
      .then(result=>this.respond("application/json", JSON.stringify(result)));
  }

  follow_path(path, types) {
    path = path.split('/').slice(1);
    var item = types;
    var parent = item;
    for (var branch of path) {
      item = item[branch];
      if (!item)
        throw Error("Invalid path " + path.join('/'));
    }
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
