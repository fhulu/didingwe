module.exports = function(context, func, ...args) {
  return new Promise((resolve, reject) => {
    context[func].apply(context, args, function(err,result) {
      if (err) return reject(err);
      return resolve(result);
    });
  })
};
