<span>{{if pad}}pad:{{hit pad/}}{{/if}}</span>
        <span>default:{{hit default/}}</span>
        <span>low:{{hit low/}}</span>
        <span>high:{{hit high/}}</span>
        {{for offsets ~low=low}}
            {{:#getIndex() + ~low}}:<span>{{hit value/}}</span>
        {{/for}}
