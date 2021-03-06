var split = require('split')
  , EventEmitter = require('events').EventEmitter;

function find(stream, reg) {
  var lineNumber = 0,
      found = 0,
      e = new EventEmitter(),
      regExp = new RegExp(reg);
  stream
  .pipe(split())
  .on('data', function (line) {
    lineNumber += 1   
    var foundItems = regExp.exec(line);        
        if (foundItems && foundItems.length > 0 && foundItems[0] !== '') {
          var item=foundItems[0];//Only use the first found
          e.emit('found', item, lineNumber);
          found += 1;
    };

  })
  .on('end', function () {
    e.emit('end', found);
  })
  .on('error', function (error) {
    e.emit('error', error);
  })
  return e;
}
module.exports = find;