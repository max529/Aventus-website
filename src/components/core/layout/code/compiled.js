class AvCode extends Aventus.WebComponent {
    static get observedAttributes() {return ["language"].concat(super.observedAttributes).filter((v, i, a) => a.indexOf(v) === i);}
    static primsCSS = "";static isLoading = false;static waitingLoad = [];    get 'language'() {
                        return this.getAttribute('language');
                    }
                    set 'language'(val) {
						if(val === undefined || val === null){this.removeAttribute('language')}
						else{this.setAttribute('language',val)}
                    }    __getStyle() {
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
    __mapSelectedElement() { super.__mapSelectedElement(); this.codeEl = this.shadowRoot.querySelector('[_id="avcode_0"]');}
    __registerOnChange() { super.__registerOnChange(); this.__onChangeFct['language'] = []this.__onChangeFct['language'].push((path) => {((target) => {    if (window.Prism) {        if (!window.Prism.languages.hasOwnProperty(target.language)) {            target.language = 'plain';        }    }})(this);if("language".startsWith(path)){
										for(var i = 0;i<this._components['avcode_0'].length;i++){
											this._components['avcode_0'][i].setAttribute("class", "language-"+this.language+"");
										}
									}}) }
    getClassName() {
        return "AvCode";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('language')){ this['language'] = 'plain'; } }
    __upgradeAttributes() { super.__upgradeAttributes(); this.__upgradeProperty('language'); }
    static async  loadScript(src){return new Promise((resolve, reject) => {    let script = document.createElement('script');    script.setAttribute('src', src);    document.head.appendChild(script);    script.addEventListener("load", () => {        resolve();    });    script.addEventListener("error", (ev) => {        reject();    });});}static async  loadingPrism(){if (!AvCode.isLoading) {    AvCode.isLoading = true;    AvCode.primsCSS = await(await fetch("/libs/prism_vscode_theme.css")).text();    await AvCode.loadScript("/libs/prism.js");    AvCode.releaseAwaitFct();    AvCode.isLoading = false;}else {    await AvCode.awaitFct();}}static  releaseAwaitFct(){for (let waiting of AvCode.waitingLoad) {    waiting();}AvCode.waitingLoad = [];}static  awaitFct(){return new Promise((resolve) => {    AvCode.waitingLoad.push(() => {        resolve('');    });});}async  loadFiles(){await AvCode.loadingPrism();this.init();} init(){if (!window.Prism.languages.hasOwnProperty(this.language)) {    this.language = 'plain';}this.codeEl.innerHTML = this.innerHTML.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;");this.innerHTML = "";let style = this.shadowRoot.querySelector("style");style.innerHTML = style.innerHTML.trim() + AvCode.primsCSS;window.Prism.highlightElement(this.codeEl);} postCreation(){if (!window.Prism) {    this.loadFiles();}else {    this.init();}}}
window.customElements.define('av-code', AvCode);