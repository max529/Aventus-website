class AvImg extends Aventus.WebComponent {
    static get observedAttributes() {return ["src", "mode"].concat(super.observedAttributes).filter((v, i, a) => a.indexOf(v) === i);}
    get 'src'() {
                        return this.getAttribute('src');
                    }
                    set 'src'(val) {
						if(val === undefined || val === null){this.removeAttribute('src')}
						else{this.setAttribute('src',val)}
                    }
                        return this.hasAttribute('display_bigger');
                    }
                    set 'display_bigger'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in display_bigger");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('display_bigger', 'true');
                        } else{
                            this.removeAttribute('display_bigger');
                        }
                    }
                        return this.getAttribute('mode');
                    }
                    set 'mode'(val) {
						if(val === undefined || val === null){this.removeAttribute('mode')}
						else{this.setAttribute('mode',val)}
                    }
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{--internal-img-color: var(--img-color);--internal-img-stroke-color: var(--img-stroke-color, var(--internal-img-color));--internal-img-fill-color: var(--img-fill-color, var(--internal-img-color));--internal-img-color-transition: var(--img-color-transition, none)}:host{display:inline-block;overflow:hidden;font-size:0;height:100%}:host *{box-sizing:border-box}:host img{opacity:0;transition:filter .3s linear}:host .svg{display:none;height:100%;width:100%}:host .svg svg{height:100%;width:100%}:host([src$=".svg"]) img{display:none}:host([src$=".svg"]) .svg{display:flex}:host([src$=".svg"]) .svg svg{transition:var(--internal-img-color-transition);stroke:var(--internal-img-stroke-color);fill:var(--internal-img-fill-color)}:host([display_bigger=true]) img{cursor:pointer}:host([display_bigger=true]) img:hover{filter:brightness(50%)}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<img _id="avimg_0">
<div class="svg" _id="avimg_1"></div>`,
            slots: {
            },
            blocks: {
                'default':`<img _id="avimg_0">
<div class="svg" _id="avimg_1"></div>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvImg", 2])
        return temp;
    }
    __mapSelectedElement() { super.__mapSelectedElement(); this.imgEl = this.shadowRoot.querySelector('[_id="avimg_0"]');
    __registerOnChange() { super.__registerOnChange(); this.__onChangeFct['src'] = []
    __endConstructor() { super.__endConstructor(); (() => {
    getClassName() {
        return "AvImg";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('display_bigger')) { this.attributeChangedCallback('display_bigger', false, false); }
    __upgradeAttributes() { super.__upgradeAttributes(); this.__upgradeProperty('src');
    __listBoolProps() { return ["display_bigger"].concat(super.__listBoolProps()).filter((v, i, a) => a.indexOf(v) === i); }
     checkClose(e){if (e instanceof KeyboardEvent) {
window.customElements.define('av-img', AvImg);