  "use strict";

var mysql = require("mysql");
var util = require("./util");

class DB {
  constructor(router) {
    this.router = router;
    this.log = router.log;
    this.initConnection(router.server.config.db);
  }

  initConnection(conf) {
    conf = Object.assign({
      host: 'localhost',
      database: conf.schema,
      user: conf.schema,
      connectionLimit: 1,
      multipleStatements: true
    }, conf);
    var {log} = this;
    this.connection = mysql.createPool(conf);
    this.connection.on('connection', connection=> {
      log.debug("connecting user %s to database %s at %s", conf.user, conf.database, conf.host);

      // catch fatal errors
      connection.on('error', function(err) {
        log.error("(%s, FATAL=%s) %s <%s>", err.code, err.fatal, err.sqlMessage, err.sql);
        if (err.fatal) {
          connection.destroy();
        }
      });
    })
    .on('acquire', connection=> {
      log.debug('connection %d acquired', connection.threadId);
    })
    .on('release', connection=> {
      log.debug('connection %d released', connection.threadId);
    });
  }

  reportError(err) {
    this.log.error("(%s, FATAL=%s) %s <%s>", err.code, err.fatal, err.sqlMessage, err.sql);
    if (err.fatal) this.close();
  }

  exec(sql) {
    sql = this.router.replace_vars(sql, mysql.escape);
    this.log.debug("SQL: "+ sql);
    return util.promise([this.connection, this.connection.query], sql)
      .catch(err=>this.reportError(err));
  }

  insert(sql, ...args) {
    var sql = "insert into "+ table
      + "(`" + args.keys().join("`,`") + "`)"
      + " values (:" + args.values().join(",:") + ")";
    return this.exec(sql, ...args);
  }

  readOneRow(sql, ...args) {
    if (!/limit\s*\d*(,\d*)?/i.test(sql))
      sql += " limit 1";
    return this.exec(sql, args)
      .then(result=>Promise.resolve(result[0]));
  }

  readOneValue(sql, ...args) {
    return this.readOneRow(sql, args)
      .then(result=>Promise.resolve(result.values()[0]));
  }

  data(table, conditions, ...args) {
    var sql = `select ${args.join(', ')} from ${table}`;
    conditions = this.extract_pairs(conditions).join(" and ");
    if (conditions)
      sql += ` where ${conditions}`;
    return this.exec(sql, this.context)
      .then(results=> results.map(row=>Object.values(row)))
  }

  extract_pairs(list) {
    var pairs = [];
    for (var value of list) {
      this.log.trace("value", value);
      pairs.push(this.get_value(value))
    }
    this.log.trace("pairs", pairs);
    return pairs;
  }

  get_value(obj) {
    var [key, value] = util.first_object(obj);
    if (value === undefined || value === null || util.is_empty(value))
      return `${key} = $${key}`;
    if (value[0] == '/')
      return `${key} ` + value.substr(1);
    return `${key} = ` + mysql.escape(value);
  }

  close() {
    return util.promise([this.connection, this.connection.end]);
  }
}

module.exports = DB;
