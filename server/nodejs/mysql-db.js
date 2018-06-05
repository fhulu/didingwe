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

      // allow text substitution to replace :key with value in values
      connection.config.queryFormat = function (sql, values) {
        if (values !== undefined) {
          sql = sql.replace(/\:(\w+)/g,  function(txt, key) {
            if (values.hasOwnProperty(key))
              return this.escape(values[key]);
            return txt;
          }.bind(this));
        }
        log.debug("SQL:", sql);
        return sql;
      };
    })
    .on('acquire', connection=> {
      log.debug('connection %d acquired', connection.threadId);
    })
    .on('release', connection=> {
      log.debug('connection %d released', connection.threadId);
    });
  }

  query(sql, args, callback) {
    return this.connection.query(sql, ...args, (err, rows)=> {
      if (err) this.reportError(err);
      if (callback) callback(err, rows);
    });
  }

  reportError(err) {
    this.log.error("(%s, FATAL=%s) %s <%s>", err.code, err.fatal, err.sqlMessage, err.sql);
    if (err.fatal) this.close();
  }

  exec(sql, ...args) {
    return util.promise([this, this.query], sql, args);
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
    if (Array.isArray(conditions) && conditions.length)
      sql += ` where ${conditions.join(' and ')}`;
    return this.exec(sql)
      .then(results=> results.map(row=>Object.values(row)))
  }


  close() {
    return util.promise([this.connection, this.connection.end]);
  }
}

module.exports = DB;
