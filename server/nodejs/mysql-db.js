"use strict";

class DB {
  // constructor allows 4 version of configuration:
  // 1) constructor() -- no arguments, readd configuration from .mysql-db.conf
  // 2) constructor(conf string) -- accept path of YAML configuration file
  // 3) constructor(conf object) -- accept configuration as json object
  // 4) constructor(host, database, user, password) -- accecpt arguments as specified
  constructor(server, handler) {
    this.initConnection(server.config.db);
    this.log = server.get_logger(handler.log_context, 'db');
  }

  initConnection(conf) {
    this.connection = mysql.createPool(conf);
    this.connection.on('connection', connection=> {
      this.log.debug("connecting user %s to database %s at %s", this.config.user, this.config.database, this.config.host);

      // catch fatal errors
      connection.on('error', function(err) {
        this.log.error("(%s, FATAL=%s) %s <%s>", err.code, err.fatal, err.sqlMessage, err.sql);
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
        this.log.debug("SQL:", sql);
        return sql;
      };
    })
    .on('acquire', connection=> {
      this.log.debug('connection %d acquired', connection.threadId);
    })
    .on('release', connection=> {
      this.log.debug('connection %d released', connection.threadId);
    });
  }

  query(sql, ...args, callback) {
    if (!callback) {
      var q = this.connection.query(sql, ...args);
      q.on("error", this.reportError);
      return q;
    }

    return this.connection.query(sql, ...args, (err, rows)=> {
      if (err) this.reportError(err);
      if (callback) callback(err, rows);
    });
  }

  reportError(err) {
    this.log.error("(%s, FATAL=%s) %s <%s>", err.code, err.fatal, err.sqlMessage, err.sql);
    if (err.fatal) this.close();
    throw err;
  }

  exec(sql, ...args) {
    return new Promise( (resolve, reject) => {
      this.query(sql, ...args, (err, rows) => {
        if (err)
          return reject(err);
        resolve(rows);
      });
    });
  }

  insert(sql, ...args) {
    var sql = "insert into "+ table
      + "(`" + args.keys().join("`,`") + "`)"
      + " values (:" + args.values().join(",:") + ")";
    return this.exec(sql, args);
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

  close() {
    return new Promise( (resolve, reject) => {
      this.connection.end(err=> {
        if (err) reject(err);
        resolve();
      });
    });
  }
}

module.exports = DB;
