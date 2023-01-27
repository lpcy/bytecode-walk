 <span>attributes_count:{{hit attributes_count/}}</span><br/>
        <details>
            <summary {{highlight attributes/}}">attributes:</summary>
            <div>
            {{for attributes}}
            ----<br/>
            <div>
                <span>attribute_name_index:{{hit attribute_name_index/}}</span><br/>
                <span>attribute_length:{{hit attribute_length/}}</span><br/>
                {{if ~point(attribute_name_index) == 'Code' tmpl="attrCodeTemplate"}}
                {{else ~point(attribute_name_index) == 'BootstrapMethods' tmpl="attrBootstrapMethodsTemplate"}}
                {{else ~point(attribute_name_index) == 'InnerClasses' tmpl="attrInnerClassesTemplate"}}
                {{else ~point(attribute_name_index) == 'MethodParameters' tmpl="attrMethodParametersTemplate"}}
                {{else ~point(attribute_name_index) == 'Signature'}}
                    <span>signature_index:{{hit signature_index/}}</span><br/>
		{{else ~point(attribute_name_index) == 'SourceFile'}}
                    <span>sourcefile_index:{{hit sourcefile_index/}}</span><br/>
                {{/if}}
            </div>
            {{/for}}
            </div>
        </details>
