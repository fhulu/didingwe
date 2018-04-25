module.exports = function(func, ...args) {
  var context = null;
  if (Array.isArray(func)) {
    context = func[0];
    func = func[1];
  }
  return new Promise((resolve, reject) => {
    args.push((err,result)=>{
      if (err) return reject(err);
      return resolve(result);
    })
    func.apply(context, args);
  })
};
