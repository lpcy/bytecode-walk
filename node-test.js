var fs = require("fs");
var path=require('path');
var BCParser = require("./js/parser");
var BCRender = require("./js/render");
var BCDecompile = require("./js/decompile");
var jsrender = require('jsrender');

var args = process.argv.splice(2);
if(args.length != 1){
    console.log("please specify a file path!");
    return;
}
var file=path.resolve(args[0]);
fs.readFile(file,async function(err,buffer){
	if(err){
        return console.error(err);
    }
    var ab = buffer.buffer;
    var ret = BCParser.readBuffer(ab);
    // console.log(JSON.stringify(ret));
    var html = await BCRender.render(BCParser,jsrender,ret);
    // console.log(html);
    var java = BCDecompile.decompile(ret);
    console.log(java);
});
