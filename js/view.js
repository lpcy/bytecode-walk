window.onload = function(){
    var arrayBuffer;
    var readFile = function(file){
        var fileInfoEle = document.getElementById('fileInfo');
        BCParser.read(file,async function(buffer,result){
            arrayBuffer = buffer;
            console.log(result.tree);
            fileInfoEle.innerText = file.name;
            document.getElementById('fileContainer').classList.add('full');
            showHex(arrayBuffer);
            var html = await BCRender.render(BCParser,jsrender,result);
            document.getElementById('res').innerHTML = html;
        },function(error){
            fileInfoEle.innerHTML = error.message + '<br/> Please select one .class file again.';
        });
    }
    document.getElementById("bcFile").onchange = function(){
        var file = this.files[0];
        if(file){
            readFile(file);
        }
    }
    document.getElementById('res').addEventListener("click",function(event){
        clearHighlight();
        var hitEle = event.target.closest('[data-s]');
        if(hitEle){
            var start = parseInt(hitEle.dataset.s);
            var end = parseInt(hitEle.dataset.e);
            highlightHex(arrayBuffer,start,end-1);
        }
    });
}

function showHex(arrayBuffer){
    var fContentEle = document.getElementById('fContent');
    fContentEle.innerHTML = '';
    var length = arrayBuffer.byteLength;
    for(var i=0;i<length;i+=16){
        var pLine = document.createElement('p');
        pLine.classList.add('f-line');
        var indexSpan = document.createElement('span');
        indexSpan.innerText = i;
        indexSpan.classList.add('f-index');
        var codeSpan = document.createElement('span');
        codeSpan.classList.add('f-code');
        var lineBuf = arrayBuffer.slice(i,i+16);
        showHexLine(codeSpan,lineBuf);
        var strSpan = document.createElement('span');
        strSpan.classList.add('f-str');
        strSpan.innerHTML = BCParser.buf2str(lineBuf);
        pLine.appendChild(indexSpan);
        pLine.appendChild(codeSpan);
        pLine.appendChild(strSpan);
        fContentEle.appendChild(pLine);
    }
}

function highlightHex(arrayBuffer,start,end){
    var startLine = parseInt(start/16);
    var endLine = parseInt(end/16);
    var fContentDom = document.getElementById('fContent');
    for(var i=startLine;i<=endLine;i++){
        var pLine = fContentDom.childNodes[i];
        var codeSpan = pLine.getElementsByClassName('f-code')[0];
        var startIndex = 16 * i;
        var endIndex = Math.min(startIndex + 16 , arrayBuffer.byteLength);
        var lineBuf = arrayBuffer.slice(startIndex , endIndex);
        if(end >= start){
            showHexLine(codeSpan,lineBuf,
                startIndex > start ? 0 : start-startIndex,
                endIndex < end ? lineBuf.byteLength-1 : end-startIndex);
        }else{
            showHexLine(codeSpan,lineBuf);
        }
    }
    var pinpointDom = fContentDom.getElementsByTagName('b')[0];
    if(pinpointDom){
        if(pinpointDom.offsetTop < fContentDom.scrollTop || 
            pinpointDom.offsetTop > fContentDom.scrollTop + fContentDom.clientHeight){
                pinpointDom.scrollIntoView();
        }
    }
}

function clearHighlight(){
    var highlights = document.getElementById('fContent').getElementsByTagName('b');
    Array.from(highlights).forEach(element => {
        element.replaceWith(element.innerText);
    });
}

function showHexLine(codeSpan,lineBuf,highlightStart,highlightEnd){
    var codeLine = '';
    for(var j=0;j<lineBuf.byteLength;j++){
        var newBuf = lineBuf.slice(j,j+1);
        if(j==highlightStart){
            codeLine += '<b>';
        }
        codeLine += BCParser.buf2hex(newBuf);
        if(j==highlightEnd){
            codeLine += '</b>';
        }
        if(j != lineBuf.byteLength -1){
            codeLine += ' ';
        }
    }
    codeSpan.innerHTML = codeLine;
}