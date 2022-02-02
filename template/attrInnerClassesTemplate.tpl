  <span>number_of_classes:{{hit number_of_classes/}}</span>
        <details>
            <summary {{highlight classes/}}">classes:</summary>
            <div>
                {{for classes}}
                ----<br/>
                <span>inner_class_info_index:{{hit inner_class_info_index/}}</span><br/>
                <span>outer_class_info_index:
			{{if outer_class_info_index==0}}
				<span {{highlight outer_class_info_index/}}>(none)</span>
			{{else}}
				{{hit outer_class_info_index/}}
			{{/if}}
		</span><br/>
		<span>inner_name_index:
			{{if inner_name_index==0}}
				<span {{highlight inner_name_index/}}>(anonymous)</span>
			{{else}}
			{{hit inner_name_index/}}
			{{/if}}
		</span><br/>
		<span>access_flags:{{hit access_flags/}}({{:accFlags.length > 0 ? accFlags.join() : "none"}})</span><br/>
                {{/for}}
            </div>
        </details>
