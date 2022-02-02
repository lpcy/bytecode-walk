        <p>magic: {{hit magic/}}</p>
        <p>minor_version: {{hit minor_version/}}</p>
        <p>major_version: {{hit major_version/}}</p>
        <p>pool_count: {{hit pool_count/}}</p>
        <details>
            <summary {{highlight constants/}}>constants pool:</summary>
            <div>
                {{for constants}}
                {{if}}
                <div class="constant-one">
                    <span class="constant-index" {{highlight/}}>{{:#getIndex()}}</span>
                    <span class="constant-type" {{highlight tag/}}">{{:getType()}}</span>
                    <span class="constant-value">
                        {{props}}
                        {{if key!='tag'}}
                        <span>
                            {{:key}}:{{hit prop/}}
                        </span>
                        {{/if}}
                        {{/props}}
                    </span>
                </div>
                {{/if}}
                {{/for}}
            </div>
        </details>
        <p>access_flags: {{hit access_flags/}}({{:accFlags.length > 0 ? accFlags.join() : "none"}})</p>
        <p>this_class: {{hit this_class/}}</p>
        <p>super_class: {{hit super_class/}}</p>
        <p>interfaces_count: {{hit interfaces_count/}}</p>
        <p {{highlight interfaces/}}>interfaces:
            {{for interfaces}}
            <span>&nbsp;&nbsp;{{hit index/}}</span>
            {{/for}}
        </p>
        <p>fields_count: {{hit fields_count/}}</p>
        <details>
            <summary {{highlight fields/}}>fields:</summary>
            <div>
            {{for fields}}
                ----<br/>
                <span>access_flags:{{hit access_flags/}}({{:accFlags.length > 0 ? accFlags.join() : "none"}})</span><br/>
                <span>name_index:{{hit name_index/}}</span><br/>
                <span>descriptor_index:{{hit descriptor_index/}}</span><br/>
                <span>attributes_count:{{hit attributes_count/}}</span><br/>
            {{/for}}
            </div>
        </details>
        <p>methods_count: {{hit methods_count/}}</p>
        <details>
            <summary {{highlight methods/}}>methods:</summary>
            <div>
            {{for methods}}
                ----<br/>
                <span>access_flags:{{hit access_flags/}}({{:accFlags.length > 0 ? accFlags.join() : "none"}})</span><br/>
                <span>name_index:{{hit name_index/}}</span><br/>
                <span>descriptor_index:{{hit descriptor_index/}}</span><br/>
                {{include tmpl="attrsTemplate"/}}
            {{/for}}
            </div>
        </details>
        {{include tmpl="attrsTemplate"/}}
