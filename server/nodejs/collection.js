"use strict";
const util = require("util");

class Collection {
  constructor(server, handler) {
    this.server = server;
    this.handler = handler;
  }

  values(...args) {
    var sql = this.read(args);
  }

  read(...args) {
    args = this.parse_args(args)
  }

  parse_args(args, cmd="", min_count=0)
  {
    if (util.is_empty(args)) || args.length > 1 || util.is_array(args))
      return this.verify_args(args, cmd, min_count);
    $args = array_map(function($arg) {
      return trim($arg);
    }, explode (',', $args[0]));

    args = args.map(arg=>arg.trim())

    return page::verify_args($args, $cmd, $min_count);
  }

  static function verify_args(&$args, $cmd, $min_count)
  {
    if (sizeof($args) < $min_count)
      throw new Exception("Too few arguments for $cmd, must be at least $min_count");
    return $args;
  }

}
