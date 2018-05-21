const url = require("url");
const qs = require("querystring")
const util = require("./util.js");
const {promise} = util;
const fs = require("fs");
const path_util = require("path");
const mime = require("mime-types");
const UIReader = require("./ui_reader");
const PostProcessor = require("./post_processor");


const non_mergeable = ['action', 'attr', 'audit', 'call', 'clear_session',
  'clear_values', 'error', 'for_each', 'load_lineage', 'keep_values', 'read_session', 'refresh', 'show_dialog',
  'sql_insert', 'sql_update', 'style', 'trigger', 'valid', 'validate', 'write_session'];


class Handler {
  constructor(server, sequence) {
    this.server = server;
    this.seq = sequence;
  }

  process(client, request, response) {
    this.client = client;
    this.request = request;
    this.response = response;
    this.log = this.server.get_logger({seq: this.seq, user_name: client.user_name, host: request.connection.remoteAddress, client_id: client.id});
    this.server.log = this.log;
    this.serve_mime(this.request)
      || this.serve_spa()
      || this.serve_ajax();
  };

  serve_spa() {
    var req = this.request;
    if (req.method != 'GET') return false;

    var parsed = url.parse(req.url, true);
    var query = Object.assign({}, parsed.query);
    if (query.action) return false;
    this.log.info("SERVE SPA", parsed.pathname, JSON.stringify(query));
    this.load_spa(query)
      .then(data => this.respond("text/html", data))
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

  load_spa(query) {
    var config = this.client.get_spa_config();
    let path = path_util.resolve(this.server.config['resource_dir'] + '/' + config.template);

    delete config.template;
    return promise(fs.readFile, path, "utf8")
      .then(data=>{
        data = this.replace_links(data, 'script', "<script src='$script'></script>\n");
        data = this.replace_links(data, 'css', "<link href='$script' media='screen' rel='stylesheet' type='text/css' />\n");
        data = data.replace("$request_method", this.server.config['request_method']);

        util.replace_fields(config, query);
        util.replace_fields(config, config);
        var options = { path:  config.page, request: config };
        return data = data.replace("$options", JSON.stringify(options));
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
    var parsed = url.parse(req.url, true);
    let path = path_util.resolve(this.server.config['resource_dir'] + '/' + parsed.pathname);
    path = decodeURI(path);
    let ext = path_util.extname(path);
    if (!ext) return false;

    let content_type = mime.contentType(ext);

    if(!content_type)
      return this.send404();

    fs.exists(path, (exists) => {
      this.log.debug("SERVING", path);
      if(!exists)
        return this.send404(path + " not found");

      var headers = {
        "Content-Type": content_type,
        "Cache-Control": `public, max-age=${this.server.config.cache_age}`
      };
      var res = this.response;
      res.writeHead(200, headers);
      fs.createReadStream(path).pipe(res, ()=>res.end());
    });
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
    var parsed = url.parse(req.url, true);
    var get = Object.assign({}, parsed.query);

    if (req.method !== 'POST') return Promise.resolve(req.query = get);
    return this.read_post(req)
      .then(post => req.query = Object.assign(post, get));
  }

  read_page() {
    var query = this.request.query;
    util.replace_fields(query, query);
    this.log.info("REQUEST", JSON.stringify(query));

    var path = query.path.split('/');
    if (path[0] == '') path.shift();
    var page = path[0];

    // if no branch given, assume page = branch
    if (path.length ==1) path.unshift(path[0]);
    query.path = path.join('/');

    return this.load_page(page);
  }

  load_page(page, reload) {
    var {server} = this;
    server.log = this.log;
    var loader = server.check_loader(this.server.pages, page, "page");
    if (!('__waiting' in loader) && !reload)
      return loader;

    server.log = this.log;

    return Promise.all([
      server.load_terms("controls"),
      server.load_terms("fields"),
      server.load_terms(page).then(terms => this.include_all(terms))
    ])
    .then(results => {
        var terms = server.merge({}, ...results);
        if (loader.__resolve) loader.__resolve(terms)
        server.watch_terms(terms, ()=> this.load_page(page, true))
        return server.pages[page] = terms;
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
    var item = this.follow_path(query.path, types);
    var responder;
    if (query.action == "read")
      responder = new UIReader(this.server, this.client, this.request, query.action);
    else
      responder = new PostProcessor(thiis.server, this.client, this.request, query.action);

    responder.process(item, types)
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

module.exports = Handler;
