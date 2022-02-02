(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.BCDecompile = factory());
  }(this, (function () {'use strict';

var modifierMap = {
    'ACC_PUBLIC' : 'public',
    'ACC_PRIVATE' : 'private',
    'ACC_STATIC' : 'static',
    'ACC_PROTECTED' : 'protected',
    'ACC_FINAL' : 'final',
    'ACC_SYNCHRONIZED' : 'synchronized',
    'ACC_VOLATILE' : 'volatile',
    'ACC_TRANSIENT' : 'transient',
    'ACC_NATIVE' : 'native',
    'ACC_ABSTRACT' : 'abstract',
    'ACC_STRICT' : 'strictfp'
}
function readClassName(path){
    var separatorIndex = path.lastIndexOf("/");
    var className = path.substring(separatorIndex+1);
    var packageName = null;
    if(separatorIndex >= 0){
        packageName = path.substring(0,separatorIndex).replace(new RegExp(/\//g),'.');
    }
    return {
        'className' : className,
        'packageName' : packageName,
        'fullName' : packageName + "." + className
    }
}
function readAccFlags(accFlags){
    return accFlags.filter(a => Object.keys(modifierMap).indexOf(a) > -1).map(a => modifierMap[a]).join(" ");
}
function decompile(bcResult){
    var bcTree = bcResult.tree;
    var constantPool = bcResult.constantPool;
    var classInfo = readClassName(constantPool.dig(bcTree.this_class));
    var java = '';
    var currentPackageName = classInfo.packageName;
    if(currentPackageName){
        java += `package ${currentPackageName};\n\n`;
    }
    for(var i in bcTree.constants){
        var constant = bcTree.constants[i];
        if(constant.getType() == 'Class'){
            var classPath = constantPool.dig(i).toString();
            var constantClassInfo = readClassName(classPath);
            if(constantClassInfo.packageName != 'java.lang' && constantClassInfo.packageName !=currentPackageName){
                java += `import ${constantClassInfo.fullName};\n`;
            }
        }
    }
    java += '\n';
    var findAttr = function(attrName){
        return bcTree.attributes.filter(a => constantPool.dig(a.attribute_name_index) == attrName);
    }
    if(findAttr('Deprecated')){
        java += "@Deprecated\n";
    }
    var classAccFlags = bcTree.accFlags;
    var isInterface = classAccFlags.indexOf("ACC_INTERFACE") > -1;
    java += readAccFlags(isInterface ? 
            classAccFlags.filter(a => a != 'ACC_ABSTRACT')
            : classAccFlags) + " ";
    if(classAccFlags.indexOf("ACC_ENUM") > -1){
        java += "enum ";
    }else if(isInterface){
        if(classAccFlags.indexOf("ACC_ANNOTATION") > -1){
            java += "@";
        }
        java += "interface ";
    }else{
        java += "class ";
    }
    java += classInfo.className;
    var signature = findAttr('Signature');
    if(signature.length > 0){
        java += '<';
        //signature
        java += '> ';
    }
    if(constantPool.dig(bcTree.super_class) != "java/lang/Object"){
        var extendClassInfo = readClassName(constantPool.dig(bcTree.super_class));
        java += 'extends ' + extendClassInfo.className;
        java += ' ';
    }
    var interfaces = bcTree.interfaces;
    if(interfaces.length > 0){
        java += isInterface ? 'extends ' : 'implements ';
        java += interfaces.map(a => {
            var interfaceStr = constantPool.dig(a.index);
            var interfaceClassInfo = readClassName(interfaceStr);
            return interfaceClassInfo.className;
        }).join(", ");
    }
    java += '{\n';

    return java;
}
var returnObj = {};
returnObj.decompile = decompile;
return returnObj;
})));
