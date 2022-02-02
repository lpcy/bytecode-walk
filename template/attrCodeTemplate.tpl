 <span>max_stack:{{hit max_stack/}}</span><br/>
        <span>max_locals:{{hit max_locals/}}</span><br/>
        <span>code_length:{{hit code_length/}}</span><br/>
        <details>
            <summary {{highlight codes/}}">codes:</summary>
            <div>
            {{for codes}}
                <span class="code-one">
                    <span class="code-index">{{:pc}}</span>
                    <span class="code-opcode" {{highlight opcode/}}>{{:getOpcode()}}</span>
                    <span class="code-operands">
                    {{if operandExt}}
                        {{if getOpcode()=="wide"}}
                            {{include operandExt tmpl="opcodeWideTemplate"/}}
                        {{else getOpcode()=="tableswitch"}}
                            {{include operandExt tmpl="opcodeTableswitchTemplate"/}}
                        {{else getOpcode()=="lookupswitch"}}
                            {{include operandExt tmpl="opcodeLookupswitchTemplate"/}}
                        {{/if}}
                    {{/if}}
                    {{if operands}}
                    {{for operands}}
                        {{hit value/}}
                    {{/for}}
                    {{/if}}
                    </span>
                </span>
            {{/for}}
            </div>
        </details>
        <span>exception_table_length:{{hit exception_table_length/}}</span><br/>
        <details>
            <summary {{highlight exception_table/}}">exception_table:</summary>
            <div>
            {{for exception_table}}
                ----<br/>
                <span>start_pc:{{hit start_pc/}}</span><br/>
                <span>end_pc:{{hit end_pc/}}</span><br/>
                <span>handler_pc:{{hit handler_pc/}}</span><br/>
                <span>catch_type_index:
                {{if catch_type_index==0}}
                    <span {{highlight catch_type_index/}}>0<i>all exceptions</i></span>
                {{else}}
                    {{hit catch_type_index/}}
                {{/if}}
                </span><br/>
            {{/for}}
            </div>
        </details>
        {{include tmpl="attrsTemplate"/}}
