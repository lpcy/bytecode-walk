(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.BCRender = factory());
  }(this, (function () {'use strict';

async function loadTemplates(jsrender){
    var templateNames = ["main",
    "attrsTemplate","attrCodeTemplate","attrBootstrapMethodsTemplate","attrInnerClassesTemplate","attrMethodParametersTemplate",
    "opcodeWideTemplate","opcodeTableswitchTemplate","opcodeLookupswitchTemplate"];
    var templates = [];
    for(var i in templateNames){
        var templateName = templateNames[i];
        var tplText;
        if(typeof window === 'object'){
            var tpl = await fetch(`./template/${templateName}.tpl`);
            tplText = await tpl.text();
        }else{
            tplText = `./template/${templateName}.tpl`;
        }
        templates.push(jsrender.templates(templateName, tplText));
    }
    return templates;
}
async function render(BCParser,jsrender,bcResult){
    var templates = await loadTemplates(jsrender);
    var tmpl = templates[0];
    var jrViews = jsrender.views;
    var fmtFun = function(index){
        return bcResult.constantPool.dig(index);
    };
    jrViews.tags("highlight",function(val){
        var position = BCParser.position(val);
        return `data-s="${position.start}" data-e="${position.end}"`;
    });
    jrViews.tags("descriptor",function(val){
        if(BCParser.typeof(val).id.startsWith('index')){
            var fmtValue = fmtFun(val);
            var fmtValueEncoded = jrViews.converters.html(fmtValue);
            return `<i>${fmtValueEncoded}</i>`;
        }
    });
    jrViews.tags("hit", '<span {{highlight/}}>{{:}}{{descriptor/}}</span>');
    var html = tmpl.render(bcResult.tree,{point : fmtFun});
    return html;
}
var returnObj = {};
returnObj.render = render;
return returnObj;
})));