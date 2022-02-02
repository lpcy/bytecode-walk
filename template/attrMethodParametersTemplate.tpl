  <span>number_of_classes:{{hit parameters_count/}}</span>
        <details>
            <summary {{highlight parameters/}}">parameters:</summary>
            <div>
                {{for parameters}}
                ----<br/>
                <span>name_index:{{hit name_index/}}</span><br/>
		<span>access_flags:{{hit access_flags/}}({{:accFlags.length > 0 ? accFlags.join() : "none"}})</span><br/>
                {{/for}}
            </div>
        </details>
