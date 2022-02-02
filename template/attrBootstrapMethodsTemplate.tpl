  <span>num_bootstrap_methods:{{hit num_bootstrap_methods/}}</span>
        <details>
            <summary {{highlight bootstrap_methods/}}">bootstrap_methods:</summary>
            <div>
                {{for bootstrap_methods}}
                ----<br/>
                <span>bootstrap_method_ref:{{hit bootstrap_method_ref/}}</span><br/>
                <span>num_bootstrap_arguments:{{hit num_bootstrap_arguments/}}</span><br/>
                arguments:<br/>
                {{for bootstrap_arguments}}
                    {{hit argument/}}<br/>
                {{/for}}
                {{/for}}
            </div>
        </details>
