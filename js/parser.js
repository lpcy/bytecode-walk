(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.BCParser = factory());
  }(this, (function () {'use strict';

    const BC_TYPES = {
        'index' : {'id':'index','type':"int",'len':2},
        'index_short' : {'id':'index_short','type':"int",'len':1},
        'int1' : {'id':'int1','type':"int",'len':1},
        'int2' : {'id':'int2','type':"int",'len':2},
        'int4' : {'id':'int4','type':"int",'len':4},
        'sint1' : {'id' : 'sint1','type':'sint','len':1},
        'sint2' : {'id' : 'sint2','type':'sint','len':2},
        'sint4' : {'id' : 'sint4','type':'sint','len':4},
        'hex' : {'id':'hex','type':"hex",'len':-1},
        'string' : {'id':'string','type':"string",'len':-1},
        'array' : {'id':'array','type':"array",'len':-1}
    };
    const BC_INDEX=BC_TYPES.index;
    const BC_INDEX_SHORT=BC_TYPES.index_short;
    const BC_INT_1=BC_TYPES.int1;
    const BC_INT_2=BC_TYPES.int2;
    const BC_INT_4=BC_TYPES.int4;
    const BC_SINT_1=BC_TYPES.sint1;
    const BC_SINT_2=BC_TYPES.sint2;
    const BC_SINT_4=BC_TYPES.sint4;
    const BC_HEX=BC_TYPES.hex;
    const BC_STRING=BC_TYPES.string;
    const BC_ARRAY=BC_TYPES.array;
    const LOOP_BREAK=1;
    const LOOP_CONTINUE=2;
    const EXTRA_POSITION_START = Symbol('position_start');
    const EXTRA_POSITION_END = Symbol('position_end');
    const EXTRA_BC_TYPE = Symbol('bc_type');
    const BC_MAGIC = 'cafebabe';
    const ACC_CLASS = "class";
    const ACC_FIELD = "field";
    const ACC_METHOD = "method";
    const ACC_INNER_CLASS = "inner_class";
    const ACC_METHOD_PARAMETER = "method_parameter";

    var constantProto = {
        getType : function(){
            return constantReaders[this.tag].type;
        }
    }
    var codeProto = {
        getOpcode : function(){
            return opcodes[this.opcode].opcode;
        }
    }

    function readBuffer(arrayBuffer){
        var reader = new ByteCodeReader(arrayBuffer);
        var magic = reader.read("magic",BC_HEX,4);
        if(magic != BC_MAGIC){
            throw new Error("Invalid .class format");
        }
        reader.read("minor_version",BC_HEX,2);
        reader.read("major_version",BC_INT_2);
        var poolCount = reader.read("pool_count",BC_INT_2);
        var skipOne = false;
        var constants = reader.readArray("constants",poolCount,function(index){
            if(index ==0 || skipOne){
                skipOne = false;
                return LOOP_CONTINUE;
            }
            var tag = reader.read('tag',BC_INT_1);
            var constantReader = constantReaders[tag];
            if(constantReader){
                constantReader.read(reader);
                reader.setProto(constantProto);
                if(constantReader.type == 'Long' || constantReader.type == 'Double'){
                    skipOne = true;//a poor choice
                }
            }else{
                throw new Error("unknown constant tag:" + tag);
            }
        });
        var constantPool = new ConstantPool(constants);
        reader.readAccFlags(ACC_CLASS);
        reader.read('this_class',BC_INDEX);
        reader.read('super_class',BC_INDEX);
        var interfacesCount = reader.read('interfaces_count',BC_INT_2);
        reader.readArray("interfaces",interfacesCount,function(){
            reader.read('index',BC_INDEX);
        });
        var fieldsCount = reader.read('fields_count',BC_INT_2);
        reader.readArray("fields",fieldsCount,function(){
            reader.readAccFlags(ACC_FIELD);
            reader.read('name_index',BC_INDEX);
            reader.read('descriptor_index',BC_INDEX);
            reader.readAttributes(constantPool);
        });
        var methodsCount = reader.read('methods_count',BC_INT_2);
        reader.readArray("methods",methodsCount,function(){
            reader.readAccFlags(ACC_METHOD);
            reader.read('name_index',BC_INDEX);
            reader.read('descriptor_index',BC_INDEX);
            reader.readAttributes(constantPool);
        });
        reader.readAttributes(constantPool);
        return {
            'tree' : reader.getTree(),
            'constantPool' : constantPool
        };
    }

    function buf2hex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + 
                x.toString(16)).slice(-2)).join('');
    }

    function buf2str(buffer) {
        var decoder = new TextDecoder();
        return decoder.decode(buffer);
    }
    class ByteCodeReader{
        buffer = null;
        index = 0;
        tree = {};
        origin = undefined;
        constructor(buffer){
            this.buffer = buffer;
            this.origin = this.tree;
        }
        read(prop,dataDefine,len){
            var start = this.index;
            var readV;
            if(dataDefine instanceof Function){
                var tempNowOrigin = this.origin;
                var child = {};
                this.origin = child;
                dataDefine();
                this.origin = tempNowOrigin;
                readV = child;
            }else{
                if(dataDefine.len > 0){
                    if(len>0){
                        throw new Error('unneccessary length argument:' + prop);
                    }else{
                        len =  dataDefine.len;
                    }
                }
                var assertLength = function(){
                    if(len==undefined || len<0){
                        throw new Error('required length argument:' + prop);
                    }
                }
                if(dataDefine.type == 'int'){
                    assertLength();
                    readV = new Number(this._readInt(len));
                }else if(dataDefine.type == 'sint'){
                    assertLength();
                    readV = new Number(this._readSInt(len));
                }else if(dataDefine.type == 'hex'){
                    assertLength();
                    readV = new String(this._readHex(len));
                }else if(dataDefine.type == 'string'){
                    if(len > 0){
                        readV = new String(this._readString(len));
                    }else{
                        readV = new String('');
                    }
                }else{
                    throw new Error('unsupport data define:' + prop);
                }
            }
            var end = this.index;
            readV[EXTRA_POSITION_START] =  start;
            readV[EXTRA_POSITION_END] =  end;
            readV[EXTRA_BC_TYPE] = dataDefine.id;
            this.origin[prop]=readV;
            return readV;
        }
        readArray(prop,count,loopFun){
            var arrayStart = this.index;
            var tempNowOrigin = this.origin;
            var array = [];
            for(var i=0;(count==null || i<count);i++){
                var child = {};
                this.origin = child;
                var start = this.index;
                var ret = loopFun(i);
                if(ret == LOOP_CONTINUE){
                    continue;
                }else if(ret == LOOP_BREAK){
                    break;
                }
                var end = this.index;
                child[EXTRA_POSITION_START] = start;
                child[EXTRA_POSITION_END] = end;
                array[i] = child;
            }
            var arrayEnd = this.index;
            this.origin = tempNowOrigin;
            array[EXTRA_POSITION_START] = arrayStart;
            array[EXTRA_POSITION_END] = arrayEnd;
            this.origin[prop]= array;
            return array;
        }
        set(prop,value){
            this.origin[prop]=value;
        }
        setProto(proto){
            Object.setPrototypeOf(this.origin,proto);
        }
        getTree(){
            return this.tree;
        }
        _readInt(size){
            return parseInt(this._readHex(size), 16);
        }
        _readSInt(size){
            var hex = this._readHex(size);
            var intRet = parseInt(hex, 16);
            if(size == 1 && ((intRet & 0x80) == 0x80)){
                intRet = intRet - 0x100;
            }else if (size ==2 && ((intRet & 0x8000) == 0x8000)) {
                intRet = intRet - 0x10000;
            }else if (size ==4 && ((intRet & 0x80000000) == -0x80000000)) { //weird js rule
                intRet = intRet - 0x100000000;
            }
            return intRet;
        }
        _readHex(size){
            return buf2hex(this._slice(size));;
        }
        _readString(size){
            return buf2str(this._slice(size));
        }
        _slice(size){
            if(this.index + size > this.buffer.byteLength){
                throw new Error('read overflow!');
            }
            var newBuf = this.buffer.slice(this.index,this.index + size);
            this.index += size;
            return newBuf;
        }
        getIndex(){
            return this.index;
        }
        readAccFlags(position){
            var hex = this.read('access_flags',BC_HEX,2);
            var readedAccFlags = [];
            for(var key in accFlagsMap){
                var accFlagsDesc = accFlagsMap[key];
                if(accFlagsDesc.position.indexOf(position) > -1 && ("0x"+hex & accFlagsDesc.value) !=0){
                    readedAccFlags.push(key);
                }
            }
            this.set("accFlags",readedAccFlags);
        }
        readAttributes(constantPool){
            var attributesCount = this.read('attributes_count',BC_INT_2);
            var thisObj = this;
            this.readArray("attributes",attributesCount,function(){
                var attributeNameIndex = thisObj.read("attribute_name_index",BC_INDEX);
                var attributeName = constantPool.getUtf8Var(attributeNameIndex);
                var attributeLength = thisObj.read("attribute_length",BC_INT_4);
                var attributeReader = attributeReaders[attributeName];
                if(attributeReader){
                    attributeReader.read(thisObj,attributeLength,constantPool);
                }else{
                    throw new Error("unknown attribute name:" + attributeName);
                }
            });
        }
        readVerificationType(constantPool){
            var tag = this.read("tag",BC_INT_1);
            var verificationTypeReader = verificationTypeReaders.filter(reader => reader.tag == tag)[0];
            if(verificationTypeReader){
                if(verificationTypeReader.read){
                    return verificationTypeReader.read(this,constantPool);
                }
            }else{
                throw new Error("unknown verification type tag:" + tag);
            }
        }
        readAnnotation(){
            this.read('type_index',BC_INDEX);
            var numElementValuePairs = this.read('num_element_value_pairs',BC_INT_2);
            var thisObj = this;
            this.readArray('element_value_pairs',numElementValuePairs,function(){
                thisObj.read('element_name_index',BC_INDEX);
                thisObj.readElementValue();
            });
        }
        readElementValue(){
            var tag = this.read("tag",BC_STRING,1);
            var elementValueTag = elementValueTags[tag];
            if(!elementValueTag){
                throw new Error('unsupport element value tag:' + tag);
            }
            var thisObj = this;
            this.read('value',function(){
                var readMap = {
                    'const_value_index' : function(){
                        thisObj.read("const_value_index",BC_INDEX);
                    },
                    'enum_const_value' : function(){
                        thisObj.read("enum_const_value",function(){
                            thisObj.read('type_name_index',BC_INDEX);
                            thisObj.read('const_name_index',BC_INDEX);
                        });
                    },
                    'class_info_index' : function(){
                        thisObj.read('class_info_index',BC_INDEX);
                    },
                    'annotation_value' : function(){
                        thisObj.read('annotation_value',function(){
                            thisObj.readAnnotation();
                        });
                    },
                    'array_value' : function(){
                        thisObj.read('array_value',function(){
                            var numValues = thisObj.read('num_values',BC_INT_2);
                            thisObj.readArray('values',numValues,function(){
                                thisObj.readElementValue();
                            });
                        });
                    }
                }
                readMap[elementValueTag['item']]();
            });
        }
        readTypeAnnotation(){
            var targetType = this.read("target_type",BC_HEX,1);
            var typeAnnotationTargetType = typeAnnotationTargetTypes[targetType];
            if(!typeAnnotationTargetType){
                throw new Error('unsupport type annotation target type:' + targetType);
            }
            var thisObj = this;
            this.read('target_info',function(){
                var readMap = {
                    'type_parameter_target' : function(){
                        thisObj.read('class_info_index',BC_INT_1);
                    },
                    'supertype_target' : function(){
                        thisObj.read('supertype_index',BC_INT_2);
                    },
                    'type_parameter_bound_target' : function(){
                        thisObj.read('type_parameter_index',BC_INT_1);
                        thisObj.read('bound_index',BC_INT_1);
                    },
                    'empty_target' : function(){},
                    'formal_parameter_target' : function(){
                        thisObj.read('formal_parameter_index',BC_INT_1);
                    },
                    'throws_target' : function(){
                        thisObj.read('throws_type_index',BC_INT_2);
                    },
                    'localvar_target' : function(){
                        var tableLength = thisObj.read('table_length',BC_INT_2);
                        thisObj.readArray('table',tableLength,function(){
                            thisObj.read('start_pc',BC_INT_2);
                            thisObj.read('length',BC_INT_2);
                            thisObj.read('index',BC_INT_2);
                        });
                    },
                    'catch_target' : function(){
                        thisObj.read('exception_table_index',BC_INT_2);
                    },
                    'offset_target' : function(){
                        thisObj.read('offset',BC_INT_2);
                    },
                    'type_argument_target' : function(){
                        thisObj.read('offset',BC_INT_2);
                        thisObj.read('type_argument_index',BC_INT_1);
                    }
                }
                readMap[typeAnnotationTargetType['item']]();
            });
            this.read('target_path',function(){
                var pathLength = thisObj.read('path_length',BC_INT_1);
                thisObj.readArray('path',pathLength,function(){
                    thisObj.read('type_path_kind',BC_INT_1);
                    thisObj.read('type_argument_index',BC_INT_1);
                });
            });
            //type_index, num_element_value_pairs, element_value_pairs[]
            this.readAnnotation();
        } 
    }

    class ConstantPool{
        constants = null;
        constructor(constants){
            this.constants = constants;
        }
        getUtf8Var(index){
            var utf8 = this.getConstant(index);
            if(utf8.getType() == 'Utf8'){
                return utf8['bytes'];
            }else{
                throw new Error("unsupport constant type:" + utf8['type']);
            }
        }
        getClassFromPool(index){
            var constantClass = this.getConstant(index);
            if(constantClass.getType() == 'Class'){
                return this.getUtf8Var(constantClass['name_index']);
            }else{
                throw new Error("unsupport constant type:" + constantClass['type']);
            }
        }
        getConstant(index){
            var ret = this.constants[index];
            if(ret == undefined){
                throw new Error("unknown constant index:" + index);
            }else{
                return ret;
            }
        }
        dig(index){
            var constant = this.getConstant(index);
            var constantReader = constantReaders[constant.tag];
            var digValue;
            if(constantReader.dig){
                digValue = constantReader.dig(constant,this);
            }else{
                digValue = constant;
            }
            return digValue;
        }
    }

    var constantReaders  =  {
        7 : {
            'type' : 'Class',
            'read' : function(reader){
                reader.read('name_index',BC_INDEX);
            },
            'dig' : function(constant,pool){
                var index = constant['name_index'];
                return pool.getUtf8Var(index);
            }
        },
        9 : {
            'type' : 'Fieldref',
            'read' : function(reader){
                reader.read('name_index',BC_INDEX);
                reader.read('descriptor_index',BC_INDEX);
            },
            'dig' : function(constant,pool){
                return pool.dig(constant['name_index']) + "." + pool.dig(constant['descriptor_index']);
            }
        },
        10: {
            'type' : 'Methodref',
            'read' : function(reader){
                reader.read('class_index',BC_INDEX);
                reader.read('name_and_type_index',BC_INDEX);
            },
            'dig' : function(constant,pool){
                return pool.dig(constant['class_index']) + "." + pool.dig(constant['name_and_type_index']);
            }
        },
        11: {
            'type' : 'InterfaceMethodref',
            'read': function(reader){
                reader.read('class_index',BC_INDEX);
                reader.read('name_and_type_index',BC_INDEX);
            },
            'dig' : function(constant,pool){
                return pool.dig(constant['class_index']) + "." + pool.dig(constant['name_and_type_index']);
            }
        },
        8: {
            'type' : 'String',
            'read': function(reader){
                reader.read('string_index',BC_INDEX);
            },
            'dig' : function(constant,pool){
                return pool.getUtf8Var(constant['string_index']);
            }
        },
        3: {
            'type' : 'Integer',
            'read': function(reader){
                reader.read('bytes',BC_INT_4);
            },
            'dig' : function(constant,pool){
                return "(int)"+constant['bytes'];
            }
        },
        4: {
            'type' : 'Float',
            'read': function(reader){
                reader.read('bytes',BC_HEX,4);
            },
            'dig' : function(constant,pool){
                var a = BigInt("0x" + constant['bytes']);
                var sign = (a & BigInt("0x80000000")) != 0;
                var fraction = a & BigInt("0x7fffff");
                var exponent = Number((a & BigInt("0x7f800000")) >> BigInt(23));
                var result;
                if(exponent == 0xff){
                    if(fraction == 0){
                        result =   sign  ? "-Infinity" : "Infinity";
                    }else{
                        result = "NaN";
                    }
                }else{
                    if(exponent == 0){
                        if(fraction == 0){
                            result = sign ? "-0" : "0"; 
                        }
                        exponent += 1;
                    }else{
                        fraction |= BigInt("0x800000");
                    }
                    var signChar = sign ? "-" : "";
                    result =  (signChar + (Number(fraction) * Math.pow(2,exponent - 127 - 23)));
                }
                return "(float)" + result;
            }
        },
        5: {
            'type' : 'Long',
            'read': function(reader){
                reader.read('high_bytes',BC_HEX,4);
                reader.read('low_bytes',BC_HEX,4);
            },
            'dig' : function(constant,pool){
                var bint = BigInt("0x" + constant['high_bytes'] + constant['low_bytes']);
                if((bint & BigInt("0x8000000000000000")) == BigInt("0x8000000000000000")){
                    return "(long)" + (bint - BigInt("0x10000000000000000")).toString();
                }else{
                    return "(long)" + bint.toString();
                }
            }
        },
        6: {
            'type' : 'Double',
            'read': function(reader){
                reader.read('high_bytes',BC_HEX,4);
                reader.read('low_bytes',BC_HEX,4);
            },
            'dig' : function(constant,pool){
                var a = BigInt("0x" + constant['high_bytes'] + constant['low_bytes']);
                var sign = (a & BigInt("0x8000000000000000")) != 0;
                var fraction = a & BigInt("0xfffffffffffff");
                var exponent = Number((a & BigInt("0x7ff0000000000000")) >> BigInt(52));
                var result;
                if(exponent == 0x7ff){
                    if(fraction == 0){
                        result =   sign  ? "-Infinity" : "Infinity";
                    }else{
                        result = "NaN";
                    }
                }else{
                    if(exponent == 0){
                        if(fraction == 0){
                            result = sign ? "-0" : "0"; 
                        }
                        exponent += 1;
                    }else{
                        fraction |= BigInt("0x10000000000000");
                    }
                    var signChar = sign ? "-" : "";
                    result =  (signChar + (Number(fraction) * Math.pow(2,exponent - 1023 - 52)));
                }
                return "(double)" + result;
            }
        },
        12: {
            'type' : 'NameAndType',
            'read' : function(reader){
                reader.read('name_index',BC_INDEX);
                reader.read('descriptor_index',BC_INDEX);
            },
            'dig' : function(constant,pool){
                return pool.getUtf8Var(constant["name_index"]) + ":" + pool.getUtf8Var(constant["descriptor_index"]);
            }
        },
        1: {
            'type' : 'Utf8',
            'read' : function(reader){
                var length = reader.read('length',BC_INT_2);
                reader.read('bytes',BC_STRING,length);
            },
            'dig' : function(constant,pool){
                return constant['bytes'];
            }
        },
        15: {
            'type' : 'MethodHandle',
            'read' : function(reader){
                reader.read('reference_kind',BC_INT_1);
                reader.read('reference_index',BC_INDEX);
            },
            'dig' : function(constant,pool){
                var handles = {1:'getField',
                               2:'getStatic',
                               3:'putField',
                               4:'putStatic',
                               5:'invokeVirtual',
                               6:'invokeStatic',
                               7:'invokeSpecial',
                               8:'newInvokeSpecial',
                               9:'invokeInterface'
                            };
                return handles[constant['reference_kind']] +" "+ pool.dig(constant['reference_index']);
            }
        },
        16: {
            'type' : 'MethodType',
            'read' : function(reader){
                reader.read('descriptor_index',BC_INDEX);
            },
            'dig' : function(constant,pool){
                return pool.getUtf8Var(constant["descriptor_index"]);
            }
        },
        18: {
            'type' : 'InvokeDynamic',
            'read' : function(reader){
                reader.read('bootstrap_method_attr_index',BC_INT_2);
                reader.read('name_and_type_index',BC_INDEX);
            },
            'dig' : function(constant,pool){
                return "#" + constant['bootstrap_method_attr_index'] + ":" + pool.dig(constant['name_and_type_index']);
            }
        }
    };

    var accFlagsMap = {
        'ACC_PUBLIC' : {'value' : 0x0001,'position':[ACC_CLASS,ACC_FIELD,ACC_METHOD,ACC_INNER_CLASS]},
        'ACC_PRIVATE' : {'value' : 0x0002,'position': [ACC_FIELD,ACC_METHOD,ACC_INNER_CLASS]},
        'ACC_PROTECTED' : {'value' : 0x0004,'position' : [ACC_FIELD,ACC_METHOD,ACC_INNER_CLASS]},
        'ACC_STATIC' : {'value' : 0x0008,'position' : [ACC_FIELD,ACC_METHOD,ACC_INNER_CLASS]},
        'ACC_FINAL' : {'value' : 0x0010,'position' : [ACC_CLASS,ACC_FIELD,ACC_METHOD,ACC_INNER_CLASS,ACC_METHOD_PARAMETER]},
        'ACC_SUPER' : {'value' : 0x0020,'position' : [ACC_CLASS]},
        'ACC_SYNCHRONIZED' : {'value' : 0x0020,'position' : [ACC_METHOD]},//duplicate
        'ACC_VOLATILE' : {'value' : 0x0040,'position' : [ACC_FIELD]},
        'ACC_BRIDGE' : {'value' : 0x0040,'position' : [ACC_METHOD]},//duplicate
        'ACC_TRANSIENT' :  {'value' : 0x0080,'position' :[ACC_FIELD]},
        'ACC_VARARGS' :  {'value' : 0x0080,'position' :[ACC_METHOD]},//duplicate
        'ACC_NATIVE' :  {'value' : 0x0100,'position' :[ACC_METHOD]},
        'ACC_INTERFACE' : {'value' : 0x0200,'position' :[ACC_CLASS,ACC_INNER_CLASS]},
        'ACC_ABSTRACT' :  {'value' : 0x0400,'position' : [ACC_CLASS,ACC_METHOD,ACC_INNER_CLASS]},
        'ACC_STRICT' : {'value' : 0x0800,'position' : [ACC_METHOD]},
        'ACC_SYNTHETIC' : {'value' : 0x1000,'position' : [ACC_CLASS,ACC_FIELD,ACC_METHOD,ACC_INNER_CLASS,ACC_METHOD_PARAMETER]},
        'ACC_ANNOTATION' : {'value' :0x2000,'position' : [ACC_CLASS,ACC_INNER_CLASS]},
        'ACC_ENUM' : {'value' :0x4000,'position' : [ACC_CLASS,ACC_FIELD,ACC_INNER_CLASS]},
        'ACC_MANDATED' : {'value' :0x8000,'position' : [ACC_METHOD_PARAMETER]}
    }

    function assertLength(length,targetLength){
        if(length != targetLength){
            throw new Error("unsupport attribute length:" + length);
        }
    }

    var attributeReaders  =  {
        'SourceFile' : {
            'read' : function(reader,length,constantPool){
                assertLength(length, 2);
                reader.read("sourcefile_index",BC_INT_2);
            }
        },
        'InnerClasses' : {
            'read' : function(reader,length,constantPool){
                var numberOfClasses = reader.read("number_of_classes",BC_INT_2);
                reader.readArray('classes',numberOfClasses,function(){
                    reader.read("inner_class_info_index",BC_INDEX);
                    reader.read("outer_class_info_index",BC_INDEX);
                    reader.read("inner_name_index",BC_INDEX);
                    reader.readAccFlags(ACC_INNER_CLASS);
                });
            }
        },
        'EnclosingMethod' : {
            'read' : function(reader,length,constantPool){
                reader.read("class_index",BC_INT_2);
                reader.read("method_index",BC_INT_2);
            }
        },
        'SourceDebugExtension' : {
            'read' : function(reader,length,constantPool){
                reader.read("debug_extension",BC_STRING,length);
            }
        },
        'BootstrapMethods' : {
            'read' : function(reader,length,constantPool){
                var numBootstrapMethods = reader.read("num_bootstrap_methods",BC_INT_2);
                reader.readArray('bootstrap_methods',numBootstrapMethods,function(){
                    reader.read("bootstrap_method_ref",BC_INDEX);
                    var numBootstrapArguments = reader.read("num_bootstrap_arguments",BC_INT_2);
                    reader.readArray('bootstrap_arguments',numBootstrapArguments,function(){
                        reader.read("argument",BC_INDEX);
                    });
                });
            }
        },
        'ConstantValue' : {
            'read' : function(reader,length,constantPool){
                reader.read("constantvalue_index",BC_INT_2);
            } 
        },
        'Code' : {
            'read' : function(reader,length,constantPool){
                var maxStack = reader.read("max_stack",BC_INT_2);
                var maxLocals = reader.read("max_locals",BC_INT_2);
                var codeLength = reader.read("code_length",BC_INT_4);
                var codeStartIndex = reader.getIndex();
                reader.readArray('codes',null,function(){
                    if(reader.getIndex() >= codeStartIndex + codeLength){
                        return LOOP_BREAK;
                    }
                    var pc = reader.getIndex() - codeStartIndex;
                    reader.set("pc",pc);
                    var opcodeV = reader.read('opcode',BC_INT_1);
                    var op = opcodes[opcodeV];
                    if(op){
                        reader.setProto(codeProto);
                        var operandFormat = op.v;
                        if(operandFormat){
                            if(Array.isArray(operandFormat) && operandFormat.length > 0){
                                reader.readArray("operands",operandFormat.length,function(index){
                                    reader.read("value",operandFormat[index]);
                                });
                            }else if(typeof operandFormat == 'function'){
                                reader.read("operandExt",function(){
                                    operandFormat(reader,pc);
                                });
                            }
                        }else if(op.c > 0){
                            throw new Error("no operand value defined:" + op.opcode);
                        }
                    }else{
                        throw new Error("unknown opcode:"+opcodeV);
                    }
                });
                if(reader.getIndex() - codeStartIndex != codeLength){
                    throw new Error("read code overflow");
                }
                var exceptionTableLength = reader.read('exception_table_length',BC_INT_2);
                reader.readArray('exception_table',exceptionTableLength,function(){
                    reader.read('start_pc',BC_INT_2);
                    reader.read('end_pc',BC_INT_2);
                    reader.read('handler_pc',BC_INT_2);
                    reader.read('catch_type_index',BC_INDEX);
                });
                reader.readAttributes(constantPool);
            }
        },
        'Exceptions': {
            'read' : function(reader,length,constantPool){
                var numberOfExceptions = reader.read("number_of_exceptions",BC_INT_2);
                reader.readArray("exception_index_table",numberOfExceptions,function(){
                    reader.read('index',BC_INT_2);
                })
            }
        },
        'RuntimeVisibleParameterAnnotations': {
            'read' : function(reader,length,constantPool){
                var numParameters = reader.read("num_parameters",BC_INT_1);
                reader.readArray('parameter_annotations',numParameters,function(){
                    var numAnnotations = reader.read("num_annotations",BC_INT_2);
                    reader.readArray("annotations",numAnnotations,function(){
                        reader.readAnnotation();
                    });
                });
            }
        },
        'RuntimeInvisibleParameterAnnotations' : {
            'read' : function(reader,length,constantPool){
                attributeReaders['RuntimeVisibleParameterAnnotations'].read(reader,length,constantPool);
            }
        },
        'AnnotationDefault' : {
            'read' : function(reader,length,constantPool){
                reader.readElementValue();
            }
        },
        'MethodParameters' : {
            'read' : function(reader,length,constantPool){
                var parametersCount = reader.read("parameters_count",BC_INT_1);
                reader.readArray("parameters",parametersCount,function(){
                    reader.read('name_index',BC_INDEX);
                    reader.readAccFlags(ACC_METHOD_PARAMETER);
                });
            }
        },
        'Synthetic' : {
            'read' : function(reader,length,constantPool){
                assertLength(length, 0);
            }
        },
        'Deprecated' : {
            'read' : function(reader,length,constantPool){
                assertLength(length, 0);
            }
        },
        'Signature' : {
            'read' : function(reader,length,constantPool){
                assertLength(length, 2);
                reader.read("signature_index",BC_INDEX);
            }
        },
        'RuntimeVisibleAnnotations': {
            'read' : function(reader,length,constantPool){
                var numAnnotations = reader.read("num_annotations",BC_INT_2);
                reader.readArray("annotations",numAnnotations,function(){
                    reader.readAnnotation();
                });
            }
        },
        'RuntimeInvisibleAnnotations' : {
            'read' : function(reader,length,constantPool){
                attributeReaders['RuntimeVisibleAnnotations'].read(reader,length,constantPool);
            }
        },
        'LineNumberTable' : {
            'read' : function(reader,length,constantPool){
                var lineNumberTableLength = reader.read("lineNumber_table_length",BC_INT_2);
                reader.readArray('line_number_table',lineNumberTableLength,function(){
                    reader.read("start_pc",BC_INT_2);
                    reader.read("line_number",BC_INT_2);
                });
            }
        },
        'LocalVariableTable' : {
            'read' : function(reader,length,constantPool){
                var localVariableTableLength = reader.read("local_variable_table_length",BC_INT_2);
                reader.readArray("local_variable_table",localVariableTableLength,function(){
                    reader.read("start_pc",BC_INT_2);
                    reader.read("length",BC_INT_2);
                    reader.read("name_index",BC_INT_2);
                    reader.read("descriptor_index",BC_INT_2);
                    reader.read("index",BC_INT_2);
                });
            }
        },
        'LocalVariableTypeTable' : {
            'read' : function(reader,length,constantPool){
                var localVariableTypeTableLength = reader.read("local_variable_type_table_length",BC_INT_2);
                reader.readArray("local_variable_type_table",localVariableTypeTableLength,function(){
                    reader.read("start_pc",BC_INT_2);
                    reader.read("length",BC_INT_2);
                    reader.read("name_index",BC_INT_2);
                    reader.read("signature_index",BC_INT_2);
                    reader.read("index",BC_INT_2);
                });
            }
        },
        'StackMapTable' : {
            'read' : function(reader,length,constantPool){
                var numberOfEntries = reader.read("number_of_entries",BC_INT_2);
                reader.readArray("entries",numberOfEntries,function(){
                    var tag = reader.read("tag",BC_INT_1);
                    var stackMapReader = stackMapReaders.filter(reader => reader.min <= tag && reader.max >= tag)[0];
                    if(stackMapReader){
                        stackMapReader.read(tag,reader,constantPool);
                    }else{
                        throw new Error("unknown StackMap tag:" + tag);
                    }
                });
            }
        },
        'RuntimeVisibleTypeAnnotations' : {
            'read' : function(reader,length,constantPool){
                var numAnnotations = reader.read("num_annotations",BC_INT_2);
                reader.readArray("annotations",numAnnotations,function(){
                    reader.readTypeAnnotation();
                });
            }
        },
        'RuntimeInvisibleTypeAnnotations' : {
            'read' : function(reader,length,constantPool){
                attributeReaders['RuntimeVisibleTypeAnnotations'].read(reader,length,constantPool);
            }
        }
    };


    var stackMapReaders  =  [{
            'min' : 0,
            'max' : 63,
            'type' : 'SAME',
            'read' : function(value,reader){
                reader.set("offset_delta",value);
            }
        },{
            'min' : 64,
            'max' : 127,
            'type' : 'SAME_LOCALS_1_STACK_ITEM',
            'read' : function(value,reader,constantPool){
                reader.set("offset_delta",value - 64);
                reader.read("stack",function(){
                    reader.readVerificationType(constantPool)
                });
            }
        },{
            'min' : 247,
            'max' : 247,
            'type' : 'SAME_LOCALS_1_STACK_ITEM_EXTENDED',
            'read' : function(value,reader,constantPool){
                reader.read("offset_delta",BC_INT_2);
                reader.read("stack",function(){
                    reader.readVerificationType(constantPool)
                });
            }
        },{
            'min' : 248,
            'max' : 250,
            'type' : 'CHOP',
            'read' : function(value,reader){
                reader.set("k",251 - value);
                reader.read("offset_delta",BC_INT_2);
            }
        },{
            'min' : 251,
            'max' : 251,
            'type' : 'SAME_FRAME_EXTENDED',
            'read' : function(value,reader){
                reader.read("offset_delta",BC_INT_2);
            }
        },{
            'min' : 252,
            'max' : 254,
            'type' : 'APPEND',
            'read' : function(value,reader,constantPool){
                var offsetDelta = reader.read("offset_delta",BC_INT_2);
                var k = value - 251;
                reader.readArray('locals',k,function(){
                    reader.readVerificationType(constantPool)
                });
            }
        },{
            'min' : 255,
            'max' : 255,
            'type' : 'FULL_FRAME',
            'read' : function(value,reader,constantPool){
                var offsetDelta = reader.read("offset_delta",BC_INT_2);
                var numberOfLocals = reader.read("number_of_locals",BC_INT_2);
                reader.readArray('locals',numberOfLocals,function(){
                    reader.readVerificationType(constantPool)
                });
                var numberOfStackItems = reader.read("number_of_stack_items",BC_INT_2);
                reader.readArray('stack',numberOfStackItems,function(){
                    reader.readVerificationType(constantPool)
                });
            }
        }
    ];

    var verificationTypeReaders = [{
            'tag' : 0,
            'type' : 'ITEM_Top'
        },{
            'tag' : 1,
            'type' : 'ITEM_Integer'
        },{
            'tag' : 2,
            'type' : 'ITEM_Float'
        },{
            'tag' : 5,
            'type' : 'ITEM_Null'
        },{
            'tag' : 6,
            'type' : 'ITEM_UninitializedThis'
        },{
            'tag' : 7,
            'type' : 'ITEM_Object',
            'read' : function(reader,constantPool){
                reader.read("cpool_index",BC_INT_2);
            }
        },{
            'tag' : 8,
            'type' : 'ITEM_Uninitialized',
            'read' : function(reader,constantPool){
                reader.read("offset",BC_INT_2);
            }
        },{
            'tag' : 4,
            'type' : 'ITEM_Long'
        },{
            'tag' : 3,
            'type' : 'ITEM_Double'
        }
    ];

    var elementValueTags = {
        'B' : {'type':'byte','item': 'const_value_index','constantType': 'CONSTANT_Integer'},
        'C'	: {'type':'char','item': 'const_value_index','constantType': 'CONSTANT_Integer'},
        'D' : {'type':'double','item': 'const_value_index','constantType': 'CONSTANT_Double'},
        'F'	: {'type':'float','item': 'const_value_index','constantType': 'CONSTANT_Float'},
        'I'	: {'type':'int','item': 'const_value_index','constantType': 'CONSTANT_Integer'},
        'J'	: {'type':'long','item': 'const_value_index','constantType': 'CONSTANT_Long'},
        'S'	: {'type':'short','item': 'const_value_index','constantType': 'CONSTANT_Integer'},
        'Z'	: {'type':'boolean','item': 'const_value_index','constantType': 'CONSTANT_Integer'},
        's'	: {'type':'String','item': 'const_value_index','constantType': 'CONSTANT_Utf8'},
        'e'	: {'type':'Enum type','item': 'enum_const_value'},
        'c'	: {'type':'Class','item': 'class_info_index'},
        '@'	: {'type':'Annotation type','item': 'annotation_value'},
        '['	: {'type':'Array type','item': 'array_value'}
    };

    var typeAnnotationTargetTypes = {
        '00': {"item":"type_parameter_target"},
        '01': {"item":"type_parameter_target"},
        '10': {"item":"supertype_target"},
        '11': {"item":"type_parameter_bound_target"},
        '12': {"item":"type_parameter_bound_target"},
        '13': {"item":"empty_target"},
        '14': {"item":"empty_target"},
        '15': {"item":"empty_target"},
        '16': {"item":"formal_parameter_target"},
        '17': {"item":"throws_target"},
        '40': {"item":"localvar_target"},
        '41': {"item":"localvar_target"},
        '42': {"item":"catch_target"},
        '43': {"item":"offset_target"},
        '44': {"item":"offset_target"},
        '45': {"item":"offset_target"},
        '46': {"item":"offset_target"},
        '47': {"item":"type_argument_target"},
        '48': {"item":"type_argument_target"},
        '49': {"item":"type_argument_target"},
        '4A': {"item":"type_argument_target"},
        '4B': {"item":"type_argument_target"}
    };

    var OpFormats = {
        'oneIndex' : [BC_INDEX],
        'branch' : [BC_SINT_2],
        'wideBranch' : [BC_SINT_4],
        'touchFrame' : [BC_INT_1]
    }

    var opcodes = {
        0:{"opcode":"nop","c":0},
        1:{"opcode":"aconst_null","c":0},
        2:{"opcode":"iconst_m1","c":0},
        3:{"opcode":"iconst_0","c":0},
        4:{"opcode":"iconst_1","c":0},
        5:{"opcode":"iconst_2","c":0},
        6:{"opcode":"iconst_3","c":0},
        7:{"opcode":"iconst_4","c":0},
        8:{"opcode":"iconst_5","c":0},
        9:{"opcode":"lconst_0","c":0},
        10:{"opcode":"lconst_1","c":0},
        11:{"opcode":"fconst_0","c":0},
        12:{"opcode":"fconst_1","c":0},
        13:{"opcode":"fconst_2","c":0},
        14:{"opcode":"dconst_0","c":0},
        15:{"opcode":"dconst_1","c":0},
        16:{"opcode":"bipush","c":1,"v":[BC_SINT_1]},
        17:{"opcode":"sipush","c":2,"v":[BC_SINT_2]},
        18:{"opcode":"ldc","c":1,"v":[BC_INDEX_SHORT]},
        19:{"opcode":"ldc_w","c":2,"v":OpFormats.oneIndex},
        20:{"opcode":"ldc2_w","c":2,"v":OpFormats.oneIndex},
        21:{"opcode":"iload","c":1,"v":OpFormats.touchFrame},
        22:{"opcode":"lload","c":1,"v":OpFormats.touchFrame},
        23:{"opcode":"fload","c":1,"v":OpFormats.touchFrame},
        24:{"opcode":"dload","c":1,"v":OpFormats.touchFrame},
        25:{"opcode":"aload","c":1,"v":OpFormats.touchFrame},
        26:{"opcode":"iload_0","c":0},
        27:{"opcode":"iload_1","c":0},
        28:{"opcode":"iload_2","c":0},
        29:{"opcode":"iload_3","c":0},
        30:{"opcode":"lload_0","c":0},
        31:{"opcode":"lload_1","c":0},
        32:{"opcode":"lload_2","c":0},
        33:{"opcode":"lload_3","c":0},
        34:{"opcode":"fload_0","c":0},
        35:{"opcode":"fload_1","c":0},
        36:{"opcode":"fload_2","c":0},
        37:{"opcode":"fload_3","c":0},
        38:{"opcode":"dload_0","c":0},
        39:{"opcode":"dload_1","c":0},
        40:{"opcode":"dload_2","c":0},
        41:{"opcode":"dload_3","c":0},
        42:{"opcode":"aload_0","c":0},
        43:{"opcode":"aload_1","c":0},
        44:{"opcode":"aload_2","c":0},
        45:{"opcode":"aload_3","c":0},
        46:{"opcode":"iaload","c":0},
        47:{"opcode":"laload","c":0},
        48:{"opcode":"faload","c":0},
        49:{"opcode":"daload","c":0},
        50:{"opcode":"aaload","c":0},
        51:{"opcode":"baload","c":0},
        52:{"opcode":"caload","c":0},
        53:{"opcode":"saload","c":0},
        54:{"opcode":"istore","c":1,"v":OpFormats.touchFrame},
        55:{"opcode":"lstore","c":1,"v":OpFormats.touchFrame},
        56:{"opcode":"fstore","c":1,"v":OpFormats.touchFrame},
        57:{"opcode":"dstore","c":1,"v":OpFormats.touchFrame},
        58:{"opcode":"astore","c":1,"v":OpFormats.touchFrame},
        59:{"opcode":"istore_0","c":0},
        60:{"opcode":"istore_1","c":0},
        61:{"opcode":"istore_2","c":0},
        62:{"opcode":"istore_3","c":0},
        63:{"opcode":"lstore_0","c":0},
        64:{"opcode":"lstore_1","c":0},
        65:{"opcode":"lstore_2","c":0},
        66:{"opcode":"lstore_3","c":0},
        67:{"opcode":"fstore_0","c":0},
        68:{"opcode":"fstore_1","c":0},
        69:{"opcode":"fstore_2","c":0},
        70:{"opcode":"fstore_3","c":0},
        71:{"opcode":"dstore_0","c":0},
        72:{"opcode":"dstore_1","c":0},
        73:{"opcode":"dstore_2","c":0},
        74:{"opcode":"dstore_3","c":0},
        75:{"opcode":"astore_0","c":0},
        76:{"opcode":"astore_1","c":0},
        77:{"opcode":"astore_2","c":0},
        78:{"opcode":"astore_3","c":0},
        79:{"opcode":"iastore","c":0},
        80:{"opcode":"lastore","c":0},
        81:{"opcode":"fastore","c":0},
        82:{"opcode":"dastore","c":0},
        83:{"opcode":"aastore","c":0},
        84:{"opcode":"bastore","c":0},
        85:{"opcode":"castore","c":0},
        86:{"opcode":"sastore","c":0},
        87:{"opcode":"pop","c":0},
        88:{"opcode":"pop2","c":0},
        89:{"opcode":"dup","c":0},
        90:{"opcode":"dup_x1","c":0},
        91:{"opcode":"dup_x2","c":0},
        92:{"opcode":"dup2","c":0},
        93:{"opcode":"dup2_x1","c":0},
        94:{"opcode":"dup2_x2","c":0},
        95:{"opcode":"swap","c":0},
        96:{"opcode":"iadd","c":0},
        97:{"opcode":"ladd","c":0},
        98:{"opcode":"fadd","c":0},
        99:{"opcode":"dadd","c":0},
        100:{"opcode":"isub","c":0},
        101:{"opcode":"lsub","c":0},
        102:{"opcode":"fsub","c":0},
        103:{"opcode":"dsub","c":0},
        104:{"opcode":"imul","c":0},
        105:{"opcode":"lmul","c":0},
        106:{"opcode":"fmul","c":0},
        107:{"opcode":"dmul","c":0},
        108:{"opcode":"idiv","c":0},
        109:{"opcode":"ldiv","c":0},
        110:{"opcode":"fdiv","c":0},
        111:{"opcode":"ddiv","c":0},
        112:{"opcode":"irem","c":0},
        113:{"opcode":"lrem","c":0},
        114:{"opcode":"frem","c":0},
        115:{"opcode":"drem","c":0},
        116:{"opcode":"ineg","c":0},
        117:{"opcode":"lneg","c":0},
        118:{"opcode":"fneg","c":0},
        119:{"opcode":"dneg","c":0},
        120:{"opcode":"ishl","c":0},
        121:{"opcode":"lshl","c":0},
        122:{"opcode":"ishr","c":0},
        123:{"opcode":"lshr","c":0},
        124:{"opcode":"iushr","c":0},
        125:{"opcode":"lushr","c":0},
        126:{"opcode":"iand","c":0},
        127:{"opcode":"land","c":0},
        128:{"opcode":"ior","c":0},
        129:{"opcode":"lor","c":0},
        130:{"opcode":"ixor","c":0},
        131:{"opcode":"lxor","c":0},
        132:{"opcode":"iinc","c":2,"v":[BC_INT_1,BC_SINT_1]},
        133:{"opcode":"i2l","c":0},
        134:{"opcode":"i2f","c":0},
        135:{"opcode":"i2d","c":0},
        136:{"opcode":"l2i","c":0},
        137:{"opcode":"l2f","c":0},
        138:{"opcode":"l2d","c":0},
        139:{"opcode":"f2i","c":0},
        140:{"opcode":"f2l","c":0},
        141:{"opcode":"f2d","c":0},
        142:{"opcode":"d2i","c":0},
        143:{"opcode":"d2l","c":0},
        144:{"opcode":"d2f","c":0},
        145:{"opcode":"i2b","c":0},
        146:{"opcode":"i2c","c":0},
        147:{"opcode":"i2s","c":0},
        148:{"opcode":"lcmp","c":0},
        149:{"opcode":"fcmpl","c":0},
        150:{"opcode":"fcmpg","c":0},
        151:{"opcode":"dcmpl","c":0},
        152:{"opcode":"dcmpg","c":0},
        153:{"opcode":"ifeq","c":2,"v":OpFormats.branch},
        154:{"opcode":"ifne","c":2,"v":OpFormats.branch},
        155:{"opcode":"iflt","c":2,"v":OpFormats.branch},
        156:{"opcode":"ifge","c":2,"v":OpFormats.branch},
        157:{"opcode":"ifgt","c":2,"v":OpFormats.branch},
        158:{"opcode":"ifle","c":2,"v":OpFormats.branch},
        159:{"opcode":"if_icmpeq","c":2,"v":OpFormats.branch},
        160:{"opcode":"if_icmpne","c":2,"v":OpFormats.branch},
        161:{"opcode":"if_icmplt","c":2,"v":OpFormats.branch},
        162:{"opcode":"if_icmpge","c":2,"v":OpFormats.branch},
        163:{"opcode":"if_icmpgt","c":2,"v":OpFormats.branch},
        164:{"opcode":"if_icmple","c":2,"v":OpFormats.branch},
        165:{"opcode":"if_acmpeq","c":2,"v":OpFormats.branch},
        166:{"opcode":"if_acmpne","c":2,"v":OpFormats.branch},
        167:{"opcode":"goto","c":2,"v":OpFormats.branch},
        168:{"opcode":"jsr","c":2,"v":OpFormats.branch}, //been disabled when class version number is 51.0 or above
        169:{"opcode":"ret","c":1,"v":OpFormats.touchFrame}, 
        170:{"opcode":"tableswitch","c":-1,"v":function(reader,pc){
            var padLen = (4-((pc+1) % 4))%4;
            if(padLen > 0){
                reader.read("pad",BC_HEX,padLen);
            }
            reader.read("default",BC_SINT_4);
            var low = reader.read("low",BC_SINT_4);
            var high = reader.read("high",BC_SINT_4);
            reader.readArray("offsets",high-low+1,function(){
                reader.read("value",BC_SINT_4);
            });
        }},
        171:{"opcode":"lookupswitch","c":-1,"v":function(reader,pc){
            var padLen = (4-((pc+1) % 4))%4;
            if(padLen > 0){
                reader.read("pad",BC_HEX,padLen);
            }
            reader.read("default",BC_SINT_4);
            var npairs = reader.read("npairs",BC_SINT_4);
            reader.readArray("pairs",npairs,function(){
                reader.read("A",BC_SINT_4);
                reader.read("B",BC_SINT_4);
            });
        }},
        172:{"opcode":"ireturn","c":0},
        173:{"opcode":"lreturn","c":0},
        174:{"opcode":"freturn","c":0},
        175:{"opcode":"dreturn","c":0},
        176:{"opcode":"areturn","c":0},
        177:{"opcode":"return","c":0},
        178:{"opcode":"getstatic","c":2,"v":OpFormats.oneIndex},
        179:{"opcode":"putstatic","c":2,"v":OpFormats.oneIndex},
        180:{"opcode":"getfield","c":2,"v":OpFormats.oneIndex},
        181:{"opcode":"putfield","c":2,"v":OpFormats.oneIndex},
        182:{"opcode":"invokevirtual","c":2,"v":OpFormats.oneIndex},
        183:{"opcode":"invokespecial","c":2,"v":OpFormats.oneIndex},
        184:{"opcode":"invokestatic","c":2,"v":OpFormats.oneIndex},
        185:{"opcode":"invokeinterface","c":4,"v":[BC_INDEX,BC_INT_1,BC_INT_1]},
        186:{"opcode":"invokedynamic","c":4,"v":[BC_INDEX,BC_INT_2]},
        187:{"opcode":"new","c":2,"v":OpFormats.oneIndex},
        188:{"opcode":"newarray","c":1,"v":[BC_INT_1]},
        189:{"opcode":"anewarray","c":2,"v":OpFormats.oneIndex},
        190:{"opcode":"arraylength","c":0},
        191:{"opcode":"athrow","c":0},
        192:{"opcode":"checkcast","c":2,"v":OpFormats.oneIndex},
        193:{"opcode":"instanceof","c":2,"v":OpFormats.oneIndex},
        194:{"opcode":"monitorenter","c":0},
        195:{"opcode":"monitorexit","c":0},
        196:{"opcode":"wide","c":-1,"v":function(reader,pc){
            var opcodeV = reader.read('opcode',BC_INT_1);
            var op = opcodes[opcodeV];
            reader.setProto(codeProto);
            reader.read('index',BC_INT_2);
            if(op.opcode == 'iinc'){
                reader.read('const',BC_SINT_2);
            }
        }},
        197:{"opcode":"multianewarray","c":3,"v":[BC_INDEX,BC_INT_1]},
        198:{"opcode":"ifnull","c":2,"v":OpFormats.branch},
        199:{"opcode":"ifnonnull","c":2,"v":OpFormats.branch},
        200:{"opcode":"goto_w","c":4,"v":OpFormats.wideBranch},
        201:{"opcode":"jsr_w","c":4,"v":OpFormats.wideBranch}, //been disabled when class version number is 51.0 or above
        202:{"opcode":"breakpoint","c":0},
        254:{"opcode":"impdep1","c":0},
        255:{"opcode":"impdep2","c":0}
    }

    var returnObj = {};
    returnObj.readBuffer = readBuffer;
    returnObj.read = function(file,callback,errorCallback){
        var reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = function (event) {
            var buffer = event.target.result;
            var result;
            try{
                result = readBuffer(buffer);
            }catch(e){
                errorCallback(e);
                return;
            }
            callback(buffer,result);
        }
    }
    returnObj.position = function(val){
        return {
            'start' : val[EXTRA_POSITION_START],
            'end' : val[EXTRA_POSITION_END]
        }
    }
    returnObj.typeof = function(val){
        return BC_TYPES[val[EXTRA_BC_TYPE]]
    }
    returnObj.buf2hex = buf2hex;
    returnObj.buf2str = buf2str;
    return returnObj;
})));