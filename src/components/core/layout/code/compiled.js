class AvCode extends Aventus.WebComponent {
    static get observedAttributes() {return ["language"].concat(super.observedAttributes).filter((v, i, a) => a.indexOf(v) === i);}
    static primsCSS = "";
                        return this.getAttribute('language');
                    }
                    set 'language'(val) {
						if(val === undefined || val === null){this.removeAttribute('language')}
						else{this.setAttribute('language',val)}
                    }
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{display:flex}:host pre{border-radius:5px;width:100%}:host .hided{display:none}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<pre>    <code _id="avcode_0">
    </code>
</pre>
<div class="hided">
    <slot></slot>
</div>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<pre>    <code _id="avcode_0">
    </code>
</pre>
<div class="hided">
    <slot></slot>
</div>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvCode", 1])
        return temp;
    }
    __mapSelectedElement() { super.__mapSelectedElement(); this.codeEl = this.shadowRoot.querySelector('[_id="avcode_0"]');
    __registerOnChange() { super.__registerOnChange(); this.__onChangeFct['language'] = []
										for(var i = 0;i<this._components['avcode_0'].length;i++){
											this._components['avcode_0'][i].setAttribute("class", "language-"+this.language+"");
										}
									}})
    getClassName() {
        return "AvCode";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('language')){ this['language'] = 'plain'; }
    __upgradeAttributes() { super.__upgradeAttributes(); this.__upgradeProperty('language');
    static async  loadScript(src){return new Promise((resolve, reject) => {
window.customElements.define('av-code', AvCode);