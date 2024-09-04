// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

const t = window, e = t.ShadowRoot && (t.ShadyCSS === void 0 || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, s = Symbol(), n = new WeakMap();
class o {
    constructor(t2, e2, n2){
        if (this._$cssResult$ = true, n2 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
        this.cssText = t2, this.t = e2;
    }
    get styleSheet() {
        let t2 = this.o;
        const s2 = this.t;
        if (e && t2 === void 0) {
            const e2 = s2 !== void 0 && s2.length === 1;
            e2 && (t2 = n.get(s2)), t2 === void 0 && ((this.o = t2 = new CSSStyleSheet()).replaceSync(this.cssText), e2 && n.set(s2, t2));
        }
        return t2;
    }
    toString() {
        return this.cssText;
    }
}
const r = (t2)=>new o(typeof t2 == "string" ? t2 : t2 + "", void 0, s), S = (s2, n2)=>{
    e ? s2.adoptedStyleSheets = n2.map((t2)=>t2 instanceof CSSStyleSheet ? t2 : t2.styleSheet) : n2.forEach((e2)=>{
        const n3 = document.createElement("style"), o2 = t.litNonce;
        o2 !== void 0 && n3.setAttribute("nonce", o2), n3.textContent = e2.cssText, s2.appendChild(n3);
    });
}, c = e ? (t2)=>t2 : (t2)=>t2 instanceof CSSStyleSheet ? ((t3)=>{
        let e2 = "";
        for (const s2 of t3.cssRules)e2 += s2.cssText;
        return r(e2);
    })(t2) : t2;
var s1;
const e1 = window, r1 = e1.trustedTypes, h = r1 ? r1.emptyScript : "", o1 = e1.reactiveElementPolyfillSupport, n1 = {
    toAttribute (t, i) {
        switch(i){
            case Boolean:
                t = t ? h : null;
                break;
            case Object:
            case Array:
                t = t == null ? t : JSON.stringify(t);
        }
        return t;
    },
    fromAttribute (t, i) {
        let s2 = t;
        switch(i){
            case Boolean:
                s2 = t !== null;
                break;
            case Number:
                s2 = t === null ? null : Number(t);
                break;
            case Object:
            case Array:
                try {
                    s2 = JSON.parse(t);
                } catch (t2) {
                    s2 = null;
                }
        }
        return s2;
    }
}, a = (t, i)=>i !== t && (i == i || t == t), l = {
    attribute: true,
    type: String,
    converter: n1,
    reflect: false,
    hasChanged: a
};
class d extends HTMLElement {
    constructor(){
        super(), this._$Ei = new Map(), this.isUpdatePending = false, this.hasUpdated = false, this._$El = null, this.u();
    }
    static addInitializer(t) {
        var i;
        this.finalize(), ((i = this.h) !== null && i !== void 0 ? i : this.h = []).push(t);
    }
    static get observedAttributes() {
        this.finalize();
        const t = [];
        return this.elementProperties.forEach((i, s2)=>{
            const e2 = this._$Ep(s2, i);
            e2 !== void 0 && (this._$Ev.set(e2, s2), t.push(e2));
        }), t;
    }
    static createProperty(t, i = l) {
        if (i.state && (i.attribute = false), this.finalize(), this.elementProperties.set(t, i), !i.noAccessor && !this.prototype.hasOwnProperty(t)) {
            const s2 = typeof t == "symbol" ? Symbol() : "__" + t, e2 = this.getPropertyDescriptor(t, s2, i);
            e2 !== void 0 && Object.defineProperty(this.prototype, t, e2);
        }
    }
    static getPropertyDescriptor(t, i, s2) {
        return {
            get () {
                return this[i];
            },
            set (e2) {
                const r2 = this[t];
                this[i] = e2, this.requestUpdate(t, r2, s2);
            },
            configurable: true,
            enumerable: true
        };
    }
    static getPropertyOptions(t) {
        return this.elementProperties.get(t) || l;
    }
    static finalize() {
        if (this.hasOwnProperty("finalized")) return false;
        this.finalized = true;
        const t = Object.getPrototypeOf(this);
        if (t.finalize(), t.h !== void 0 && (this.h = [
            ...t.h
        ]), this.elementProperties = new Map(t.elementProperties), this._$Ev = new Map(), this.hasOwnProperty("properties")) {
            const t2 = this.properties, i = [
                ...Object.getOwnPropertyNames(t2),
                ...Object.getOwnPropertySymbols(t2)
            ];
            for (const s2 of i)this.createProperty(s2, t2[s2]);
        }
        return this.elementStyles = this.finalizeStyles(this.styles), true;
    }
    static finalizeStyles(i) {
        const s2 = [];
        if (Array.isArray(i)) {
            const e2 = new Set(i.flat(1 / 0).reverse());
            for (const i2 of e2)s2.unshift(c(i2));
        } else i !== void 0 && s2.push(c(i));
        return s2;
    }
    static _$Ep(t, i) {
        const s2 = i.attribute;
        return s2 === false ? void 0 : typeof s2 == "string" ? s2 : typeof t == "string" ? t.toLowerCase() : void 0;
    }
    u() {
        var t;
        this._$E_ = new Promise((t2)=>this.enableUpdating = t2), this._$AL = new Map(), this._$Eg(), this.requestUpdate(), (t = this.constructor.h) === null || t === void 0 || t.forEach((t2)=>t2(this));
    }
    addController(t) {
        var i, s2;
        ((i = this._$ES) !== null && i !== void 0 ? i : this._$ES = []).push(t), this.renderRoot !== void 0 && this.isConnected && ((s2 = t.hostConnected) === null || s2 === void 0 || s2.call(t));
    }
    removeController(t) {
        var i;
        (i = this._$ES) === null || i === void 0 || i.splice(this._$ES.indexOf(t) >>> 0, 1);
    }
    _$Eg() {
        this.constructor.elementProperties.forEach((t, i)=>{
            this.hasOwnProperty(i) && (this._$Ei.set(i, this[i]), delete this[i]);
        });
    }
    createRenderRoot() {
        var t;
        const s2 = (t = this.shadowRoot) !== null && t !== void 0 ? t : this.attachShadow(this.constructor.shadowRootOptions);
        return S(s2, this.constructor.elementStyles), s2;
    }
    connectedCallback() {
        var t;
        this.renderRoot === void 0 && (this.renderRoot = this.createRenderRoot()), this.enableUpdating(true), (t = this._$ES) === null || t === void 0 || t.forEach((t2)=>{
            var i;
            return (i = t2.hostConnected) === null || i === void 0 ? void 0 : i.call(t2);
        });
    }
    enableUpdating(t) {}
    disconnectedCallback() {
        var t;
        (t = this._$ES) === null || t === void 0 || t.forEach((t2)=>{
            var i;
            return (i = t2.hostDisconnected) === null || i === void 0 ? void 0 : i.call(t2);
        });
    }
    attributeChangedCallback(t, i, s2) {
        this._$AK(t, s2);
    }
    _$EO(t, i, s2 = l) {
        var e2;
        const r2 = this.constructor._$Ep(t, s2);
        if (r2 !== void 0 && s2.reflect === true) {
            const h2 = (((e2 = s2.converter) === null || e2 === void 0 ? void 0 : e2.toAttribute) !== void 0 ? s2.converter : n1).toAttribute(i, s2.type);
            this._$El = t, h2 == null ? this.removeAttribute(r2) : this.setAttribute(r2, h2), this._$El = null;
        }
    }
    _$AK(t, i) {
        var s2;
        const e2 = this.constructor, r2 = e2._$Ev.get(t);
        if (r2 !== void 0 && this._$El !== r2) {
            const t2 = e2.getPropertyOptions(r2), h2 = typeof t2.converter == "function" ? {
                fromAttribute: t2.converter
            } : ((s2 = t2.converter) === null || s2 === void 0 ? void 0 : s2.fromAttribute) !== void 0 ? t2.converter : n1;
            this._$El = r2, this[r2] = h2.fromAttribute(i, t2.type), this._$El = null;
        }
    }
    requestUpdate(t, i, s2) {
        let e2 = true;
        t !== void 0 && (((s2 = s2 || this.constructor.getPropertyOptions(t)).hasChanged || a)(this[t], i) ? (this._$AL.has(t) || this._$AL.set(t, i), s2.reflect === true && this._$El !== t && (this._$EC === void 0 && (this._$EC = new Map()), this._$EC.set(t, s2))) : e2 = false), !this.isUpdatePending && e2 && (this._$E_ = this._$Ej());
    }
    async _$Ej() {
        this.isUpdatePending = true;
        try {
            await this._$E_;
        } catch (t2) {
            Promise.reject(t2);
        }
        const t = this.scheduleUpdate();
        return t != null && await t, !this.isUpdatePending;
    }
    scheduleUpdate() {
        return this.performUpdate();
    }
    performUpdate() {
        var t;
        if (!this.isUpdatePending) return;
        this.hasUpdated, this._$Ei && (this._$Ei.forEach((t2, i2)=>this[i2] = t2), this._$Ei = void 0);
        let i = false;
        const s2 = this._$AL;
        try {
            i = this.shouldUpdate(s2), i ? (this.willUpdate(s2), (t = this._$ES) === null || t === void 0 || t.forEach((t2)=>{
                var i2;
                return (i2 = t2.hostUpdate) === null || i2 === void 0 ? void 0 : i2.call(t2);
            }), this.update(s2)) : this._$Ek();
        } catch (t2) {
            throw i = false, this._$Ek(), t2;
        }
        i && this._$AE(s2);
    }
    willUpdate(t) {}
    _$AE(t) {
        var i;
        (i = this._$ES) === null || i === void 0 || i.forEach((t2)=>{
            var i2;
            return (i2 = t2.hostUpdated) === null || i2 === void 0 ? void 0 : i2.call(t2);
        }), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t)), this.updated(t);
    }
    _$Ek() {
        this._$AL = new Map(), this.isUpdatePending = false;
    }
    get updateComplete() {
        return this.getUpdateComplete();
    }
    getUpdateComplete() {
        return this._$E_;
    }
    shouldUpdate(t) {
        return true;
    }
    update(t) {
        this._$EC !== void 0 && (this._$EC.forEach((t2, i)=>this._$EO(i, this[i], t2)), this._$EC = void 0), this._$Ek();
    }
    updated(t) {}
    firstUpdated(t) {}
}
d.finalized = true, d.elementProperties = new Map(), d.elementStyles = [], d.shadowRootOptions = {
    mode: "open"
}, o1 == null || o1({
    ReactiveElement: d
}), ((s1 = e1.reactiveElementVersions) !== null && s1 !== void 0 ? s1 : e1.reactiveElementVersions = []).push("1.6.1");
var t1;
const i = window, s2 = i.trustedTypes, e2 = s2 ? s2.createPolicy("lit-html", {
    createHTML: (t2)=>t2
}) : void 0, o2 = `lit$${(Math.random() + "").slice(9)}$`, n2 = "?" + o2, l1 = `<${n2}>`, h1 = document, r2 = (t2 = "")=>h1.createComment(t2), d1 = (t2)=>t2 === null || typeof t2 != "object" && typeof t2 != "function", u = Array.isArray, c1 = (t2)=>u(t2) || typeof (t2 == null ? void 0 : t2[Symbol.iterator]) == "function", v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, a1 = /-->/g, f = />/g, _ = RegExp(`>|[ 	
\f\r](?:([^\\s"'>=/]+)([ 	
\f\r]*=[ 	
\f\r]*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), m = /'/g, p = /"/g, $ = /^(?:script|style|textarea|title)$/i, g = (t2)=>(i2, ...s2)=>({
            _$litType$: t2,
            strings: i2,
            values: s2
        }), y = g(1), w = g(2), x = Symbol.for("lit-noChange"), b = Symbol.for("lit-nothing"), T = new WeakMap(), A = h1.createTreeWalker(h1, 129, null, false), E = (t2, i2)=>{
    const s2 = t2.length - 1, n2 = [];
    let h2, r2 = i2 === 2 ? "<svg>" : "", d2 = v;
    for(let i3 = 0; i3 < s2; i3++){
        const s3 = t2[i3];
        let e2, u3, c2 = -1, g2 = 0;
        for(; g2 < s3.length && (d2.lastIndex = g2, u3 = d2.exec(s3), u3 !== null);)g2 = d2.lastIndex, d2 === v ? u3[1] === "!--" ? d2 = a1 : u3[1] !== void 0 ? d2 = f : u3[2] !== void 0 ? ($.test(u3[2]) && (h2 = RegExp("</" + u3[2], "g")), d2 = _) : u3[3] !== void 0 && (d2 = _) : d2 === _ ? u3[0] === ">" ? (d2 = h2 != null ? h2 : v, c2 = -1) : u3[1] === void 0 ? c2 = -2 : (c2 = d2.lastIndex - u3[2].length, e2 = u3[1], d2 = u3[3] === void 0 ? _ : u3[3] === '"' ? p : m) : d2 === p || d2 === m ? d2 = _ : d2 === a1 || d2 === f ? d2 = v : (d2 = _, h2 = void 0);
        const y2 = d2 === _ && t2[i3 + 1].startsWith("/>") ? " " : "";
        r2 += d2 === v ? s3 + l1 : c2 >= 0 ? (n2.push(e2), s3.slice(0, c2) + "$lit$" + s3.slice(c2) + o2 + y2) : s3 + o2 + (c2 === -2 ? (n2.push(void 0), i3) : y2);
    }
    const u2 = r2 + (t2[s2] || "<?>") + (i2 === 2 ? "</svg>" : "");
    if (!Array.isArray(t2) || !t2.hasOwnProperty("raw")) throw Error("invalid template strings array");
    return [
        e2 !== void 0 ? e2.createHTML(u2) : u2,
        n2
    ];
};
class C {
    constructor({ strings: t2, _$litType$: i2 }, e2){
        let l2;
        this.parts = [];
        let h2 = 0, d2 = 0;
        const u2 = t2.length - 1, c2 = this.parts, [v2, a2] = E(t2, i2);
        if (this.el = C.createElement(v2, e2), A.currentNode = this.el.content, i2 === 2) {
            const t3 = this.el.content, i3 = t3.firstChild;
            i3.remove(), t3.append(...i3.childNodes);
        }
        for(; (l2 = A.nextNode()) !== null && c2.length < u2;){
            if (l2.nodeType === 1) {
                if (l2.hasAttributes()) {
                    const t3 = [];
                    for (const i3 of l2.getAttributeNames())if (i3.endsWith("$lit$") || i3.startsWith(o2)) {
                        const s2 = a2[d2++];
                        if (t3.push(i3), s2 !== void 0) {
                            const t4 = l2.getAttribute(s2.toLowerCase() + "$lit$").split(o2), i4 = /([.?@])?(.*)/.exec(s2);
                            c2.push({
                                type: 1,
                                index: h2,
                                name: i4[2],
                                strings: t4,
                                ctor: i4[1] === "." ? M : i4[1] === "?" ? k : i4[1] === "@" ? H : S1
                            });
                        } else c2.push({
                            type: 6,
                            index: h2
                        });
                    }
                    for (const i3 of t3)l2.removeAttribute(i3);
                }
                if ($.test(l2.tagName)) {
                    const t3 = l2.textContent.split(o2), i3 = t3.length - 1;
                    if (i3 > 0) {
                        l2.textContent = s2 ? s2.emptyScript : "";
                        for(let s2 = 0; s2 < i3; s2++)l2.append(t3[s2], r2()), A.nextNode(), c2.push({
                            type: 2,
                            index: ++h2
                        });
                        l2.append(t3[i3], r2());
                    }
                }
            } else if (l2.nodeType === 8) if (l2.data === n2) c2.push({
                type: 2,
                index: h2
            });
            else {
                let t3 = -1;
                for(; (t3 = l2.data.indexOf(o2, t3 + 1)) !== -1;)c2.push({
                    type: 7,
                    index: h2
                }), t3 += o2.length - 1;
            }
            h2++;
        }
    }
    static createElement(t2, i2) {
        const s2 = h1.createElement("template");
        return s2.innerHTML = t2, s2;
    }
}
function P(t2, i2, s2 = t2, e2) {
    var o2, n2, l2, h2;
    if (i2 === x) return i2;
    let r2 = e2 !== void 0 ? (o2 = s2._$Co) === null || o2 === void 0 ? void 0 : o2[e2] : s2._$Cl;
    const u2 = d1(i2) ? void 0 : i2._$litDirective$;
    return (r2 == null ? void 0 : r2.constructor) !== u2 && ((n2 = r2 == null ? void 0 : r2._$AO) === null || n2 === void 0 || n2.call(r2, false), u2 === void 0 ? r2 = void 0 : (r2 = new u2(t2), r2._$AT(t2, s2, e2)), e2 !== void 0 ? ((l2 = (h2 = s2)._$Co) !== null && l2 !== void 0 ? l2 : h2._$Co = [])[e2] = r2 : s2._$Cl = r2), r2 !== void 0 && (i2 = P(t2, r2._$AS(t2, i2.values), r2, e2)), i2;
}
class V {
    constructor(t2, i2){
        this.u = [], this._$AN = void 0, this._$AD = t2, this._$AM = i2;
    }
    get parentNode() {
        return this._$AM.parentNode;
    }
    get _$AU() {
        return this._$AM._$AU;
    }
    v(t2) {
        var i2;
        const { el: { content: s2 }, parts: e2 } = this._$AD, o2 = ((i2 = t2 == null ? void 0 : t2.creationScope) !== null && i2 !== void 0 ? i2 : h1).importNode(s2, true);
        A.currentNode = o2;
        let n2 = A.nextNode(), l2 = 0, r2 = 0, d2 = e2[0];
        for(; d2 !== void 0;){
            if (l2 === d2.index) {
                let i3;
                d2.type === 2 ? i3 = new N(n2, n2.nextSibling, this, t2) : d2.type === 1 ? i3 = new d2.ctor(n2, d2.name, d2.strings, this, t2) : d2.type === 6 && (i3 = new I(n2, this, t2)), this.u.push(i3), d2 = e2[++r2];
            }
            l2 !== (d2 == null ? void 0 : d2.index) && (n2 = A.nextNode(), l2++);
        }
        return o2;
    }
    p(t2) {
        let i2 = 0;
        for (const s2 of this.u)s2 !== void 0 && (s2.strings !== void 0 ? (s2._$AI(t2, s2, i2), i2 += s2.strings.length - 2) : s2._$AI(t2[i2])), i2++;
    }
}
class N {
    constructor(t2, i2, s2, e2){
        var o2;
        this.type = 2, this._$AH = b, this._$AN = void 0, this._$AA = t2, this._$AB = i2, this._$AM = s2, this.options = e2, this._$Cm = (o2 = e2 == null ? void 0 : e2.isConnected) === null || o2 === void 0 || o2;
    }
    get _$AU() {
        var t2, i2;
        return (i2 = (t2 = this._$AM) === null || t2 === void 0 ? void 0 : t2._$AU) !== null && i2 !== void 0 ? i2 : this._$Cm;
    }
    get parentNode() {
        let t2 = this._$AA.parentNode;
        const i2 = this._$AM;
        return i2 !== void 0 && t2.nodeType === 11 && (t2 = i2.parentNode), t2;
    }
    get startNode() {
        return this._$AA;
    }
    get endNode() {
        return this._$AB;
    }
    _$AI(t2, i2 = this) {
        t2 = P(this, t2, i2), d1(t2) ? t2 === b || t2 == null || t2 === "" ? (this._$AH !== b && this._$AR(), this._$AH = b) : t2 !== this._$AH && t2 !== x && this.g(t2) : t2._$litType$ !== void 0 ? this.$(t2) : t2.nodeType !== void 0 ? this.T(t2) : c1(t2) ? this.k(t2) : this.g(t2);
    }
    O(t2, i2 = this._$AB) {
        return this._$AA.parentNode.insertBefore(t2, i2);
    }
    T(t2) {
        this._$AH !== t2 && (this._$AR(), this._$AH = this.O(t2));
    }
    g(t2) {
        this._$AH !== b && d1(this._$AH) ? this._$AA.nextSibling.data = t2 : this.T(h1.createTextNode(t2)), this._$AH = t2;
    }
    $(t2) {
        var i2;
        const { values: s2, _$litType$: e2 } = t2, o2 = typeof e2 == "number" ? this._$AC(t2) : (e2.el === void 0 && (e2.el = C.createElement(e2.h, this.options)), e2);
        if (((i2 = this._$AH) === null || i2 === void 0 ? void 0 : i2._$AD) === o2) this._$AH.p(s2);
        else {
            const t3 = new V(o2, this), i3 = t3.v(this.options);
            t3.p(s2), this.T(i3), this._$AH = t3;
        }
    }
    _$AC(t2) {
        let i2 = T.get(t2.strings);
        return i2 === void 0 && T.set(t2.strings, i2 = new C(t2)), i2;
    }
    k(t2) {
        u(this._$AH) || (this._$AH = [], this._$AR());
        const i2 = this._$AH;
        let s2, e2 = 0;
        for (const o2 of t2)e2 === i2.length ? i2.push(s2 = new N(this.O(r2()), this.O(r2()), this, this.options)) : s2 = i2[e2], s2._$AI(o2), e2++;
        e2 < i2.length && (this._$AR(s2 && s2._$AB.nextSibling, e2), i2.length = e2);
    }
    _$AR(t2 = this._$AA.nextSibling, i2) {
        var s2;
        for((s2 = this._$AP) === null || s2 === void 0 || s2.call(this, false, true, i2); t2 && t2 !== this._$AB;){
            const i3 = t2.nextSibling;
            t2.remove(), t2 = i3;
        }
    }
    setConnected(t2) {
        var i2;
        this._$AM === void 0 && (this._$Cm = t2, (i2 = this._$AP) === null || i2 === void 0 || i2.call(this, t2));
    }
}
class S1 {
    constructor(t2, i2, s2, e2, o2){
        this.type = 1, this._$AH = b, this._$AN = void 0, this.element = t2, this.name = i2, this._$AM = e2, this.options = o2, s2.length > 2 || s2[0] !== "" || s2[1] !== "" ? (this._$AH = Array(s2.length - 1).fill(new String()), this.strings = s2) : this._$AH = b;
    }
    get tagName() {
        return this.element.tagName;
    }
    get _$AU() {
        return this._$AM._$AU;
    }
    _$AI(t2, i2 = this, s2, e2) {
        const o2 = this.strings;
        let n2 = false;
        if (o2 === void 0) t2 = P(this, t2, i2, 0), n2 = !d1(t2) || t2 !== this._$AH && t2 !== x, n2 && (this._$AH = t2);
        else {
            const e3 = t2;
            let l2, h2;
            for(t2 = o2[0], l2 = 0; l2 < o2.length - 1; l2++)h2 = P(this, e3[s2 + l2], i2, l2), h2 === x && (h2 = this._$AH[l2]), n2 || (n2 = !d1(h2) || h2 !== this._$AH[l2]), h2 === b ? t2 = b : t2 !== b && (t2 += (h2 != null ? h2 : "") + o2[l2 + 1]), this._$AH[l2] = h2;
        }
        n2 && !e2 && this.j(t2);
    }
    j(t2) {
        t2 === b ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t2 != null ? t2 : "");
    }
}
class M extends S1 {
    constructor(){
        super(...arguments), this.type = 3;
    }
    j(t2) {
        this.element[this.name] = t2 === b ? void 0 : t2;
    }
}
const R = s2 ? s2.emptyScript : "";
class k extends S1 {
    constructor(){
        super(...arguments), this.type = 4;
    }
    j(t2) {
        t2 && t2 !== b ? this.element.setAttribute(this.name, R) : this.element.removeAttribute(this.name);
    }
}
class H extends S1 {
    constructor(t2, i2, s2, e2, o2){
        super(t2, i2, s2, e2, o2), this.type = 5;
    }
    _$AI(t2, i2 = this) {
        var s2;
        if ((t2 = (s2 = P(this, t2, i2, 0)) !== null && s2 !== void 0 ? s2 : b) === x) return;
        const e2 = this._$AH, o2 = t2 === b && e2 !== b || t2.capture !== e2.capture || t2.once !== e2.once || t2.passive !== e2.passive, n2 = t2 !== b && (e2 === b || o2);
        o2 && this.element.removeEventListener(this.name, this, e2), n2 && this.element.addEventListener(this.name, this, t2), this._$AH = t2;
    }
    handleEvent(t2) {
        var i2, s2;
        typeof this._$AH == "function" ? this._$AH.call((s2 = (i2 = this.options) === null || i2 === void 0 ? void 0 : i2.host) !== null && s2 !== void 0 ? s2 : this.element, t2) : this._$AH.handleEvent(t2);
    }
}
class I {
    constructor(t2, i2, s2){
        this.element = t2, this.type = 6, this._$AN = void 0, this._$AM = i2, this.options = s2;
    }
    get _$AU() {
        return this._$AM._$AU;
    }
    _$AI(t2) {
        P(this, t2);
    }
}
const z = i.litHtmlPolyfillSupport;
z == null || z(C, N), ((t1 = i.litHtmlVersions) !== null && t1 !== void 0 ? t1 : i.litHtmlVersions = []).push("2.6.1");
const t2 = window.ShadowRoot && (window.ShadyCSS === void 0 || window.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, e3 = Symbol(), n3 = new WeakMap();
class s3 {
    constructor(t2, n2, s3){
        if (this._$cssResult$ = true, s3 !== e3) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
        this.cssText = t2, this.t = n2;
    }
    get styleSheet() {
        let e2 = this.o;
        const s3 = this.t;
        if (t2 && e2 === void 0) {
            const t2 = s3 !== void 0 && s3.length === 1;
            t2 && (e2 = n3.get(s3)), e2 === void 0 && ((this.o = e2 = new CSSStyleSheet()).replaceSync(this.cssText), t2 && n3.set(s3, e2));
        }
        return e2;
    }
    toString() {
        return this.cssText;
    }
}
const o3 = (t2)=>new s3(typeof t2 == "string" ? t2 : t2 + "", void 0, e3), r3 = (t2, ...n2)=>{
    const o2 = t2.length === 1 ? t2[0] : n2.reduce((e2, n3, s2)=>e2 + ((t3)=>{
            if (t3._$cssResult$ === true) return t3.cssText;
            if (typeof t3 == "number") return t3;
            throw Error("Value passed to 'css' function must be a 'css' function result: " + t3 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
        })(n3) + t2[s2 + 1], t2[0]);
    return new s3(o2, t2, e3);
}, i1 = (e2, n2)=>{
    t2 ? e2.adoptedStyleSheets = n2.map((t2)=>t2 instanceof CSSStyleSheet ? t2 : t2.styleSheet) : n2.forEach((t2)=>{
        const n3 = document.createElement("style"), s2 = window.litNonce;
        s2 !== void 0 && n3.setAttribute("nonce", s2), n3.textContent = t2.cssText, e2.appendChild(n3);
    });
}, S2 = t2 ? (t2)=>t2 : (t2)=>t2 instanceof CSSStyleSheet ? ((t3)=>{
        let e2 = "";
        for (const n2 of t3.cssRules)e2 += n2.cssText;
        return o3(e2);
    })(t2) : t2;
var s4;
const e4 = window.trustedTypes, r4 = e4 ? e4.emptyScript : "", h2 = window.reactiveElementPolyfillSupport, o4 = {
    toAttribute (t, i2) {
        switch(i2){
            case Boolean:
                t = t ? r4 : null;
                break;
            case Object:
            case Array:
                t = t == null ? t : JSON.stringify(t);
        }
        return t;
    },
    fromAttribute (t, i2) {
        let s2 = t;
        switch(i2){
            case Boolean:
                s2 = t !== null;
                break;
            case Number:
                s2 = t === null ? null : Number(t);
                break;
            case Object:
            case Array:
                try {
                    s2 = JSON.parse(t);
                } catch (t2) {
                    s2 = null;
                }
        }
        return s2;
    }
}, n4 = (t, i2)=>i2 !== t && (i2 == i2 || t == t), l2 = {
    attribute: true,
    type: String,
    converter: o4,
    reflect: false,
    hasChanged: n4
};
class a2 extends HTMLElement {
    constructor(){
        super(), this._$Ei = new Map(), this.isUpdatePending = false, this.hasUpdated = false, this._$El = null, this.u();
    }
    static addInitializer(t) {
        var i2;
        (i2 = this.h) !== null && i2 !== void 0 || (this.h = []), this.h.push(t);
    }
    static get observedAttributes() {
        this.finalize();
        const t = [];
        return this.elementProperties.forEach((i2, s2)=>{
            const e2 = this._$Ep(s2, i2);
            e2 !== void 0 && (this._$Ev.set(e2, s2), t.push(e2));
        }), t;
    }
    static createProperty(t, i2 = l2) {
        if (i2.state && (i2.attribute = false), this.finalize(), this.elementProperties.set(t, i2), !i2.noAccessor && !this.prototype.hasOwnProperty(t)) {
            const s2 = typeof t == "symbol" ? Symbol() : "__" + t, e2 = this.getPropertyDescriptor(t, s2, i2);
            e2 !== void 0 && Object.defineProperty(this.prototype, t, e2);
        }
    }
    static getPropertyDescriptor(t, i2, s2) {
        return {
            get () {
                return this[i2];
            },
            set (e2) {
                const r2 = this[t];
                this[i2] = e2, this.requestUpdate(t, r2, s2);
            },
            configurable: true,
            enumerable: true
        };
    }
    static getPropertyOptions(t) {
        return this.elementProperties.get(t) || l2;
    }
    static finalize() {
        if (this.hasOwnProperty("finalized")) return false;
        this.finalized = true;
        const t = Object.getPrototypeOf(this);
        if (t.finalize(), this.elementProperties = new Map(t.elementProperties), this._$Ev = new Map(), this.hasOwnProperty("properties")) {
            const t2 = this.properties, i2 = [
                ...Object.getOwnPropertyNames(t2),
                ...Object.getOwnPropertySymbols(t2)
            ];
            for (const s2 of i2)this.createProperty(s2, t2[s2]);
        }
        return this.elementStyles = this.finalizeStyles(this.styles), true;
    }
    static finalizeStyles(i2) {
        const s2 = [];
        if (Array.isArray(i2)) {
            const e2 = new Set(i2.flat(1 / 0).reverse());
            for (const i3 of e2)s2.unshift(S2(i3));
        } else i2 !== void 0 && s2.push(S2(i2));
        return s2;
    }
    static _$Ep(t, i2) {
        const s2 = i2.attribute;
        return s2 === false ? void 0 : typeof s2 == "string" ? s2 : typeof t == "string" ? t.toLowerCase() : void 0;
    }
    u() {
        var t;
        this._$E_ = new Promise((t2)=>this.enableUpdating = t2), this._$AL = new Map(), this._$Eg(), this.requestUpdate(), (t = this.constructor.h) === null || t === void 0 || t.forEach((t2)=>t2(this));
    }
    addController(t) {
        var i2, s2;
        ((i2 = this._$ES) !== null && i2 !== void 0 ? i2 : this._$ES = []).push(t), this.renderRoot !== void 0 && this.isConnected && ((s2 = t.hostConnected) === null || s2 === void 0 || s2.call(t));
    }
    removeController(t) {
        var i2;
        (i2 = this._$ES) === null || i2 === void 0 || i2.splice(this._$ES.indexOf(t) >>> 0, 1);
    }
    _$Eg() {
        this.constructor.elementProperties.forEach((t, i2)=>{
            this.hasOwnProperty(i2) && (this._$Ei.set(i2, this[i2]), delete this[i2]);
        });
    }
    createRenderRoot() {
        var t;
        const s2 = (t = this.shadowRoot) !== null && t !== void 0 ? t : this.attachShadow(this.constructor.shadowRootOptions);
        return i1(s2, this.constructor.elementStyles), s2;
    }
    connectedCallback() {
        var t;
        this.renderRoot === void 0 && (this.renderRoot = this.createRenderRoot()), this.enableUpdating(true), (t = this._$ES) === null || t === void 0 || t.forEach((t2)=>{
            var i2;
            return (i2 = t2.hostConnected) === null || i2 === void 0 ? void 0 : i2.call(t2);
        });
    }
    enableUpdating(t) {}
    disconnectedCallback() {
        var t;
        (t = this._$ES) === null || t === void 0 || t.forEach((t2)=>{
            var i2;
            return (i2 = t2.hostDisconnected) === null || i2 === void 0 ? void 0 : i2.call(t2);
        });
    }
    attributeChangedCallback(t, i2, s2) {
        this._$AK(t, s2);
    }
    _$EO(t, i2, s2 = l2) {
        var e2, r2;
        const h2 = this.constructor._$Ep(t, s2);
        if (h2 !== void 0 && s2.reflect === true) {
            const n2 = ((r2 = (e2 = s2.converter) === null || e2 === void 0 ? void 0 : e2.toAttribute) !== null && r2 !== void 0 ? r2 : o4.toAttribute)(i2, s2.type);
            this._$El = t, n2 == null ? this.removeAttribute(h2) : this.setAttribute(h2, n2), this._$El = null;
        }
    }
    _$AK(t, i2) {
        var s2, e2;
        const r2 = this.constructor, h2 = r2._$Ev.get(t);
        if (h2 !== void 0 && this._$El !== h2) {
            const t2 = r2.getPropertyOptions(h2), n2 = t2.converter, l2 = (e2 = (s2 = n2 == null ? void 0 : n2.fromAttribute) !== null && s2 !== void 0 ? s2 : typeof n2 == "function" ? n2 : null) !== null && e2 !== void 0 ? e2 : o4.fromAttribute;
            this._$El = h2, this[h2] = l2(i2, t2.type), this._$El = null;
        }
    }
    requestUpdate(t, i2, s2) {
        let e2 = true;
        t !== void 0 && (((s2 = s2 || this.constructor.getPropertyOptions(t)).hasChanged || n4)(this[t], i2) ? (this._$AL.has(t) || this._$AL.set(t, i2), s2.reflect === true && this._$El !== t && (this._$EC === void 0 && (this._$EC = new Map()), this._$EC.set(t, s2))) : e2 = false), !this.isUpdatePending && e2 && (this._$E_ = this._$Ej());
    }
    async _$Ej() {
        this.isUpdatePending = true;
        try {
            await this._$E_;
        } catch (t2) {
            Promise.reject(t2);
        }
        const t = this.scheduleUpdate();
        return t != null && await t, !this.isUpdatePending;
    }
    scheduleUpdate() {
        return this.performUpdate();
    }
    performUpdate() {
        var t;
        if (!this.isUpdatePending) return;
        this.hasUpdated, this._$Ei && (this._$Ei.forEach((t2, i3)=>this[i3] = t2), this._$Ei = void 0);
        let i2 = false;
        const s2 = this._$AL;
        try {
            i2 = this.shouldUpdate(s2), i2 ? (this.willUpdate(s2), (t = this._$ES) === null || t === void 0 || t.forEach((t2)=>{
                var i3;
                return (i3 = t2.hostUpdate) === null || i3 === void 0 ? void 0 : i3.call(t2);
            }), this.update(s2)) : this._$Ek();
        } catch (t2) {
            throw i2 = false, this._$Ek(), t2;
        }
        i2 && this._$AE(s2);
    }
    willUpdate(t) {}
    _$AE(t) {
        var i2;
        (i2 = this._$ES) === null || i2 === void 0 || i2.forEach((t2)=>{
            var i3;
            return (i3 = t2.hostUpdated) === null || i3 === void 0 ? void 0 : i3.call(t2);
        }), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t)), this.updated(t);
    }
    _$Ek() {
        this._$AL = new Map(), this.isUpdatePending = false;
    }
    get updateComplete() {
        return this.getUpdateComplete();
    }
    getUpdateComplete() {
        return this._$E_;
    }
    shouldUpdate(t) {
        return true;
    }
    update(t) {
        this._$EC !== void 0 && (this._$EC.forEach((t2, i2)=>this._$EO(i2, this[i2], t2)), this._$EC = void 0), this._$Ek();
    }
    updated(t) {}
    firstUpdated(t) {}
}
a2.finalized = true, a2.elementProperties = new Map(), a2.elementStyles = [], a2.shadowRootOptions = {
    mode: "open"
}, h2 == null || h2({
    ReactiveElement: a2
}), ((s4 = globalThis.reactiveElementVersions) !== null && s4 !== void 0 ? s4 : globalThis.reactiveElementVersions = []).push("1.3.4");
var t3;
const i2 = globalThis.trustedTypes, s5 = i2 ? i2.createPolicy("lit-html", {
    createHTML: (t2)=>t2
}) : void 0, e5 = `lit$${(Math.random() + "").slice(9)}$`, o5 = "?" + e5, n5 = `<${o5}>`, l3 = document, h3 = (t2 = "")=>l3.createComment(t2), r5 = (t2)=>t2 === null || typeof t2 != "object" && typeof t2 != "function", d2 = Array.isArray, u1 = (t2)=>d2(t2) || typeof (t2 == null ? void 0 : t2[Symbol.iterator]) == "function", c2 = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, v1 = /-->/g, a3 = />/g, f1 = RegExp(`>|[ 	
\f\r](?:([^\\s"'>=/]+)([ 	
\f\r]*=[ 	
\f\r]*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), _1 = /'/g, g1 = /"/g, m1 = /^(?:script|style|textarea|title)$/i, p1 = (t2)=>(i2, ...s2)=>({
            _$litType$: t2,
            strings: i2,
            values: s2
        }), $1 = p1(1), y1 = p1(2), b1 = Symbol.for("lit-noChange"), w1 = Symbol.for("lit-nothing"), x1 = new WeakMap(), T1 = (t2, i2, s2)=>{
    var e2, o2;
    const n2 = (e2 = s2 == null ? void 0 : s2.renderBefore) !== null && e2 !== void 0 ? e2 : i2;
    let l2 = n2._$litPart$;
    if (l2 === void 0) {
        const t3 = (o2 = s2 == null ? void 0 : s2.renderBefore) !== null && o2 !== void 0 ? o2 : null;
        n2._$litPart$ = l2 = new N1(i2.insertBefore(h3(), t3), t3, void 0, s2 != null ? s2 : {});
    }
    return l2._$AI(t2), l2;
}, A1 = l3.createTreeWalker(l3, 129, null, false), E1 = (t2, i2)=>{
    const o2 = t2.length - 1, l2 = [];
    let h2, r2 = i2 === 2 ? "<svg>" : "", d2 = c2;
    for(let i3 = 0; i3 < o2; i3++){
        const s2 = t2[i3];
        let o3, u3, p2 = -1, $2 = 0;
        for(; $2 < s2.length && (d2.lastIndex = $2, u3 = d2.exec(s2), u3 !== null);)$2 = d2.lastIndex, d2 === c2 ? u3[1] === "!--" ? d2 = v1 : u3[1] !== void 0 ? d2 = a3 : u3[2] !== void 0 ? (m1.test(u3[2]) && (h2 = RegExp("</" + u3[2], "g")), d2 = f1) : u3[3] !== void 0 && (d2 = f1) : d2 === f1 ? u3[0] === ">" ? (d2 = h2 != null ? h2 : c2, p2 = -1) : u3[1] === void 0 ? p2 = -2 : (p2 = d2.lastIndex - u3[2].length, o3 = u3[1], d2 = u3[3] === void 0 ? f1 : u3[3] === '"' ? g1 : _1) : d2 === g1 || d2 === _1 ? d2 = f1 : d2 === v1 || d2 === a3 ? d2 = c2 : (d2 = f1, h2 = void 0);
        const y2 = d2 === f1 && t2[i3 + 1].startsWith("/>") ? " " : "";
        r2 += d2 === c2 ? s2 + n5 : p2 >= 0 ? (l2.push(o3), s2.slice(0, p2) + "$lit$" + s2.slice(p2) + e5 + y2) : s2 + e5 + (p2 === -2 ? (l2.push(void 0), i3) : y2);
    }
    const u2 = r2 + (t2[o2] || "<?>") + (i2 === 2 ? "</svg>" : "");
    if (!Array.isArray(t2) || !t2.hasOwnProperty("raw")) throw Error("invalid template strings array");
    return [
        s5 !== void 0 ? s5.createHTML(u2) : u2,
        l2
    ];
};
class C1 {
    constructor({ strings: t2, _$litType$: s2 }, n2){
        let l2;
        this.parts = [];
        let r2 = 0, d2 = 0;
        const u2 = t2.length - 1, c2 = this.parts, [v2, a2] = E1(t2, s2);
        if (this.el = C1.createElement(v2, n2), A1.currentNode = this.el.content, s2 === 2) {
            const t3 = this.el.content, i2 = t3.firstChild;
            i2.remove(), t3.append(...i2.childNodes);
        }
        for(; (l2 = A1.nextNode()) !== null && c2.length < u2;){
            if (l2.nodeType === 1) {
                if (l2.hasAttributes()) {
                    const t3 = [];
                    for (const i2 of l2.getAttributeNames())if (i2.endsWith("$lit$") || i2.startsWith(e5)) {
                        const s3 = a2[d2++];
                        if (t3.push(i2), s3 !== void 0) {
                            const t4 = l2.getAttribute(s3.toLowerCase() + "$lit$").split(e5), i3 = /([.?@])?(.*)/.exec(s3);
                            c2.push({
                                type: 1,
                                index: r2,
                                name: i3[2],
                                strings: t4,
                                ctor: i3[1] === "." ? M1 : i3[1] === "?" ? k1 : i3[1] === "@" ? H1 : S3
                            });
                        } else c2.push({
                            type: 6,
                            index: r2
                        });
                    }
                    for (const i2 of t3)l2.removeAttribute(i2);
                }
                if (m1.test(l2.tagName)) {
                    const t3 = l2.textContent.split(e5), s3 = t3.length - 1;
                    if (s3 > 0) {
                        l2.textContent = i2 ? i2.emptyScript : "";
                        for(let i2 = 0; i2 < s3; i2++)l2.append(t3[i2], h3()), A1.nextNode(), c2.push({
                            type: 2,
                            index: ++r2
                        });
                        l2.append(t3[s3], h3());
                    }
                }
            } else if (l2.nodeType === 8) if (l2.data === o5) c2.push({
                type: 2,
                index: r2
            });
            else {
                let t3 = -1;
                for(; (t3 = l2.data.indexOf(e5, t3 + 1)) !== -1;)c2.push({
                    type: 7,
                    index: r2
                }), t3 += e5.length - 1;
            }
            r2++;
        }
    }
    static createElement(t2, i2) {
        const s2 = l3.createElement("template");
        return s2.innerHTML = t2, s2;
    }
}
function P1(t2, i2, s2 = t2, e2) {
    var o2, n2, l2, h2;
    if (i2 === b1) return i2;
    let d2 = e2 !== void 0 ? (o2 = s2._$Cl) === null || o2 === void 0 ? void 0 : o2[e2] : s2._$Cu;
    const u2 = r5(i2) ? void 0 : i2._$litDirective$;
    return (d2 == null ? void 0 : d2.constructor) !== u2 && ((n2 = d2 == null ? void 0 : d2._$AO) === null || n2 === void 0 || n2.call(d2, false), u2 === void 0 ? d2 = void 0 : (d2 = new u2(t2), d2._$AT(t2, s2, e2)), e2 !== void 0 ? ((l2 = (h2 = s2)._$Cl) !== null && l2 !== void 0 ? l2 : h2._$Cl = [])[e2] = d2 : s2._$Cu = d2), d2 !== void 0 && (i2 = P1(t2, d2._$AS(t2, i2.values), d2, e2)), i2;
}
class V1 {
    constructor(t2, i2){
        this.v = [], this._$AN = void 0, this._$AD = t2, this._$AM = i2;
    }
    get parentNode() {
        return this._$AM.parentNode;
    }
    get _$AU() {
        return this._$AM._$AU;
    }
    p(t2) {
        var i2;
        const { el: { content: s2 }, parts: e2 } = this._$AD, o2 = ((i2 = t2 == null ? void 0 : t2.creationScope) !== null && i2 !== void 0 ? i2 : l3).importNode(s2, true);
        A1.currentNode = o2;
        let n2 = A1.nextNode(), h2 = 0, r2 = 0, d2 = e2[0];
        for(; d2 !== void 0;){
            if (h2 === d2.index) {
                let i3;
                d2.type === 2 ? i3 = new N1(n2, n2.nextSibling, this, t2) : d2.type === 1 ? i3 = new d2.ctor(n2, d2.name, d2.strings, this, t2) : d2.type === 6 && (i3 = new I1(n2, this, t2)), this.v.push(i3), d2 = e2[++r2];
            }
            h2 !== (d2 == null ? void 0 : d2.index) && (n2 = A1.nextNode(), h2++);
        }
        return o2;
    }
    m(t2) {
        let i2 = 0;
        for (const s2 of this.v)s2 !== void 0 && (s2.strings !== void 0 ? (s2._$AI(t2, s2, i2), i2 += s2.strings.length - 2) : s2._$AI(t2[i2])), i2++;
    }
}
class N1 {
    constructor(t2, i2, s2, e2){
        var o2;
        this.type = 2, this._$AH = w1, this._$AN = void 0, this._$AA = t2, this._$AB = i2, this._$AM = s2, this.options = e2, this._$C_ = (o2 = e2 == null ? void 0 : e2.isConnected) === null || o2 === void 0 || o2;
    }
    get _$AU() {
        var t2, i2;
        return (i2 = (t2 = this._$AM) === null || t2 === void 0 ? void 0 : t2._$AU) !== null && i2 !== void 0 ? i2 : this._$C_;
    }
    get parentNode() {
        let t2 = this._$AA.parentNode;
        const i2 = this._$AM;
        return i2 !== void 0 && t2.nodeType === 11 && (t2 = i2.parentNode), t2;
    }
    get startNode() {
        return this._$AA;
    }
    get endNode() {
        return this._$AB;
    }
    _$AI(t2, i2 = this) {
        t2 = P1(this, t2, i2), r5(t2) ? t2 === w1 || t2 == null || t2 === "" ? (this._$AH !== w1 && this._$AR(), this._$AH = w1) : t2 !== this._$AH && t2 !== b1 && this.T(t2) : t2._$litType$ !== void 0 ? this.$(t2) : t2.nodeType !== void 0 ? this.k(t2) : u1(t2) ? this.S(t2) : this.T(t2);
    }
    j(t2, i2 = this._$AB) {
        return this._$AA.parentNode.insertBefore(t2, i2);
    }
    k(t2) {
        this._$AH !== t2 && (this._$AR(), this._$AH = this.j(t2));
    }
    T(t2) {
        this._$AH !== w1 && r5(this._$AH) ? this._$AA.nextSibling.data = t2 : this.k(l3.createTextNode(t2)), this._$AH = t2;
    }
    $(t2) {
        var i2;
        const { values: s2, _$litType$: e2 } = t2, o2 = typeof e2 == "number" ? this._$AC(t2) : (e2.el === void 0 && (e2.el = C1.createElement(e2.h, this.options)), e2);
        if (((i2 = this._$AH) === null || i2 === void 0 ? void 0 : i2._$AD) === o2) this._$AH.m(s2);
        else {
            const t3 = new V1(o2, this), i3 = t3.p(this.options);
            t3.m(s2), this.k(i3), this._$AH = t3;
        }
    }
    _$AC(t2) {
        let i2 = x1.get(t2.strings);
        return i2 === void 0 && x1.set(t2.strings, i2 = new C1(t2)), i2;
    }
    S(t2) {
        d2(this._$AH) || (this._$AH = [], this._$AR());
        const i2 = this._$AH;
        let s2, e2 = 0;
        for (const o2 of t2)e2 === i2.length ? i2.push(s2 = new N1(this.j(h3()), this.j(h3()), this, this.options)) : s2 = i2[e2], s2._$AI(o2), e2++;
        e2 < i2.length && (this._$AR(s2 && s2._$AB.nextSibling, e2), i2.length = e2);
    }
    _$AR(t2 = this._$AA.nextSibling, i2) {
        var s2;
        for((s2 = this._$AP) === null || s2 === void 0 || s2.call(this, false, true, i2); t2 && t2 !== this._$AB;){
            const i3 = t2.nextSibling;
            t2.remove(), t2 = i3;
        }
    }
    setConnected(t2) {
        var i2;
        this._$AM === void 0 && (this._$C_ = t2, (i2 = this._$AP) === null || i2 === void 0 || i2.call(this, t2));
    }
}
class S3 {
    constructor(t2, i2, s2, e2, o2){
        this.type = 1, this._$AH = w1, this._$AN = void 0, this.element = t2, this.name = i2, this._$AM = e2, this.options = o2, s2.length > 2 || s2[0] !== "" || s2[1] !== "" ? (this._$AH = Array(s2.length - 1).fill(new String()), this.strings = s2) : this._$AH = w1;
    }
    get tagName() {
        return this.element.tagName;
    }
    get _$AU() {
        return this._$AM._$AU;
    }
    _$AI(t2, i2 = this, s2, e2) {
        const o2 = this.strings;
        let n2 = false;
        if (o2 === void 0) t2 = P1(this, t2, i2, 0), n2 = !r5(t2) || t2 !== this._$AH && t2 !== b1, n2 && (this._$AH = t2);
        else {
            const e3 = t2;
            let l2, h2;
            for(t2 = o2[0], l2 = 0; l2 < o2.length - 1; l2++)h2 = P1(this, e3[s2 + l2], i2, l2), h2 === b1 && (h2 = this._$AH[l2]), n2 || (n2 = !r5(h2) || h2 !== this._$AH[l2]), h2 === w1 ? t2 = w1 : t2 !== w1 && (t2 += (h2 != null ? h2 : "") + o2[l2 + 1]), this._$AH[l2] = h2;
        }
        n2 && !e2 && this.P(t2);
    }
    P(t2) {
        t2 === w1 ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t2 != null ? t2 : "");
    }
}
class M1 extends S3 {
    constructor(){
        super(...arguments), this.type = 3;
    }
    P(t2) {
        this.element[this.name] = t2 === w1 ? void 0 : t2;
    }
}
const R1 = i2 ? i2.emptyScript : "";
class k1 extends S3 {
    constructor(){
        super(...arguments), this.type = 4;
    }
    P(t2) {
        t2 && t2 !== w1 ? this.element.setAttribute(this.name, R1) : this.element.removeAttribute(this.name);
    }
}
class H1 extends S3 {
    constructor(t2, i2, s2, e2, o2){
        super(t2, i2, s2, e2, o2), this.type = 5;
    }
    _$AI(t2, i2 = this) {
        var s2;
        if ((t2 = (s2 = P1(this, t2, i2, 0)) !== null && s2 !== void 0 ? s2 : w1) === b1) return;
        const e2 = this._$AH, o2 = t2 === w1 && e2 !== w1 || t2.capture !== e2.capture || t2.once !== e2.once || t2.passive !== e2.passive, n2 = t2 !== w1 && (e2 === w1 || o2);
        o2 && this.element.removeEventListener(this.name, this, e2), n2 && this.element.addEventListener(this.name, this, t2), this._$AH = t2;
    }
    handleEvent(t2) {
        var i2, s2;
        typeof this._$AH == "function" ? this._$AH.call((s2 = (i2 = this.options) === null || i2 === void 0 ? void 0 : i2.host) !== null && s2 !== void 0 ? s2 : this.element, t2) : this._$AH.handleEvent(t2);
    }
}
class I1 {
    constructor(t2, i2, s2){
        this.element = t2, this.type = 6, this._$AN = void 0, this._$AM = i2, this.options = s2;
    }
    get _$AU() {
        return this._$AM._$AU;
    }
    _$AI(t2) {
        P1(this, t2);
    }
}
const z1 = window.litHtmlPolyfillSupport;
z1 == null || z1(C1, N1), ((t3 = globalThis.litHtmlVersions) !== null && t3 !== void 0 ? t3 : globalThis.litHtmlVersions = []).push("2.2.7");
var l4, o6;
class s6 extends a2 {
    constructor(){
        super(...arguments), this.renderOptions = {
            host: this
        }, this._$Do = void 0;
    }
    createRenderRoot() {
        var t, e;
        const i = super.createRenderRoot();
        return (t = (e = this.renderOptions).renderBefore) !== null && t !== void 0 || (e.renderBefore = i.firstChild), i;
    }
    update(t) {
        const i = this.render();
        this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = T1(i, this.renderRoot, this.renderOptions);
    }
    connectedCallback() {
        var t;
        super.connectedCallback(), (t = this._$Do) === null || t === void 0 || t.setConnected(true);
    }
    disconnectedCallback() {
        var t;
        super.disconnectedCallback(), (t = this._$Do) === null || t === void 0 || t.setConnected(false);
    }
    render() {
        return b1;
    }
}
s6.finalized = true, s6._$litElement$ = true, (l4 = globalThis.litElementHydrateSupport) === null || l4 === void 0 || l4.call(globalThis, {
    LitElement: s6
});
const n6 = globalThis.litElementPolyfillSupport;
n6 == null || n6({
    LitElement: s6
});
((o6 = globalThis.litElementVersions) !== null && o6 !== void 0 ? o6 : globalThis.litElementVersions = []).push("3.2.2");
async function listDurableObjectsNamespaces(opts) {
    const { accountId, apiToken, perPage } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces`);
    if (typeof perPage === 'number') url.searchParams.set('per_page', perPage.toString());
    return (await execute('listDurableObjectsNamespaces', 'GET', url.toString(), apiToken)).result;
}
async function listScripts(opts) {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts`;
    return (await execute('listScripts', 'GET', url, apiToken)).result;
}
async function listTails(opts) {
    const { accountId, apiToken, scriptName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails`;
    return (await execute('listTails', 'GET', url, apiToken)).result;
}
async function createTail(opts) {
    const { accountId, apiToken, scriptName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails`;
    return (await execute('createTail', 'POST', url, apiToken)).result;
}
class CloudflareApi {
    static DEBUG = false;
    static URL_TRANSFORMER = (v)=>v;
}
const APPLICATION_JSON = 'application/json';
const APPLICATION_JSON_UTF8 = 'application/json; charset=utf-8';
const APPLICATION_OCTET_STREAM = 'application/octet-stream';
const IMAGE_PNG = 'image/png';
const TEXT_PLAIN_UTF8 = 'text/plain; charset=utf-8';
function computeAccountBaseUrl(accountId) {
    return CloudflareApi.URL_TRANSFORMER(`https://api.cloudflare.com/client/v4/accounts/${accountId}`);
}
function isStringRecord(obj) {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}
async function execute(op, method, url, apiToken, body, responseType = 'json', requestContentType) {
    if (CloudflareApi.DEBUG) console.log(`${op}: ${method} ${url}`);
    const headers = new Headers({
        'Authorization': `Bearer ${apiToken}`
    });
    let bodyObj;
    if (typeof body === 'string') {
        headers.set('Content-Type', TEXT_PLAIN_UTF8);
    } else if (body instanceof Uint8Array) {
        headers.set('Content-Type', APPLICATION_OCTET_STREAM);
        bodyObj = {
            bytes: body.length
        };
    } else if (isStringRecord(body) || Array.isArray(body)) {
        headers.set('Content-Type', requestContentType ?? APPLICATION_JSON_UTF8);
        bodyObj = body;
        body = JSON.stringify(body, undefined, 2);
    }
    if (CloudflareApi.DEBUG) console.log([
        ...headers
    ].map((v)=>v.join(': ')).join('\n'));
    if (CloudflareApi.DEBUG && bodyObj) console.log(bodyObj);
    const fetchResponse = await fetch(url, {
        method,
        headers,
        body
    });
    if (CloudflareApi.DEBUG) console.log(`${fetchResponse.status} ${fetchResponse.url}`);
    if (CloudflareApi.DEBUG) console.log([
        ...fetchResponse.headers
    ].map((v)=>v.join(': ')).join('\n'));
    const contentType = fetchResponse.headers.get('Content-Type') || '';
    const knownBinaryContentType = [
        APPLICATION_OCTET_STREAM,
        IMAGE_PNG
    ].includes(contentType);
    if (responseType === 'empty' && fetchResponse.status >= 200 && fetchResponse.status < 300) {
        if (contentType !== '') throw new Error(`Unexpected content-type (expected none): ${contentType}, fetchResponse=${fetchResponse}, body=${await fetchResponse.text()}`);
        const text = await fetchResponse.text();
        if (text !== '') throw new Error(`Unexpected body (expected none): ${text}, fetchResponse=${fetchResponse}, body=${text}`);
        return;
    }
    if ((responseType === 'bytes' || responseType === 'bytes?') && knownBinaryContentType) {
        const buffer = await fetchResponse.arrayBuffer();
        return new Uint8Array(buffer);
    }
    if (responseType === 'text') {
        return await fetchResponse.text();
    }
    if (responseType === 'form') {
        return await fetchResponse.formData();
    }
    if (responseType === 'sse') {
        if (contentType !== 'text/event-stream') throw new Error(`Unexpected content-type (expected text/event-stream): ${contentType}, fetchResponse=${fetchResponse}, body=${await fetchResponse.text()}`);
        if (!fetchResponse.body) throw new Error(`No sse body!`);
        return fetchResponse.body;
    }
    if (![
        APPLICATION_JSON_UTF8.replaceAll(' ', ''),
        APPLICATION_JSON
    ].includes(contentType.toLowerCase().replaceAll(' ', ''))) {
        throw new Error(`Unexpected content-type: ${contentType}, fetchResponse=${fetchResponse}, body=${knownBinaryContentType ? `<${(await fetchResponse.arrayBuffer()).byteLength} bytes>` : await fetchResponse.text()}`);
    }
    const apiResponse = await fetchResponse.json();
    if (CloudflareApi.DEBUG) console.log(apiResponse);
    if (!apiResponse.success) {
        if (fetchResponse.status === 404 && [
            'bytes?',
            'json?'
        ].includes(responseType)) return undefined;
        throw new CloudflareApiError(`${op} failed: status=${fetchResponse.status}, errors=${apiResponse.errors.map((v)=>`${v.code} ${v.message}`).join(', ')}`, fetchResponse.status, apiResponse.errors);
    }
    return apiResponse;
}
class CloudflareApiError extends Error {
    status;
    errors;
    constructor(message, status, errors){
        super(message);
        this.status = status;
        this.errors = errors;
    }
}
function setSubtract(lhs, rhs) {
    const rt = new Set(lhs);
    for (const item of rhs){
        rt.delete(item);
    }
    return rt;
}
function setUnion(lhs, rhs) {
    const rt = new Set(lhs);
    for (const item of rhs){
        rt.add(item);
    }
    return rt;
}
function setIntersect(lhs, rhs) {
    const rt = new Set();
    for (const item of lhs){
        if (rhs.has(item)) rt.add(item);
    }
    for (const item of rhs){
        if (lhs.has(item)) rt.add(item);
    }
    return rt;
}
function setEqual(lhs, rhs) {
    return lhs.size === rhs.size && [
        ...lhs
    ].every((v)=>rhs.has(v));
}
function checkEqual(name, value, expected) {
    if (value !== expected) throw new Error(`Bad ${name}: expected ${expected}, found ${value}`);
}
function checkMatches(name, value, pattern) {
    if (!pattern.test(value)) throw new Error(`Bad ${name}: ${value}`);
    return value;
}
function isStringRecord1(obj) {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}
function parseHeaderFilter(header) {
    const i = header.indexOf(':');
    if (i < 0) return {
        key: header
    };
    const key = header.substring(0, i).trim();
    const query = header.substring(i + 1).trim();
    return {
        key,
        query
    };
}
const REQUIRED_TAIL_MESSAGE_KEYS = new Set([
    'outcome',
    'scriptName',
    'exceptions',
    'logs',
    'eventTimestamp',
    'event'
]);
const ALL_TAIL_MESSAGE_KEYS = new Set([
    ...REQUIRED_TAIL_MESSAGE_KEYS,
    'diagnosticsChannelEvents',
    'scriptVersion',
    'truncated'
]);
const KNOWN_OUTCOMES = new Set([
    'ok',
    'exception',
    'exceededCpu',
    'canceled',
    'unknown'
]);
function parseTailMessage(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessage: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_KEYS, ALL_TAIL_MESSAGE_KEYS);
    const objAsAny = obj;
    const { outcome, scriptName, scriptVersion, eventTimestamp, diagnosticsChannelEvents, truncated } = objAsAny;
    if (diagnosticsChannelEvents !== undefined && !Array.isArray(diagnosticsChannelEvents)) throw new Error(JSON.stringify(diagnosticsChannelEvents));
    if (scriptVersion !== undefined && !(isStringRecord1(scriptVersion) && typeof scriptVersion.id === 'string')) throw new Error(`Unexpected scriptVersion: ${JSON.stringify(scriptVersion)}`);
    if (!KNOWN_OUTCOMES.has(outcome)) throw new Error(`Bad outcome: expected one of [${[
        ...KNOWN_OUTCOMES
    ].join(', ')}], found ${JSON.stringify(outcome)}`);
    if (scriptName !== null && typeof scriptName !== 'string') throw new Error(`Bad scriptName: expected string or null, found ${JSON.stringify(scriptName)}`);
    if (!(truncated === undefined || typeof truncated === 'boolean')) throw new Error(`Bad truncated: expected boolean, found ${JSON.stringify(truncated)}`);
    const logs = parseLogs(objAsAny.logs);
    const exceptions = parseExceptions(objAsAny.exceptions);
    if (eventTimestamp === null && objAsAny.event === null) {
        return {
            outcome,
            scriptName,
            exceptions,
            logs,
            eventTimestamp: Date.now(),
            event: null
        };
    }
    if (!(typeof eventTimestamp === 'number' && eventTimestamp > 0)) throw new Error(`Bad eventTimestamp: expected positive number, found ${JSON.stringify(eventTimestamp)}`);
    const event = objAsAny.event && objAsAny.event.request ? parseTailMessageRequestEvent(objAsAny.event) : objAsAny.event && objAsAny.event.queue ? parseTailMessageQueueEvent(objAsAny.event) : objAsAny.event && objAsAny.event.cron ? parseTailMessageCronEvent(objAsAny.event) : objAsAny.event && objAsAny.event.mailFrom ? parseTailMessageEmailEvent(objAsAny.event) : objAsAny.event && objAsAny.event.type === 'overload' ? parseTailMessageOverloadEvent(objAsAny.event) : objAsAny.event && objAsAny.event.getWebSocketEvent ? parseTailMessageGetWebSocketEvent(objAsAny.event) : parseTailMessageAlarmEvent(objAsAny.event);
    return {
        outcome,
        scriptName,
        exceptions,
        logs,
        eventTimestamp,
        event,
        diagnosticsChannelEvents,
        truncated
    };
}
function parseLogs(obj) {
    if (!Array.isArray(obj)) throw new Error(`Bad logs: expected array, found ${JSON.stringify(obj)}`);
    return [
        ...obj
    ].map(parseTailMessageLog);
}
function parseExceptions(obj) {
    if (!Array.isArray(obj)) throw new Error(`Bad exceptions: expected array, found ${JSON.stringify(obj)}`);
    return [
        ...obj
    ].map(parseTailMessageException);
}
function isLogMessagePart(value) {
    const t = typeof value;
    return t === 'string' || t === 'number' || t === 'boolean' || t === 'undefined' || t === 'object';
}
const REQUIRED_TAIL_MESSAGE_LOG_KEYS = new Set([
    'message',
    'level',
    'timestamp'
]);
function parseTailMessageLog(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageLog: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_LOG_KEYS);
    const objAsAny = obj;
    const message = parseLogMessagePartArray(objAsAny.message, 'message');
    const { level, timestamp } = objAsAny;
    if (!(typeof level === 'string')) throw new Error(`Bad level: expected string, found ${JSON.stringify(level)}`);
    if (!(typeof timestamp === 'number' && timestamp > 0)) throw new Error(`Bad timestamp: expected positive number, found ${JSON.stringify(timestamp)}`);
    return {
        message,
        level,
        timestamp
    };
}
const REQUIRED_TAIL_MESSAGE_EXCEPTION_KEYS = new Set([
    'name',
    'message',
    'timestamp'
]);
function parseTailMessageException(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageException: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EXCEPTION_KEYS);
    const objAsAny = obj;
    const { name, message, timestamp } = objAsAny;
    if (!(typeof name === 'string')) throw new Error(`Bad name: expected string, found ${JSON.stringify(name)}`);
    if (!(typeof message === 'string')) throw new Error(`Bad message: expected string, found ${JSON.stringify(message)}`);
    if (!(typeof timestamp === 'number' && timestamp > 0)) throw new Error(`Bad timestamp: expected positive number, found ${JSON.stringify(timestamp)}`);
    return {
        name,
        message,
        timestamp
    };
}
const REQUIRED_TAIL_MESSAGE_QUEUE_EVENT_KEYS = new Set([
    'batchSize',
    'queue'
]);
function isTailMessageQueueEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_QUEUE_EVENT_KEYS);
}
function parseTailMessageQueueEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageQueueEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_QUEUE_EVENT_KEYS);
    const objAsAny = obj;
    const { batchSize, queue } = objAsAny;
    if (!(typeof batchSize === 'number' && batchSize > 0)) throw new Error(`Bad batchSize: expected positive number, found ${JSON.stringify(batchSize)}`);
    if (!(typeof queue === 'string')) throw new Error(`Bad queue: expected string, found ${JSON.stringify(queue)}`);
    return {
        batchSize,
        queue
    };
}
const REQUIRED_TAIL_MESSAGE_ALARM_EVENT_KEYS = new Set([
    'scheduledTime'
]);
function isTailMessageAlarmEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_ALARM_EVENT_KEYS);
}
function parseTailMessageAlarmEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageAlarmEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_ALARM_EVENT_KEYS);
    const objAsAny = obj;
    const { scheduledTime } = objAsAny;
    if (!(typeof scheduledTime === 'string')) throw new Error(`Bad scheduledTime: expected string, found ${JSON.stringify(scheduledTime)}`);
    return {
        scheduledTime
    };
}
const REQUIRED_TAIL_MESSAGE_CRON_EVENT_KEYS = new Set([
    'cron',
    'scheduledTime'
]);
function isTailMessageCronEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_CRON_EVENT_KEYS);
}
function parseTailMessageCronEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageCronEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_CRON_EVENT_KEYS);
    const objAsAny = obj;
    const { cron, scheduledTime } = objAsAny;
    if (!(typeof cron === 'string')) throw new Error(`Bad cron: expected string, found ${JSON.stringify(cron)}`);
    if (!(typeof scheduledTime === 'number' && scheduledTime > 0)) throw new Error(`Bad scheduledTime: expected positive number, found ${JSON.stringify(scheduledTime)}`);
    return {
        cron,
        scheduledTime
    };
}
const REQUIRED_TAIL_MESSAGE_EMAIL_EVENT_KEYS = new Set([
    'rawSize',
    'rcptTo',
    'mailFrom'
]);
function isTailMessageEmailEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_EMAIL_EVENT_KEYS);
}
function parseTailMessageEmailEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageEmailEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EMAIL_EVENT_KEYS);
    const objAsAny = obj;
    const { rawSize, rcptTo, mailFrom } = objAsAny;
    if (!(typeof rawSize === 'number' && rawSize > 0)) throw new Error(`Bad rawSize: expected positive number, found ${JSON.stringify(rawSize)}`);
    if (!(typeof rcptTo === 'string')) throw new Error(`Bad rcptTo: expected string, found ${JSON.stringify(rcptTo)}`);
    if (!(typeof mailFrom === 'string')) throw new Error(`Bad mailFrom: expected string, found ${JSON.stringify(mailFrom)}`);
    return {
        rawSize,
        rcptTo,
        mailFrom
    };
}
const REQUIRED_TAIL_MESSAGE_OVERLOAD_EVENT_KEYS = new Set([
    'type',
    'message'
]);
function isTailMessageOverloadEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_OVERLOAD_EVENT_KEYS) && obj.type === 'overload';
}
function parseTailMessageOverloadEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageOverloadEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_OVERLOAD_EVENT_KEYS);
    const objAsAny = obj;
    const { type, message } = objAsAny;
    if (!(type === 'overload')) throw new Error(`Bad type: expected "overload", found ${JSON.stringify(type)}`);
    if (!(typeof message === 'string')) throw new Error(`Bad message: expected string, found ${JSON.stringify(message)}`);
    return {
        type,
        message
    };
}
const REQUIRED_TAIL_MESSAGE_GET_WEB_SOCKET_EVENT_KEYS = new Set([
    'getWebSocketEvent'
]);
function isTailMessageGetWebSocketEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_GET_WEB_SOCKET_EVENT_KEYS);
}
function parseTailMessageGetWebSocketEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageGetWebSocketEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_GET_WEB_SOCKET_EVENT_KEYS);
    const objAsAny = obj;
    const { getWebSocketEvent } = objAsAny;
    if (!isStringRecord1(getWebSocketEvent)) throw new Error(`Bad type: expected record, found ${JSON.stringify(getWebSocketEvent)}`);
    return {
        getWebSocketEvent
    };
}
const REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS = new Set([
    'request'
]);
const OPTIONAL_TAIL_MESSAGE_REQUEST_EVENT_KEYS = new Set([
    'response'
]);
const ALL_TAIL_MESSAGE_REQUEST_EVENT_KEYS = setUnion(REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS, OPTIONAL_TAIL_MESSAGE_REQUEST_EVENT_KEYS);
function parseTailMessageRequestEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageRequestEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS, ALL_TAIL_MESSAGE_REQUEST_EVENT_KEYS);
    const objAsAny = obj;
    const request = parseTailMessageEventRequest(objAsAny.request);
    const response = parseTailMessageEventResponse(objAsAny.response);
    return {
        request,
        response
    };
}
const REQUIRED_TAIL_MESSAGE_EVENT_REQUEST_KEYS = new Set([
    'url',
    'method',
    'headers'
]);
const OPTIONAL_TAIL_MESSAGE_EVENT_REQUEST_KEYS = new Set([
    'cf'
]);
const ALL_TAIL_MESSAGE_EVENT_REQUEST_KEYS = setUnion(REQUIRED_TAIL_MESSAGE_EVENT_REQUEST_KEYS, OPTIONAL_TAIL_MESSAGE_EVENT_REQUEST_KEYS);
function parseTailMessageEventRequest(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageEventRequest: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EVENT_REQUEST_KEYS, ALL_TAIL_MESSAGE_EVENT_REQUEST_KEYS);
    const objAsAny = obj;
    const { url, method } = objAsAny;
    if (!(typeof url === 'string')) throw new Error(`Bad url: expected string, found ${JSON.stringify(url)}`);
    if (!(typeof method === 'string')) throw new Error(`Bad method: expected string, found ${JSON.stringify(method)}`);
    const headers = parseStringRecord(objAsAny.headers, 'headers');
    const cf = objAsAny.cf === undefined ? undefined : parseIncomingRequestCfProperties(objAsAny.cf);
    return {
        url,
        method,
        headers,
        cf
    };
}
const REQUIRED_TAIL_MESSAGE_EVENT_RESPONSE_KEYS = new Set([
    'status'
]);
function parseTailMessageEventResponse(obj) {
    if (obj === undefined) return undefined;
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageEventResponse: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EVENT_RESPONSE_KEYS);
    const objAsAny = obj;
    const { status } = objAsAny;
    if (!(typeof status === 'number')) throw new Error(`Bad status: expected number, found ${JSON.stringify(status)}`);
    return {
        status
    };
}
function checkKeys(obj, requiredKeys, allKeys) {
    const keys = new Set(Object.keys(obj));
    const missingKeys = setSubtract(requiredKeys, keys);
    if (missingKeys.size > 0) throw new Error(`Missing keys: ${[
        ...missingKeys
    ].join(', ')}`);
    const extraKeys = setSubtract(keys, allKeys || requiredKeys);
    if (extraKeys.size > 0) throw new Error(`Extra keys: ${[
        ...extraKeys
    ].join(', ')}`);
}
function parseStringRecord(obj, name) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad ${name}: Expected string record, found ${JSON.stringify(obj)}`);
    for (const [_, value] of Object.entries(obj)){
        if (typeof value !== 'string') throw new Error(`Bad ${name}: Expected string record, found ${JSON.stringify(obj)}`);
    }
    return obj;
}
function parseLogMessagePartArray(obj, name) {
    if (typeof obj !== 'object' || !Array.isArray(obj)) throw new Error(`Bad ${name}: Expected log message part array, found ${JSON.stringify(obj)}`);
    for (const value of obj){
        if (!isLogMessagePart(value)) throw new Error(`Bad ${name}: Expected log message part array, found ${JSON.stringify(obj)}`);
    }
    return obj;
}
function parseIncomingRequestCfProperties(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad cf: Expected object, found ${JSON.stringify(obj)}`);
    return obj;
}
function dumpMessagePretty(message, logger, additionalLogs = []) {
    const time = formatLocalYyyyMmDdHhMmSs(new Date(message.eventTimestamp));
    const outcome = PRETTY_OUTCOMES.get(message.outcome) || message.outcome;
    const outcomeColor = message.outcome === 'ok' ? 'green' : 'red';
    const { props, remainingLogs } = parseLogProps(message.logs);
    if (isTailMessageCronEvent(message.event)) {
        const colo = props.colo || '???';
        logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] %c${message.event.cron}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else if (isTailMessageAlarmEvent(message.event)) {
        const colo = props.colo || '???';
        logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] %c${message.event.scheduledTime}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else if (isTailMessageQueueEvent(message.event)) {
        const colo = props.colo || '???';
        const { queue, batchSize } = message.event;
        logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] %c${queue} ${batchSize} message${batchSize === 1 ? '' : 's'}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else if (isTailMessageEmailEvent(message.event)) {
        const colo = props.colo || '???';
        const { rawSize, mailFrom, rcptTo } = message.event;
        logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] %c${mailFrom} -> ${rcptTo} ${rawSize} byte${rawSize === 1 ? '' : 's'}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else if (isTailMessageOverloadEvent(message.event)) {
        const colo = props.colo || '???';
        const { type, message: msg } = message.event;
        logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] %c${type}: ${msg}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else if (isTailMessageGetWebSocketEvent(message.event)) {
        const colo = props.colo || '???';
        const { getWebSocketEvent } = message.event;
        logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] %c${JSON.stringify(getWebSocketEvent)}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else {
        const { method, url, cf } = message.event === null || isTailMessageCronEvent(message.event) || isTailMessageAlarmEvent(message.event) || isTailMessageQueueEvent(message.event) || isTailMessageEmailEvent(message.event) || isTailMessageOverloadEvent(message.event) || isTailMessageGetWebSocketEvent(message.event) ? {
            method: undefined,
            url: undefined,
            cf: undefined
        } : message.event.request;
        const unredactedUrl = typeof props.url === 'string' ? props.url : url;
        const colo = cf?.colo || props.colo || '???';
        if (cf === undefined) {
            const { durableObjectClass, durableObjectName, durableObjectId } = computeDurableObjectInfo(props);
            const doTemplates = [];
            const doStyles = [];
            if (durableObjectClass) {
                doTemplates.push(`%c${durableObjectClass}%c`);
                doStyles.push(`color: gray; x-durable-object-class: '${durableObjectClass}'`, '');
            }
            if (durableObjectName) {
                doTemplates.push(`%c${durableObjectName}%c`);
                doStyles.push(`color: gray; x-durable-object-name: '${durableObjectName}'`, '');
            }
            if (durableObjectId) {
                doTemplates.push(`%c${computeShortDurableObjectId(durableObjectId)}%c`);
                doStyles.push(`color: gray; x-durable-object-id: '${durableObjectId}'`, '');
            }
            if (doTemplates.length === 0) {
                doTemplates.push(`%cDO%c`);
                doStyles.push('color: gray', '');
            }
            if (message.event === null) {
                logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] [${doTemplates.join(' ')}] ALARM`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', ...doStyles);
            } else {
                logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] [${doTemplates.join(' ')}] ${method} %c${unredactedUrl}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', ...doStyles, 'color: red; font-style: bold;');
            }
        } else {
            logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] ${method} %c${unredactedUrl}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
        }
    }
    for (const { data } of additionalLogs){
        logger(...data);
    }
    for (const { level, message: logMessage } of remainingLogs){
        const levelColor = LOG_LEVEL_COLORS.get(level) || 'gray';
        const logMessages = logMessage.map(formatLogMessagePart).join(', ');
        logger(` %c|%c [%c${level}%c] ${logMessages}`, 'color: gray', '', `color: ${levelColor}`, '');
    }
    for (const { name, message: exceptionMessage } of message.exceptions){
        logger(` %c|%c [%c${name}%c] %c${exceptionMessage}`, 'color: gray', '', `color: red; font-style: bold`, '', 'color: red');
    }
    if (message.event) {
        if (isTailMessageCronEvent(message.event)) {
            const { scheduledTime, cron } = message.event;
            const scheduledInstant = new Date(scheduledTime).toISOString();
            logger(` %c|%c [%ccron%c] %c${cron} ${scheduledInstant}`, 'color: gray', '', `color: gray`, '', 'color: gray');
        } else if (isTailMessageAlarmEvent(message.event)) {
            const { scheduledTime } = message.event;
            logger(` %c|%c [%calarm%c] %c${scheduledTime}`, 'color: gray', '', `color: gray`, '', 'color: gray');
        } else if (isTailMessageQueueEvent(message.event)) {
            const { batchSize, queue } = message.event;
            logger(` %c|%c [%cqueue%c] %c${queue} ${batchSize} message${batchSize === 1 ? '' : 's'}`, 'color: gray', '', `color: gray`, '', 'color: gray');
        } else if (isTailMessageEmailEvent(message.event)) {
            const { rawSize, rcptTo, mailFrom } = message.event;
            logger(` %c|%c [%cemail%c] %c${mailFrom} -> ${rcptTo} ${rawSize} rawSize${rawSize === 1 ? '' : 's'}`, 'color: gray', '', `color: gray`, '', 'color: gray');
        } else if (isTailMessageOverloadEvent(message.event)) {
            const { type, message: msg } = message.event;
            logger(` %c|%c [%coverload%c] %c${type}: ${msg}`, 'color: gray', '', `color: gray`, '', 'color: gray');
        } else if (isTailMessageGetWebSocketEvent(message.event)) {
            const { getWebSocketEvent } = message.event;
            logger(` %c|%c [%cwebsocket%c] %c${JSON.stringify(getWebSocketEvent)}`, 'color: gray', '', `color: gray`, '', 'color: gray');
        } else {
            const response = message.event.response;
            if (response) {
                logger(` %c|%c [%cres%c] %c${response.status}`, 'color: gray', '', `color: gray`, '', 'color: gray');
            }
        }
    }
    if (message.diagnosticsChannelEvents && message.diagnosticsChannelEvents.length > 0) {
        logger(` diagnosticsChannelEvents: ${JSON.stringify(message.diagnosticsChannelEvents)}`);
    }
}
function formatLocalYyyyMmDdHhMmSs(date) {
    return [
        date.getFullYear(),
        '-',
        pad2(date.getMonth() + 1),
        '-',
        pad2(date.getDate()),
        ' ',
        pad2(date.getHours()),
        ':',
        pad2(date.getMinutes()),
        ':',
        pad2(date.getSeconds())
    ].join('');
}
function parseLogProps(logs) {
    const remainingLogs = [];
    const props = {};
    for (const log of logs){
        if (log.message.length > 0) {
            const msg = log.message[0];
            if (typeof msg === 'string' && msg.startsWith('logprops:')) {
                const trailer = msg.substring(msg.indexOf(':') + 1);
                const trailerProps = tryParsePropsFromJson(trailer);
                appendProps(trailerProps, props);
                for (const part of log.message.slice(1)){
                    const partProps = tryParsePropsFromPart(part);
                    appendProps(partProps, props);
                }
                continue;
            }
        }
        remainingLogs.push(log);
    }
    return {
        props,
        remainingLogs
    };
}
function computeDurableObjectInfo(props) {
    const durableObjectClass = undefinedIfEmpty((typeof props.durableObjectClass === 'string' ? props.durableObjectClass : '').trim());
    const durableObjectId = undefinedIfEmpty((typeof props.durableObjectId === 'string' ? props.durableObjectId : '').trim());
    const durableObjectName = undefinedIfEmpty((typeof props.durableObjectName === 'string' ? props.durableObjectName : '').trim());
    return {
        durableObjectClass,
        durableObjectId,
        durableObjectName
    };
}
function undefinedIfEmpty(str) {
    return str === '' ? undefined : str;
}
function computeShortDurableObjectId(id) {
    return /^[0-9a-fA-F]{5,}$/.test(id) ? `${id.substring(0, 4)}…` : id;
}
function appendProps(src, dst) {
    if (src) {
        for (const [key, value] of Object.entries(src)){
            dst[key] = value;
        }
    }
}
function tryParsePropsFromJson(value) {
    try {
        const props = JSON.parse(value.trim());
        if (typeof props === 'object' && props !== null && !Array.isArray(props)) {
            return props;
        }
    } catch  {}
    return undefined;
}
function tryParsePropsFromPart(part) {
    try {
        if (typeof part === 'object' && part !== null && !Array.isArray(part)) {
            return part;
        }
    } catch  {}
    return undefined;
}
function formatLogMessagePart(part) {
    if (typeof part === 'object') return JSON.stringify(part);
    return `${part}`;
}
function pad2(num) {
    return num.toString().padStart(2, '0');
}
const PRETTY_OUTCOMES = new Map([
    [
        'ok',
        'Ok'
    ],
    [
        'exception',
        'Error'
    ],
    [
        'exceededCpu',
        'Exceeded Limit'
    ],
    [
        'canceled',
        'Canceled'
    ],
    [
        'unknown',
        'Unknown'
    ]
]);
const LOG_LEVEL_COLORS = new Map([
    [
        'trace',
        'gray'
    ],
    [
        'debug',
        'purple'
    ],
    [
        'log',
        'gray'
    ],
    [
        'info',
        'gray'
    ],
    [
        'warn',
        'red'
    ],
    [
        'error',
        'red'
    ]
]);
class TailConnection {
    static VERBOSE = false;
    ws;
    callbacks;
    options;
    heartbeatId;
    constructor(webSocketUrl, callbacks, opts){
        this.ws = new WebSocket(webSocketUrl, 'trace-v1');
        this.callbacks = callbacks;
        const { websocketPingIntervalSeconds } = opts;
        this.ws.addEventListener('open', (event)=>{
            const { timeStamp } = event;
            this.sendOptionsIfOpen();
            if (callbacks.onOpen) {
                callbacks.onOpen(this, timeStamp);
            }
            if (websocketPingIntervalSeconds > 0) {
                if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), `sending ws ping {} every ${websocketPingIntervalSeconds}`);
                this.heartbeatId = setInterval(()=>{
                    if (this.ws.readyState === WebSocket.OPEN) {
                        if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), `sending ws ping {}`);
                        this.ws.send('{}');
                    }
                }, websocketPingIntervalSeconds * 1000);
            }
        });
        this.ws.addEventListener('close', (event)=>{
            const { code, reason, wasClean, timeStamp } = event;
            if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), 'TailConnection: ws close', {
                code,
                reason,
                wasClean,
                timeStamp
            });
            clearInterval(this.heartbeatId);
            if (callbacks.onClose) {
                callbacks.onClose(this, timeStamp, code, reason, wasClean);
            }
        });
        this.ws.addEventListener('error', (event)=>{
            const { timeStamp } = event;
            const errorInfo = computeErrorInfo(event);
            if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), 'TailConnection: ws error', errorInfo);
            if (callbacks.onError) {
                callbacks.onError(this, timeStamp, errorInfo);
            }
        });
        this.ws.addEventListener('message', async (event)=>{
            const { timeStamp } = event;
            if (event.data instanceof Blob) {
                const text = await event.data.text();
                const obj = JSON.parse(text);
                let message;
                try {
                    message = parseTailMessage(obj);
                } catch (e) {
                    callbacks.onUnparsedMessage(this, timeStamp, obj, e);
                    return;
                }
                callbacks.onTailMessage(this, timeStamp, message);
            } else {
                callbacks.onUnparsedMessage(this, timeStamp, event.data, new Error(`Expected event.data to be Blob`));
            }
        });
    }
    setOptions(options) {
        this.options = options;
        this.sendOptionsIfOpen();
        return this;
    }
    close(code, reason) {
        this.ws.close(code, reason);
    }
    sendOptionsIfOpen() {
        if (this.options && this.ws.readyState === WebSocket.OPEN) {
            const payload = JSON.stringify(this.options);
            if (TailConnection.VERBOSE) console.log(`sendOptionsIfOpen: sending ${payload}`);
            this.ws.send(payload);
        }
    }
}
function computeErrorInfo(event) {
    if (event.type === 'error') {
        const { message, filename, lineno, colno, error } = event;
        return {
            message,
            filename,
            lineno,
            colno,
            error
        };
    }
    return undefined;
}
function generateUuid() {
    const cryptoAsAny = crypto;
    if (typeof cryptoAsAny.randomUUID === 'function') {
        return cryptoAsAny.randomUUID();
    }
    const rnds = crypto.getRandomValues(new Uint8Array(16));
    rnds[6] = rnds[6] & 0x0f | 0x40;
    rnds[8] = rnds[8] & 0x3f | 0x80;
    return bytesToUuid(rnds);
}
function bytesToUuid(bytes) {
    const bits = [
        ...bytes
    ].map((bit)=>{
        const s = bit.toString(16);
        return bit < 0x10 ? "0" + s : s;
    });
    return [
        ...bits.slice(0, 4),
        "-",
        ...bits.slice(4, 6),
        "-",
        ...bits.slice(6, 8),
        "-",
        ...bits.slice(8, 10),
        "-",
        ...bits.slice(10, 16)
    ].join("");
}
class GraphqlQuery {
    _parent;
    _nodes;
    _nodeOrder;
    _args;
    _argOrder;
    constructor(parent, nodes, nodeOrder, args, argOrder){
        this._parent = parent;
        this._nodes = nodes;
        this._nodeOrder = nodeOrder;
        this._args = args;
        this._argOrder = argOrder;
    }
    static create() {
        return new GraphqlQuery([], new Map(), [], new Map(), []);
    }
    scalar(name) {
        this.add(name, NodeKind.Scalar);
        return this;
    }
    object(name) {
        const node = this.add(name, NodeKind.Object);
        const rt = new GraphqlQuery([
            this
        ], new Map(), [], new Map(), []);
        node.query.push(rt);
        return rt;
    }
    objectQuery(name, query) {
        const node = this.add(name, NodeKind.Object);
        const q = query.copyWithParent(this);
        const rt = q;
        node.query.push(rt);
        return rt;
    }
    argRaw(name, rawValue) {
        return this.addArg(name, rawValue);
    }
    argBoolean(name, value) {
        return this.addArg(name, value ? 'true' : 'false');
    }
    argLong(name, value) {
        return this.addArg(name, `${value}`);
    }
    argString(name, value) {
        return this.addArg(name, `"${value.replaceAll('"', '\\"')}"`);
    }
    argObject(name, fieldName, fieldValue) {
        return this.addArg(name, `{${fieldName}:"${fieldValue.replaceAll('"', '\\"')}"}`);
    }
    argVariable(name, variableName) {
        checkMatches('variableName', variableName, /^[a-z]+$/);
        return this.addArg(name, `$${variableName}`);
    }
    end() {
        return this._parent.length > 0 ? this._parent[0] : this;
    }
    top() {
        let rt = this;
        while(rt._parent.length > 0){
            rt = rt._parent[0];
        }
        return rt;
    }
    toString() {
        const lines = [];
        lines.push('{');
        this.write(lines, 1);
        lines.push('}');
        return lines.join('\n');
    }
    addArg(name, value) {
        if (this._args.has(name)) throw new Error(`Duplicate arg: ${name}`);
        this._argOrder.push(name);
        this._args.set(name, value);
        return this;
    }
    write(lines, level) {
        const indent = '  '.repeat(level);
        for (const key of this._nodeOrder){
            const node = checkGet('_nodes', this._nodes, key);
            if (node.kind === NodeKind.Scalar) {
                lines.push(`${indent}${key}`);
            } else if (node.kind === NodeKind.Object) {
                const q = node.query[0];
                let line = `${indent}${key}`;
                if (q._argOrder.length > 0) {
                    line += '(';
                    let j = 0;
                    for (const argName of q._argOrder){
                        if (j > 0) line += ', ';
                        line += `${argName}: ${checkGet('q._args', q._args, argName)}`;
                        j++;
                    }
                    line += ')';
                }
                line += ' {';
                lines.push(line);
                node.query[0].write(lines, level + 1);
                lines.push(`${indent}}`);
            } else {
                throw new Error(`Implement node kind ${node.kind}`);
            }
        }
    }
    add(name, kind) {
        if (this._nodes.has(name)) throw new Error(`Duplicate field: ${name}`);
        const rt = new Node(kind);
        this._nodes.set(name, rt);
        this._nodeOrder.push(name);
        return rt;
    }
    copyWithParent(parent) {
        const nodes = new Map();
        const nodeOrder = [
            ...this._nodeOrder
        ];
        const args = new Map();
        for (const [key, value] of this._args.entries()){
            args.set(key, value);
        }
        const argOrder = [
            ...this._argOrder
        ];
        const rt = new GraphqlQuery([
            parent
        ], nodes, nodeOrder, args, argOrder);
        for (const [key, node] of this._nodes.entries()){
            const newNode = new Node(node.kind);
            if (node.query.length > 0) {
                const newQuery = node.query[0].copyWithParent(rt);
                newNode.query.push(newQuery);
            }
            nodes.set(key, newNode);
        }
        return rt;
    }
}
function checkGet(mapName, map, key) {
    const rt = map.get(key);
    if (!rt) throw new Error(`Bad ${mapName}.key: ${key}`);
    return rt;
}
var NodeKind;
(function(NodeKind) {
    NodeKind[NodeKind["Scalar"] = 1] = "Scalar";
    NodeKind[NodeKind["Object"] = 2] = "Object";
})(NodeKind || (NodeKind = {}));
class Node {
    kind;
    query = [];
    constructor(kind){
        this.kind = kind;
    }
}
class CfGqlClient {
    static DEBUG = false;
    static URL_TRANSFORMER = (v)=>v;
    profile;
    constructor(profile){
        this.profile = profile;
    }
    async getDurableObjectPeriodicMetricsByDate(startDateInclusive, endDateInclusive) {
        return await _getDurableObjectPeriodicMetricsByDate(this.profile, startDateInclusive, endDateInclusive);
    }
    async getDurableObjectStorageByDate(startDateInclusive, endDateInclusive) {
        return await _getDurableObjectStorageByDate(this.profile, startDateInclusive, endDateInclusive);
    }
    async getDurableObjectInvocationsByDate(startDateInclusive, endDateInclusive) {
        return await _getDurableObjectInvocationsByDate(this.profile, startDateInclusive, endDateInclusive);
    }
    async getR2StorageByDate(startDateInclusive, endDateInclusive) {
        return await _getR2StorageByDate(this.profile, startDateInclusive, endDateInclusive);
    }
    async getR2OperationsByDate(operationClass, startDateInclusive, endDateInclusive) {
        return await _getR2OperationsByDate(this.profile, operationClass, startDateInclusive, endDateInclusive);
    }
}
async function query(profile, queryFn, variables) {
    const { accountId, apiToken } = profile;
    const q = GraphqlQuery.create().scalar('cost').object('viewer').scalar('budget').object('accounts').argObject('filter', 'accountTag', accountId).scalar('accountTag');
    queryFn(q);
    const query = q.top().toString();
    if (CfGqlClient.DEBUG) console.log(query);
    const reqObj = {
        query,
        variables
    };
    const body = JSON.stringify(reqObj);
    const start = Date.now();
    const url = CfGqlClient.URL_TRANSFORMER('https://api.cloudflare.com/client/v4/graphql');
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${apiToken}`
        },
        body
    });
    const fetchMillis = Date.now() - start;
    if (CfGqlClient.DEBUG) console.log(res);
    if (res.status !== 200) throw new Error(`Bad res.status: ${res.status}, expected 200, text=${await res.text()}`);
    const contentType = res.headers.get('content-type');
    if (contentType !== 'application/json') throw new Error(`Bad res.contentType: ${contentType}, expected application/json, found ${contentType}, text=${await res.text()}`);
    const resObj = await res.json();
    resObj.fetchMillis = fetchMillis;
    if (CfGqlClient.DEBUG) console.log(JSON.stringify(resObj, undefined, 2));
    if (isGqlErrorResponse(resObj)) {
        throw new Error(resObj.errors.map(computeGqlErrorString).join(', '));
    }
    return resObj;
}
function isGqlErrorResponse(obj) {
    return typeof obj === 'object' && obj.data === null && Array.isArray(obj.errors);
}
function computeGqlErrorString(error) {
    const pieces = [
        error.message
    ];
    if (error.path) pieces.push(`(${error.path.join('/')})`);
    if (error.extensions.code) pieces.push(`(code=${error.extensions.code})`);
    return pieces.join(' ');
}
async function _getDurableObjectPeriodicMetricsByDate(profile, startDateInclusive, endDateInclusive) {
    const resObj = await query(profile, (q)=>q.object('durableObjectsPeriodicGroups').argLong('limit', 10000).argRaw('filter', `{date_geq: $start, date_leq: $end}`).argRaw('orderBy', `[date_ASC]`).object('dimensions').scalar('date').scalar('namespaceId').end().object('max').scalar('activeWebsocketConnections').end().object('sum').scalar('activeTime').scalar('cpuTime').scalar('exceededCpuErrors').scalar('exceededMemoryErrors').scalar('fatalInternalErrors').scalar('inboundWebsocketMsgCount').scalar('outboundWebsocketMsgCount').scalar('storageDeletes').scalar('storageReadUnits').scalar('storageWriteUnits').scalar('subrequests'), {
        start: startDateInclusive,
        end: endDateInclusive
    });
    const fetchMillis = resObj.fetchMillis;
    const res = resObj;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows = [];
    for (const account of res.data.viewer.accounts){
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.durableObjectsPeriodicGroups){
            const date = group.dimensions.date;
            const namespaceId = group.dimensions.namespaceId;
            const maxActiveWebsocketConnections = group.max.activeWebsocketConnections;
            const sumActiveTime = group.sum.activeTime;
            const sumCpuTime = group.sum.cpuTime;
            const sumExceededCpuErrors = group.sum.exceededCpuErrors;
            const sumExceededMemoryErrors = group.sum.exceededMemoryErrors;
            const sumFatalInternalErrors = group.sum.fatalInternalErrors;
            const sumInboundWebsocketMsgCount = group.sum.inboundWebsocketMsgCount;
            const sumOutboundWebsocketMsgCount = group.sum.outboundWebsocketMsgCount;
            const sumStorageDeletes = group.sum.storageDeletes;
            const sumStorageReadUnits = group.sum.storageReadUnits;
            const sumStorageWriteUnits = group.sum.storageWriteUnits;
            const sumSubrequests = group.sum.subrequests;
            rows.push({
                date,
                namespaceId,
                maxActiveWebsocketConnections,
                sumActiveTime,
                sumCpuTime,
                sumExceededCpuErrors,
                sumExceededMemoryErrors,
                sumFatalInternalErrors,
                sumInboundWebsocketMsgCount,
                sumOutboundWebsocketMsgCount,
                sumStorageDeletes,
                sumStorageReadUnits,
                sumStorageWriteUnits,
                sumSubrequests
            });
        }
    }
    return {
        info: {
            fetchMillis,
            cost,
            budget
        },
        rows
    };
}
async function _getDurableObjectStorageByDate(profile, startDateInclusive, endDateInclusive) {
    const resObj = await query(profile, (q)=>q.object('durableObjectsStorageGroups').argLong('limit', 10000).argRaw('filter', `{date_geq: $start, date_leq: $end}`).argRaw('orderBy', `[date_ASC]`).object('dimensions').scalar('date').end().object('max').scalar('storedBytes').end(), {
        start: startDateInclusive,
        end: endDateInclusive
    });
    const fetchMillis = resObj.fetchMillis;
    const res = resObj;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows = [];
    for (const account of res.data.viewer.accounts){
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.durableObjectsStorageGroups){
            const date = group.dimensions.date;
            const maxStoredBytes = group.max.storedBytes;
            rows.push({
                date,
                maxStoredBytes
            });
        }
    }
    return {
        info: {
            fetchMillis,
            cost,
            budget
        },
        rows
    };
}
async function _getDurableObjectInvocationsByDate(profile, startDateInclusive, endDateInclusive) {
    const resObj = await query(profile, (q)=>q.object('durableObjectsInvocationsAdaptiveGroups').argLong('limit', 10000).argRaw('filter', `{date_geq: $start, date_leq: $end}`).argRaw('orderBy', `[date_ASC]`).object('dimensions').scalar('date').scalar('namespaceId').end().object('avg').scalar('sampleInterval').end().object('sum').scalar('requests').end(), {
        start: startDateInclusive,
        end: endDateInclusive
    });
    const fetchMillis = resObj.fetchMillis;
    const res = resObj;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows = [];
    for (const account of res.data.viewer.accounts){
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.durableObjectsInvocationsAdaptiveGroups){
            const date = group.dimensions.date;
            const namespaceId = group.dimensions.namespaceId;
            const avgSampleInterval = group.avg.sampleInterval;
            const sumRequests = group.sum.requests;
            rows.push({
                date,
                namespaceId,
                avgSampleInterval,
                sumRequests
            });
        }
    }
    return {
        info: {
            fetchMillis,
            cost,
            budget
        },
        rows
    };
}
async function _getR2StorageByDate(profile, startDateInclusive, endDateInclusive) {
    const resObj = await query(profile, (q)=>q.object('r2StorageAdaptiveGroups').argLong('limit', 10000).argRaw('filter', `{date_geq: $start, date_leq: $end}`).argRaw('orderBy', `[date_ASC]`).object('dimensions').scalar('date').scalar('bucketName').end().object('max').scalar('metadataSize').scalar('payloadSize').scalar('objectCount').scalar('uploadCount').end(), {
        start: startDateInclusive,
        end: endDateInclusive
    });
    const fetchMillis = resObj.fetchMillis;
    const res = resObj;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows = [];
    for (const account of res.data.viewer.accounts){
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.r2StorageAdaptiveGroups){
            const date = group.dimensions.date;
            const bucketName = group.dimensions.bucketName;
            const maxMetadataSize = group.max.metadataSize;
            const maxPayloadSize = group.max.payloadSize;
            const maxObjectCount = group.max.objectCount;
            const maxUploadCount = group.max.uploadCount;
            rows.push({
                date,
                bucketName,
                maxMetadataSize,
                maxPayloadSize,
                maxObjectCount,
                maxUploadCount
            });
        }
    }
    return {
        info: {
            fetchMillis,
            cost,
            budget
        },
        rows
    };
}
async function _getR2OperationsByDate(profile, operationClass, startDateInclusive, endDateInclusive) {
    const actionTypes = operationClass === 'A' ? [
        'ListBuckets',
        'PutBucket',
        'ListObjects',
        'PutObject',
        'CopyObject',
        'CompleteMultipartUpload',
        'CreateMultipartUpload',
        'UploadPart',
        'UploadPartCopy',
        'PutBucketEncryption',
        'ListMultipartUploads'
    ] : [
        'HeadBucket',
        'HeadObject',
        'GetObject',
        'ReportUsageSummary',
        'GetBucketEncryption',
        'GetBucketLocation'
    ];
    const resObj = await query(profile, (q)=>q.object('r2OperationsAdaptiveGroups').argLong('limit', 10000).argRaw('filter', `{date_geq: $start, date_leq: $end, actionStatus: "success", actionType_in: ${JSON.stringify(actionTypes)}}`).argRaw('orderBy', `[date_ASC]`).object('dimensions').scalar('date').scalar('bucketName').end().object('sum').scalar('requests').scalar('responseObjectSize').end(), {
        start: startDateInclusive,
        end: endDateInclusive
    });
    const fetchMillis = resObj.fetchMillis;
    const res = resObj;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows = [];
    for (const account of res.data.viewer.accounts){
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.r2OperationsAdaptiveGroups){
            const date = group.dimensions.date;
            const bucketName = group.dimensions.bucketName;
            const sumSuccessfulRequests = group.sum.requests;
            const sumSuccessfulResponseObjectSize = group.sum.responseObjectSize;
            rows.push({
                date,
                bucketName,
                sumSuccessfulRequests,
                sumSuccessfulResponseObjectSize
            });
        }
    }
    return {
        info: {
            fetchMillis,
            cost,
            budget
        },
        rows
    };
}
async function computeDurableObjectsCostsTable(client, opts) {
    const { start, end } = (()=>{
        if ('lookbackDays' in opts) {
            const end = utcCurrentDate();
            const start = addDaysToDate(end, -opts.lookbackDays);
            return {
                start,
                end
            };
        } else {
            const { start, end } = opts;
            return {
                start,
                end
            };
        }
    })();
    const [storage, periodic, invocations, namespaces] = await Promise.all([
        client.getDurableObjectStorageByDate(start, end),
        client.getDurableObjectPeriodicMetricsByDate(start, end),
        client.getDurableObjectInvocationsByDate(start, end),
        tryListDurableObjectsNamespaces(client.profile)
    ]);
    const gqlResultInfos = {
        'storage': storage.info,
        'periodic': periodic.info,
        'invocations': invocations.info
    };
    const rowsByNamespace = {};
    const rowsByDate = {};
    for (const pRow of periodic.rows){
        const { date, namespaceId, maxActiveWebsocketConnections, sumInboundWebsocketMsgCount, sumOutboundWebsocketMsgCount, sumSubrequests, sumActiveTime, sumStorageReadUnits, sumStorageWriteUnits, sumStorageDeletes } = pRow;
        let rows = rowsByNamespace[namespaceId];
        if (!rows) {
            rows = [];
            rowsByNamespace[namespaceId] = rows;
        }
        let dateRows = rowsByDate[date];
        if (!dateRows) {
            dateRows = [];
            rowsByDate[date] = dateRows;
        }
        const { sumRequests } = invocations.rows.filter((v)=>v.date === date && v.namespaceId === namespaceId)[0] || {
            sumRequests: 0
        };
        const { requestsCost, websocketsCost, subrequestsCost, activeCost, readUnitsCost, writeUnitsCost, deletesCost, totalCost, activeGbSeconds } = computeCosts({
            sumRequests,
            sumInboundWebsocketMsgCount,
            sumSubrequests,
            sumActiveTime,
            sumStorageReadUnits,
            sumStorageWriteUnits,
            sumStorageDeletes,
            excludeFreeUsage: false,
            storageCost: 0
        });
        const row = {
            date,
            sumRequests,
            requestsCost,
            maxActiveWebsocketConnections,
            sumInboundWebsocketMsgCount,
            sumOutboundWebsocketMsgCount,
            websocketsCost,
            sumSubrequests,
            subrequestsCost,
            sumActiveTime,
            activeGbSeconds,
            activeCost,
            sumStorageReadUnits,
            readUnitsCost,
            sumStorageWriteUnits,
            writeUnitsCost,
            sumStorageDeletes,
            deletesCost,
            totalCost
        };
        rows.push(row);
        dateRows.push(row);
    }
    const namespaceTables = {};
    for (const [namespaceId, rows] of Object.entries(rowsByNamespace)){
        const estimated30DayRow = computeEstimated30DayRow(rows, false);
        const namespace = namespaces.find((v)=>v.id === namespaceId);
        namespaceTables[namespaceId] = {
            rows,
            estimated30DayRow,
            namespace,
            estimated30DayRowMinusFree: undefined
        };
    }
    const accountRows = [];
    for (const [date, dateRows] of Object.entries(rowsByDate)){
        const { maxStoredBytes } = storage.rows.filter((v)=>v.date === date)[0] || {
            maxStoredBytes: 0
        };
        const storageGb = maxStoredBytes / 1024 / 1024 / 1024;
        const storageCost = storageGb * .20 / 30;
        accountRows.push(computeTotalRow(date, dateRows, {
            storageGb,
            storageCost
        }));
    }
    const storageCost = accountRows.length > 0 ? accountRows.map((v)=>v.storageCost || 0).reduce((a, b)=>a + b) : 0;
    const accountOpts = {
        storageGb: 0,
        storageCost
    };
    const estimated30DayRow = computeEstimated30DayRow(accountRows, false, accountOpts);
    const estimated30DayRowMinusFree = computeEstimated30DayRow(accountRows, true, accountOpts);
    const accountTable = {
        rows: accountRows,
        estimated30DayRow,
        estimated30DayRowMinusFree,
        namespace: undefined
    };
    return {
        accountTable,
        namespaceTables,
        gqlResultInfos
    };
}
function computeCosts(input) {
    const { sumActiveTime, sumStorageReadUnits, sumStorageWriteUnits, sumStorageDeletes, excludeFreeUsage, storageCost } = input;
    const { sumRequests, sumInboundWebsocketMsgCount, sumSubrequests } = function() {
        let { sumRequests, sumInboundWebsocketMsgCount, sumSubrequests } = input;
        if (excludeFreeUsage) {
            let remaining = 1000000;
            let take = Math.min(remaining, sumRequests);
            if (take > 0) {
                sumRequests -= take;
                remaining -= take;
            }
            take = Math.min(remaining, sumInboundWebsocketMsgCount);
            if (take > 0) {
                sumInboundWebsocketMsgCount -= take;
                remaining -= take;
            }
            take = Math.min(remaining, sumSubrequests);
            if (take > 0) {
                sumSubrequests -= take;
                remaining -= take;
            }
        }
        return {
            sumRequests,
            sumInboundWebsocketMsgCount,
            sumSubrequests
        };
    }();
    const requestsCost = sumRequests / 1000000 * 0.15;
    const websocketsCost = sumInboundWebsocketMsgCount / 1000000 * 0.15;
    const subrequestsCost = sumSubrequests / 1000000 * 0.15;
    const activeTimeSeconds = sumActiveTime / 1000 / 1000;
    let activeGbSeconds = activeTimeSeconds * 128 / 1024;
    if (excludeFreeUsage) {
        activeGbSeconds = Math.max(0, activeGbSeconds - 400000);
    }
    const activeCost = activeGbSeconds / 400000 * 12.50;
    const readUnitsCost = (excludeFreeUsage ? Math.max(0, sumStorageReadUnits - 1000000) : sumStorageReadUnits) / 1000000 * .20;
    const writeUnitsCost = (excludeFreeUsage ? Math.max(0, sumStorageWriteUnits - 1000000) : sumStorageWriteUnits) / 1000000 * 1;
    const deletesCost = (excludeFreeUsage ? Math.max(0, sumStorageDeletes - 1000000) : sumStorageDeletes) / 1000000 * 1;
    let newStorageCost = storageCost || 0;
    if (excludeFreeUsage) newStorageCost = Math.max(0, newStorageCost - 0.20);
    const totalCost = requestsCost + websocketsCost + subrequestsCost + activeCost + readUnitsCost + writeUnitsCost + deletesCost + newStorageCost;
    return {
        requestsCost,
        websocketsCost,
        subrequestsCost,
        activeCost,
        readUnitsCost,
        writeUnitsCost,
        deletesCost,
        totalCost,
        activeGbSeconds,
        newStorageCost
    };
}
async function tryListDurableObjectsNamespaces(profile) {
    try {
        return await listDurableObjectsNamespaces(profile);
    } catch (e) {
        console.warn(e);
        return [];
    }
}
function computeTotalRow(date, rows, opts) {
    let computedStorageCost = false;
    const computeStorageCostOnce = ()=>{
        const rt = !computedStorageCost ? opts?.storageCost || 0 : 0;
        computedStorageCost = true;
        return rt;
    };
    return rows.reduce((lhs, rhs)=>({
            date,
            sumRequests: lhs.sumRequests + rhs.sumRequests,
            requestsCost: lhs.requestsCost + rhs.requestsCost,
            maxActiveWebsocketConnections: lhs.maxActiveWebsocketConnections + rhs.maxActiveWebsocketConnections,
            sumInboundWebsocketMsgCount: lhs.sumInboundWebsocketMsgCount + rhs.sumInboundWebsocketMsgCount,
            sumOutboundWebsocketMsgCount: lhs.sumOutboundWebsocketMsgCount + rhs.sumOutboundWebsocketMsgCount,
            websocketsCost: lhs.websocketsCost + rhs.websocketsCost,
            sumSubrequests: lhs.sumSubrequests + rhs.sumSubrequests,
            subrequestsCost: lhs.subrequestsCost + rhs.subrequestsCost,
            sumActiveTime: lhs.sumActiveTime + rhs.sumActiveTime,
            activeGbSeconds: lhs.activeGbSeconds + rhs.activeGbSeconds,
            activeCost: lhs.activeCost + rhs.activeCost,
            sumStorageReadUnits: lhs.sumStorageReadUnits + rhs.sumStorageReadUnits,
            readUnitsCost: lhs.readUnitsCost + rhs.readUnitsCost,
            sumStorageWriteUnits: lhs.sumStorageWriteUnits + rhs.sumStorageWriteUnits,
            writeUnitsCost: lhs.writeUnitsCost + rhs.writeUnitsCost,
            sumStorageDeletes: lhs.sumStorageDeletes + rhs.sumStorageDeletes,
            deletesCost: lhs.deletesCost + rhs.deletesCost,
            storageGb: opts?.storageGb,
            storageCost: opts?.storageCost,
            totalCost: lhs.totalCost + rhs.totalCost + computeStorageCostOnce()
        }));
}
function multiplyRow(row, multiplier) {
    return {
        date: '',
        sumRequests: row.sumRequests * multiplier,
        requestsCost: row.requestsCost * multiplier,
        maxActiveWebsocketConnections: row.maxActiveWebsocketConnections * multiplier,
        sumInboundWebsocketMsgCount: row.sumInboundWebsocketMsgCount * multiplier,
        sumOutboundWebsocketMsgCount: row.sumOutboundWebsocketMsgCount * multiplier,
        websocketsCost: row.websocketsCost * multiplier,
        sumSubrequests: row.sumSubrequests * multiplier,
        subrequestsCost: row.subrequestsCost * multiplier,
        sumActiveTime: row.sumActiveTime * multiplier,
        activeGbSeconds: row.activeGbSeconds * multiplier,
        activeCost: row.activeCost * multiplier,
        sumStorageReadUnits: row.sumStorageReadUnits * multiplier,
        readUnitsCost: row.readUnitsCost * multiplier,
        sumStorageWriteUnits: row.sumStorageWriteUnits * multiplier,
        writeUnitsCost: row.writeUnitsCost * multiplier,
        sumStorageDeletes: row.sumStorageDeletes * multiplier,
        deletesCost: row.deletesCost * multiplier,
        storageGb: row.storageGb === undefined ? undefined : row.storageGb * multiplier,
        storageCost: row.storageCost === undefined ? undefined : row.storageCost * multiplier,
        totalCost: row.totalCost * multiplier
    };
}
function computeEstimated30DayRow(rows, excludeFreeUsage, opts) {
    if (rows.length <= 1) return undefined;
    const sum = computeTotalRow('', rows.slice(0, -1), opts);
    const days = rows.length - 1;
    const estRow = multiplyRow(sum, 30 / days);
    const { sumRequests, sumInboundWebsocketMsgCount, sumSubrequests, sumStorageReadUnits, sumStorageWriteUnits, sumStorageDeletes, sumActiveTime, maxActiveWebsocketConnections, sumOutboundWebsocketMsgCount, storageGb, storageCost } = estRow;
    const { requestsCost, websocketsCost, subrequestsCost, activeCost, readUnitsCost, writeUnitsCost, deletesCost, totalCost, activeGbSeconds, newStorageCost } = computeCosts({
        sumRequests,
        sumInboundWebsocketMsgCount,
        sumSubrequests,
        sumActiveTime,
        sumStorageReadUnits,
        sumStorageWriteUnits,
        sumStorageDeletes,
        excludeFreeUsage,
        storageCost
    });
    return {
        date: '',
        sumRequests,
        requestsCost,
        maxActiveWebsocketConnections,
        sumInboundWebsocketMsgCount,
        sumOutboundWebsocketMsgCount,
        websocketsCost,
        sumSubrequests,
        subrequestsCost,
        sumActiveTime,
        activeGbSeconds,
        activeCost,
        sumStorageReadUnits,
        readUnitsCost,
        sumStorageWriteUnits,
        writeUnitsCost,
        sumStorageDeletes,
        deletesCost,
        storageGb,
        storageCost: newStorageCost,
        totalCost
    };
}
function utcCurrentDate() {
    return new Date().toISOString().substring(0, 10);
}
function addDaysToDate(date, days) {
    const d = new Date(`${date}T00:00:00Z`);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()).toISOString().substring(0, 10);
}
class Material {
    static highEmphasisTextColor = 'rgba(255, 255, 255, 0.87)';
    static mediumEmphasisTextColor = 'rgba(255, 255, 255, 0.60)';
}
const MATERIAL_CSS = r3`

:root {
  --surface-01-background-color: rgb(30.75, 30.75, 30.75);
  --surface-04-background-color: rgb(40.95, 40.95, 40.95);
  --high-emphasis-text-color: rgba(255, 255, 255, 0.87);
  --medium-emphasis-text-color: rgba(255, 255, 255, 0.60);
  --disabled-text-color: rgba(255, 255, 255, 0.38);
  --button-border-radius: 0.25rem;
  --primary-color: #bb86fc;
  --background-color: #121212;
  --sans-serif-font-family: -apple-system, BlinkMacSystemFont, avenir next, avenir, helvetica neue, helvetica, Ubuntu, roboto, noto, segoe ui, arial, sans-serif;
  --monospace-font-family: Menlo, Consolas, ui-monospace, monospace;
}

/** text size classes */

.h6 {
    font-size: 1.25rem;
    letter-spacing: 0.00750rem;
    font-weight: bolder;
}

.body2, fieldset label, fieldset output, fieldset details {
    font-size: 0.875rem;
    letter-spacing: 0.01786rem;
    font-weight: normal;
    line-height: 1.25rem;
}

.button, button, .action-icon {
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.08929rem;
    font-weight: bolder;
}

.overline, th {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.15000rem;
    font-weight: normal;
}

.caption {
    font-size: 0.75rem;
    letter-spacing: 0.03333rem;
    font-weight: normal;
}

/* light text on dark background colors */

.high-emphasis-text {
    color: var(--high-emphasis-text-color);
}

.medium-emphasis-text, fieldset label, th {
    color: var(--medium-emphasis-text-color);
}

.disabled-emphasis-text {
    color: var(--disabled-text-color);
}

/** elevation backgrounds */

.surface-01 {
    background-color: var(--surface-01-background-color);
}

.surface-04 {
    background-color: var(--surface-04-background-color);
}

/** action-icon */

.action-icon {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    min-width: 2rem;
    border-radius: var(--button-border-radius);
    color: var(--high-emphasis-text-color);
    opacity: 0.69;  /** medium-emphasis / high-emphasis */
    user-select: none; -webkit-user-select: none;
}

@media (hover: hover) {
    .action-icon:hover {
        background-color: var(--surface-04-background-color);
        opacity: 1;
    }
}

/** button */

button {
    border: none;
    background-color: var(--surface-01-background-color);
    color: var(--medium-emphasis-text-color);
    padding: 0.5rem 1rem;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    user-select: none; -webkit-user-select: none;
    min-width: 8rem;
    border-radius: var(--button-border-radius);
}

button.selected {
    background-color: var(--surface-04-background-color);
    color: var(--high-emphasis-text-color);
}

@media (hover) {
    button:hover {
        background-color: var(--surface-04-background-color);
        color: var(--high-emphasis-text-color);
    }
}

button:disabled {
    color: var(--disabled-text-color);
}

@media (hover) {
    button:disabled:hover {
        background-color: var(--surface-01-background-color);
        cursor: default;
    }
}

/** anchors */

a {
    color: var(--primary-color);
    text-underline-offset: 0.2rem;
    text-decoration: none;
}

@media (hover: hover) {
    a:hover {
        text-decoration: underline;
    }
}

/** forms */

fieldset {
    border: solid 1px rgba(255, 255, 255, 0.60);
    border-radius: var(--button-border-radius);
    display: grid;
    grid-row-gap: 1rem;
    grid-column-gap: 1rem;
    padding: 1rem;
}

label {
    grid-column: 1;
    padding: 0.5rem 0;
}

.form-lhs {
    grid-column: 1;
}

input, .form-rhs {
    grid-column: 2;
    min-width: 0;
}

.form-row {
    grid-column: 1 / span 2;
}

fieldset input[type=text] {
    padding: 0.5rem;
    background-color: var(--surface-01-background-color);
    color: var(--high-emphasis-text-color);
    border: solid 1px var(--medium-emphasis-text-color);
    border-radius: var(--button-border-radius);
}

fieldset output {
    padding: 0.5rem 0;
    color: var(--medium-emphasis-text-color);
}

fieldset details {
    color: var(--medium-emphasis-text-color);
}

`;
const HEADER_HTML = $1`
<header class="h6 high-emphasis-text">
    <div id="header-content">
        Webtail
        <span id="header-version" class="overline medium-emphasis-text"></span>
        <a href="https://github.com/skymethod/denoflare" target="_blank" id="github-logo-anchor"><img id="github-logo"></a>
    </div>
</header>
`;
const HEADER_CSS = r3`
header {
    display: flex;
    padding: 1rem 0;
    user-select: none; -webkit-user-select: none;
}

#header-content {
    flex-grow: 1;
    display: flex;
    align-items: baseline;
    padding-right: 2.2rem;
}

#header-version {
    flex-grow: 1;
    text-align: center;
}

#github-logo-anchor {
    line-height: 0;
    opacity: 0.5;
}

@media (hover: hover) {
    #github-logo-anchor:hover {
        opacity: 0.75;
    }
}

#github-logo {
    width: 1rem;
    margin-bottom: -0.1rem;
}

`;
function initHeader(document1, vm, data) {
    const headerContentElement = document1.getElementById('header-content');
    if ((data.flags || '').includes('demo-toggle')) {
        headerContentElement.addEventListener('dblclick', (e)=>{
            e.preventDefault();
            vm.toggleDemoMode();
        });
    }
    const headerVersionSpan = document1.getElementById('header-version');
    const { version } = data;
    headerVersionSpan.textContent = version ? `v${version}` : '';
    const githubLogoImg = document1.getElementById('github-logo');
    githubLogoImg.src = computeGithubLogoDataUrl();
    return ()=>{};
}
function computeGithubLogoDataUrl() {
    const svg = GITHUB_LOGO.replace('fill:white;', `fill:${Material.highEmphasisTextColor};`);
    return 'data:image/svg+xml;utf8,' + svg;
}
const GITHUB_LOGO = `<svg width="auto" height="auto" viewBox="0 0 136 133" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
<g transform="matrix(4.16667,0,0,4.16667,-568,-1381.06)">
    <path d="M152.608,331.455C143.614,331.455 136.32,338.748 136.32,347.745C136.32,354.942 140.987,361.047 147.46,363.201C148.275,363.351 148.572,362.848 148.572,362.416C148.572,362.029 148.558,361.005 148.55,359.646C144.019,360.63 143.063,357.462 143.063,357.462C142.322,355.58 141.254,355.079 141.254,355.079C139.775,354.069 141.366,354.089 141.366,354.089C143.001,354.204 143.861,355.768 143.861,355.768C145.314,358.257 147.674,357.538 148.602,357.121C148.75,356.069 149.171,355.351 149.636,354.944C146.019,354.533 142.216,353.135 142.216,346.893C142.216,345.115 142.851,343.66 143.893,342.522C143.725,342.11 143.166,340.453 144.053,338.211C144.053,338.211 145.42,337.773 148.532,339.881C149.831,339.519 151.225,339.339 152.61,339.332C153.994,339.339 155.387,339.519 156.688,339.881C159.798,337.773 161.163,338.211 161.163,338.211C162.052,340.453 161.493,342.11 161.326,342.522C162.37,343.66 163,345.115 163,346.893C163,353.151 159.191,354.528 155.563,354.931C156.147,355.434 156.668,356.428 156.668,357.947C156.668,360.125 156.648,361.882 156.648,362.416C156.648,362.852 156.942,363.359 157.768,363.2C164.236,361.041 168.899,354.94 168.899,347.745C168.899,338.748 161.605,331.455 152.608,331.455Z" style="fill:white;"/>
</g>
</svg>`;
function actionIcon(icon, opts = {}) {
    const { text, onclick } = opts;
    return $1`<div class="action-icon" @click=${(e)=>{
        e.preventDefault();
        onclick && onclick();
    }}>${icon}${text || ''}</div>`;
}
const CLEAR_ICON = y1`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M5 13h14v-2H5v2zm-2 4h14v-2H3v2zM7 7v2h14V7H7z"/></svg>`;
const EDIT_ICON = y1`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>`;
const ADD_ICON = y1`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}">><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
const CHECK_BOX_UNCHECKED_ICON = y1`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>`;
const CHECK_BOX_CHECKED_ICON = y1`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/></svg>`;
const SIDEBAR_HTML = $1`
<div id="sidebar">
    ${HEADER_HTML}
    <a id="sidebar-about" class="overline medium-emphasis-text" href="#">About</a>
    <div id="profiles"></div>
    <div id="sidebar-analytics"></div>
    <div id="scripts"></div>
</div>
`;
const SIDEBAR_CSS = r3`

#sidebar {
    margin-left: 1rem;
    height: 100vh;
    min-width: 15rem;
}

#sidebar-about {
    display: block;
    margin-bottom: 1rem;
}

#sidebar .button-grid {
    display: grid;
    grid-template-columns: 1fr 2rem;
    grid-gap: 1px;
    margin-left: 1px;
    margin-top: 1rem;
}

#sidebar .button-grid-new {
    grid-column: 1;
    min-width: 8rem;
}

#sidebar button {
    grid-column: 1;
}

#sidebar .button-grid .hint {
    grid-column: 1; 
    text-align: center;
}

#scripts-scroller {
    height: calc(100vh - 28rem);
}

#sidebar .extra-top-margin {
    margin-top: 1rem;
}

`;
function initSidebar(document1, vm, data) {
    const updateHeader = initHeader(document1, vm, data);
    const aboutAnchor = document1.getElementById('sidebar-about');
    const profilesDiv = document1.getElementById('profiles');
    const analyticsDiv = document1.getElementById('sidebar-analytics');
    const scriptsDiv = document1.getElementById('scripts');
    aboutAnchor.onclick = (e)=>{
        e.preventDefault();
        vm.showAbout();
    };
    return ()=>{
        updateHeader();
        T1(PROFILES_HTML(vm), profilesDiv);
        T1(ANALYTICS_HTML(vm), analyticsDiv);
        T1(SCRIPTS_HTML(vm), scriptsDiv);
    };
}
const PROFILES_HTML = (vm)=>$1`
    <div class="overline medium-emphasis-text">Profiles</div>
    <div class="button-grid">
        ${vm.profiles.map((profile)=>$1`<button 
            class="${profile.id === vm.selectedProfileId ? 'selected' : ''}" 
            @click=${()=>{
            vm.selectedProfileId = profile.id;
        }}
            ?disabled="${vm.profileForm.showing}">${profile.text}</button>
        ${profile.id === vm.selectedProfileId ? $1`${actionIcon(EDIT_ICON, {
            onclick: ()=>vm.editProfile(profile.id)
        })}` : ''}`)}
        <div class="button-grid-new">${actionIcon(ADD_ICON, {
        text: 'New',
        onclick: ()=>vm.newProfile()
    })}</div>
    </div>
`;
const ANALYTICS_HTML = (vm)=>$1`
    <div class="overline medium-emphasis-text extra-top-margin">Analytics</div>
    <div class="button-grid">
        ${vm.analytics.map((analytic)=>$1`<button
                class="${vm.selectedAnalyticId === analytic.id ? 'selected' : ''}" 
                @click=${()=>vm.showAnalytic(analytic.id)} 
                ?disabled="${vm.profileForm.showing}">${analytic.text}</button>
        `)}
    </div>
`;
const SCRIPTS_HTML = (vm)=>$1`
    <div class="overline medium-emphasis-text extra-top-margin">Scripts</div>
    <div id="scripts-scroller" class="hidden-vertical-scroll">
        <div class="button-grid">
            ${vm.scripts.map((script)=>$1`<button
                    class="${vm.selectedScriptIds.has(script.id) ? 'selected' : ''}" 
                    @click=${(e)=>handleScriptClick(e, script.id, vm)} 
                    ?disabled="${vm.profileForm.showing}">${script.text}</button>
            `)}
        </div>
    </div>
    <div class="button-grid">
        <div class="caption medium-emphasis-text hint">${computeMultiselectKeyChar()}-click to multiselect</div>
    </div>
`;
function computeMultiselectKeyChar() {
    return isMacintosh() ? '⌘' : 'ctrl';
}
function isMacintosh() {
    return navigator.platform.indexOf('Mac') > -1;
}
function handleScriptClick(e, scriptId, vm) {
    e.preventDefault();
    const newScriptIds = new Set([
        scriptId
    ]);
    const multi = isMacintosh() ? e.metaKey : e.ctrlKey;
    vm.selectedScriptIds = multi ? vm.selectedScriptIds.has(scriptId) ? setSubtract(vm.selectedScriptIds, newScriptIds) : setUnion(vm.selectedScriptIds, newScriptIds) : newScriptIds;
}
class AppConstants {
    static WEBSOCKET_PING_INTERVAL_SECONDS = 10;
    static INACTIVE_TAIL_SECONDS = 5;
}
class TailController {
    callbacks;
    records = new Map();
    websocketPingIntervalSeconds;
    inactiveTailSeconds;
    tailOptions = {
        filters: []
    };
    online;
    constructor(callbacks, opts){
        this.callbacks = callbacks;
        this.websocketPingIntervalSeconds = opts.websocketPingIntervalSeconds;
        this.inactiveTailSeconds = opts.inactiveTailSeconds;
        const navigatorAsAny = globalThis.navigator;
        if (typeof navigatorAsAny.onLine === 'boolean') {
            this.setOnline(navigatorAsAny.onLine);
        }
        globalThis.addEventListener('online', ()=>this.setOnline(true));
        globalThis.addEventListener('offline', ()=>this.setOnline(false));
    }
    setTailOptions(tailOptions) {
        console.log(`TailController.setTailOptions ${JSON.stringify(tailOptions)}`);
        this.tailOptions = tailOptions;
        for (const record of this.records.values()){
            if (record.connection) {
                record.connection.setOptions(tailOptions);
            }
        }
    }
    async setTails(accountId, apiToken, scriptIds) {
        const stopKeys = setSubtract(this.computeStartingOrStartedTailKeys(), new Set([
            ...scriptIds
        ].map((v)=>packTailKey(accountId, v))));
        for (const stopKey of stopKeys){
            const record = this.records.get(stopKey);
            record.state = 'inactive';
            record.stopRequestedTime = Date.now();
            setTimeout(()=>{
                if (record.state === 'inactive' && record.stopRequestedTime && Date.now() - record.stopRequestedTime >= this.inactiveTailSeconds) {
                    record.state = 'stopping';
                    console.log(`Stopping ${record.scriptId}, inactive for ${Date.now() - record.stopRequestedTime}ms`);
                    record.connection?.close(1000, 'no longer interested');
                    this.records.delete(record.tailKey);
                }
            }, this.inactiveTailSeconds * 1000);
        }
        if (stopKeys.size > 0) {
            this.dispatchTailsChanged();
        }
        for (const scriptId of scriptIds){
            const tailKey = packTailKey(accountId, scriptId);
            const existingRecord = this.records.get(tailKey);
            if (existingRecord) {
                if (existingRecord.state === 'inactive') {
                    console.log(`Reviving inactive ${scriptId}`);
                }
                existingRecord.state = 'started';
                existingRecord.stopRequestedTime = undefined;
            } else {
                const record = {
                    state: 'starting',
                    tailKey,
                    apiToken,
                    accountId,
                    scriptId,
                    retryCountAfterClose: 0
                };
                this.records.set(tailKey, record);
                await this.startTailConnection(record);
                record.state = 'started';
            }
            this.dispatchTailsChanged();
        }
    }
    dispatchTailsChanged() {
        const tailKeys = new Set([
            ...this.records.values()
        ].filter((v)=>v.state === 'started').map((v)=>v.tailKey));
        this.callbacks.onTailsChanged(tailKeys);
    }
    computeStartingOrStartedTailKeys() {
        return new Set([
            ...this.records.values()
        ].filter((v)=>v.state === 'starting' || v.state === 'started').map((v)=>v.tailKey));
    }
    setOnline(online) {
        if (online === this.online) return;
        const oldOnline = this.online;
        this.online = online;
        this.callbacks.onNetworkStatusChanged(online);
        if (typeof oldOnline === 'boolean') {
            if (online) {
                for (const record of this.records.values()){
                    if (record.state === 'started') {
                        const { accountId, scriptId } = record;
                        this.startTailConnection(record).catch((e)=>this.callbacks.onTailFailedToStart(accountId, scriptId, 'restart-after-coming-online', e));
                    }
                }
            } else {
                for (const record of this.records.values()){
                    record.connection?.close(1000, 'offline');
                }
            }
        }
    }
    async startTailConnection(record) {
        const allowedToStart = record.state === 'starting' || record.state === 'started';
        if (!allowedToStart) return;
        const { accountId, scriptId } = unpackTailKey(record.tailKey);
        const { apiToken } = record;
        if (!record.tail || Date.now() > new Date(record.tail.expires_at).getTime() - 1000 * 60 * 5) {
            const tailCreatingTime = Date.now();
            this.callbacks.onTailCreating(accountId, scriptId);
            const tail = await createTail({
                accountId,
                scriptName: scriptId,
                apiToken
            });
            record.tail = tail;
            this.callbacks.onTailCreated(accountId, scriptId, Date.now() - tailCreatingTime, tail);
        }
        if (record.state === 'inactive') return;
        const { callbacks, websocketPingIntervalSeconds } = this;
        const dis = this;
        const openingTime = Date.now();
        const tailConnectionCallbacks = {
            onOpen (_cn, timeStamp) {
                record.retryCountAfterClose = 0;
                callbacks.onTailConnectionOpen(accountId, scriptId, timeStamp, Date.now() - openingTime);
            },
            onClose (_cn, timeStamp, code, reason, wasClean) {
                callbacks.onTailConnectionClose(accountId, scriptId, timeStamp, code, reason, wasClean);
                record.closeTime = Date.now();
                if (record.state === 'started' && dis.online !== false) {
                    record.retryCountAfterClose++;
                    const delaySeconds = Math.min(record.retryCountAfterClose * 5, 60);
                    console.log(`Will attempt to restart ${scriptId} in ${delaySeconds} seconds`);
                    setTimeout(async function() {
                        if (record.state === 'started') {
                            await dis.startTailConnection(record);
                        }
                    }, delaySeconds * 1000);
                }
            },
            onError (_cn, timeStamp, errorInfo) {
                callbacks.onTailConnectionError(accountId, scriptId, timeStamp, errorInfo);
            },
            onTailMessage (_cn, timeStamp, message) {
                if (record.state !== 'started') return;
                callbacks.onTailConnectionMessage(accountId, scriptId, timeStamp, message);
            },
            onUnparsedMessage (_cn, timeStamp, message, parseError) {
                console.log('onUnparsedMessage', timeStamp, message, parseError);
                callbacks.onTailConnectionUnparsedMessage(accountId, scriptId, timeStamp, message, parseError);
            }
        };
        record.connection = new TailConnection(record.tail.url, tailConnectionCallbacks, {
            websocketPingIntervalSeconds
        }).setOptions(this.tailOptions);
    }
}
function unpackTailKey(tailKey) {
    const m = /^([^\s-]+)-([^\s]+)$/.exec(tailKey);
    if (!m) throw new Error(`Bad tailKey: ${tailKey}`);
    return {
        accountId: m[1],
        scriptId: m[2]
    };
}
function packTailKey(accountId, scriptId) {
    return `${accountId}-${scriptId}`;
}
class SwitchableTailControllerCallbacks {
    callbacks;
    enabledFn;
    constructor(callbacks, enabledFn){
        this.callbacks = callbacks;
        this.enabledFn = enabledFn;
    }
    onTailCreating(accountId, scriptId) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailCreating(accountId, scriptId);
    }
    onTailCreated(accountId, scriptId, tookMillis, tail) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailCreated(accountId, scriptId, tookMillis, tail);
    }
    onTailConnectionOpen(accountId, scriptId, timeStamp, tookMillis) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionOpen(accountId, scriptId, timeStamp, tookMillis);
    }
    onTailConnectionClose(accountId, scriptId, timeStamp, code, reason, wasClean) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionClose(accountId, scriptId, timeStamp, code, reason, wasClean);
    }
    onTailConnectionError(accountId, scriptId, timeStamp, errorInfo) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionError(accountId, scriptId, timeStamp, errorInfo);
    }
    onTailConnectionMessage(accountId, scriptId, timeStamp, message) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionMessage(accountId, scriptId, timeStamp, message);
    }
    onTailConnectionUnparsedMessage(accountId, scriptId, timeStamp, message, parseError) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionUnparsedMessage(accountId, scriptId, timeStamp, message, parseError);
    }
    onTailsChanged(tails) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailsChanged(tails);
    }
    onNetworkStatusChanged(online) {
        if (!this.enabledFn()) return;
        this.callbacks.onNetworkStatusChanged(online);
    }
    onTailFailedToStart(accountId, scriptId, trigger, error) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailFailedToStart(accountId, scriptId, trigger, error);
    }
}
class DemoMode {
    static profiles = [
        {
            id: 'profile1',
            text: 'corp-profile'
        },
        {
            id: 'profile2',
            text: 'pers-profile'
        }
    ];
    static selectedProfileId = 'profile1';
    static setSelectedProfileId(_value) {}
    static scripts = [
        {
            id: 'script1',
            text: 'worker1-dev'
        },
        {
            id: 'script2',
            text: 'worker1-prod'
        },
        {
            id: 'script3',
            text: 'worker2-dev'
        },
        {
            id: 'script4',
            text: 'worker2-beta'
        },
        {
            id: 'script5',
            text: 'worker2-prod'
        },
        {
            id: 'script6',
            text: 'durable-object-demo'
        },
        {
            id: 'script7',
            text: 'secret-app'
        }
    ];
    static selectedScriptIds = new Set([
        'script7',
        'script4'
    ]);
    static setSelectedScriptIds(_scriptIds) {}
    static tails = new Set();
    static logFakeOutput(callbacks) {
        const accountId = '15a7fa3a37254fe4a7cadd1bb2762879';
        const scriptId = 'secret-app';
        callbacks.onTailCreating(accountId, scriptId);
        const tail = {
            id: 'db19eb8be9f4443aab91a9042c0d3517',
            url: 'wss://tail.developers.workers.dev/db19eb8be9f4443aab91a9042c0d3517',
            'expires_at': new Date().toISOString()
        };
        callbacks.onTailCreated(accountId, scriptId, 155, tail);
        callbacks.onTailsChanged(new Set([
            packTailKey(accountId, scriptId)
        ]));
        callbacks.onTailConnectionOpen(accountId, scriptId, Date.now(), 42);
        for(let i = 0; i < 2; i++){
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeRequest());
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeDoRequest());
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeRequestWithLogs());
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeRequestExceedingTimeLimit());
        }
    }
}
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:91.0) Gecko/20100101 Firefox/91.0';
function computeFakeRequest() {
    const rt = {
        event: {
            request: {
                url: 'https://example.com/endpoint',
                method: 'GET',
                headers: {
                    'cf-connecting-ip': '203.0.113.12',
                    'user-agent': USER_AGENT
                },
                cf: {
                    colo: 'DFW'
                }
            }
        },
        logs: [],
        exceptions: [],
        eventTimestamp: Date.now(),
        outcome: 'ok'
    };
    return rt;
}
function computeFakeDoRequest() {
    const rt = {
        event: {
            request: {
                url: 'https://fake-host/put',
                method: 'PUT',
                headers: {}
            }
        },
        logs: [
            {
                level: 'log',
                timestamp: Date.now(),
                message: [
                    'logprops:',
                    {
                        colo: 'EWR',
                        durableObjectClass: 'LoggerDO',
                        durableObjectId: '538fc7ce55b14e53b6b8552befeb9af4',
                        durableObjectName: 'log1'
                    }
                ]
            }
        ],
        exceptions: [],
        eventTimestamp: Date.now(),
        outcome: 'ok'
    };
    return rt;
}
function computeFakeRequestWithLogs() {
    const rt = {
        event: {
            request: {
                url: 'https://my-worker.subdomain.workers.dev/test?log=true',
                method: 'GET',
                headers: {
                    'cf-connecting-ip': '203.0.113.12',
                    'user-agent': USER_AGENT
                },
                cf: {
                    colo: 'DFW'
                }
            }
        },
        logs: [
            {
                level: 'log',
                timestamp: Date.now(),
                message: [
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
                ]
            },
            {
                level: 'error',
                timestamp: Date.now(),
                message: [
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
                ]
            },
            {
                level: 'info',
                timestamp: Date.now(),
                message: [
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
                ]
            },
            {
                level: 'warning',
                timestamp: Date.now(),
                message: [
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
                ]
            },
            {
                level: 'debug',
                timestamp: Date.now(),
                message: [
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
                ]
            }
        ],
        exceptions: [],
        eventTimestamp: Date.now(),
        outcome: 'ok'
    };
    return rt;
}
function computeFakeRequestExceedingTimeLimit() {
    const rt = {
        event: {
            request: {
                url: 'https://my-worker.subdomain.workers.dev/compute-digits-of-pi',
                method: 'GET',
                headers: {
                    'cf-connecting-ip': '203.0.113.12',
                    'user-agent': USER_AGENT
                },
                cf: {
                    colo: 'DFW'
                }
            }
        },
        logs: [
            {
                level: 'log',
                timestamp: Date.now(),
                message: [
                    'burning cpu'
                ]
            }
        ],
        exceptions: [
            {
                name: 'Error',
                timestamp: Date.now(),
                message: 'Worker exceeded CPU time limit.'
            }
        ],
        eventTimestamp: Date.now(),
        outcome: 'exceededCpu'
    };
    return rt;
}
class QpsController {
    sortedEventTimes = [];
    callbacks;
    n;
    _qps = 0;
    get qps() {
        return this._qps;
    }
    constructor(n, callbacks){
        this.callbacks = callbacks;
        this.n = n;
    }
    addEvent(eventTime) {
        const qps = computeQps(this.n, this.sortedEventTimes, eventTime);
        if (qps === this._qps) return;
        this._qps = qps;
        this.callbacks.onQpsChanged(qps);
    }
}
function computeQps(n, sortedEventTimes, eventTime) {
    add(eventTime, sortedEventTimes);
    while(sortedEventTimes.length > n){
        sortedEventTimes.shift();
    }
    const num = sortedEventTimes.length;
    if (num < 2) return 0;
    const timeDiffSeconds = (sortedEventTimes[sortedEventTimes.length - 1] - sortedEventTimes[0]) / 1000;
    return (num - 1) / timeDiffSeconds;
}
function add(el, arr) {
    arr.splice(findLoc(el, arr) + 1, 0, el);
    return arr;
}
function findLoc(el, arr, st, en) {
    st = st || 0;
    en = en || arr.length;
    for(let i = 0; i < arr.length; i++){
        if (arr[i] > el) {
            return i - 1;
        }
    }
    return en;
}
class WebtailAppVM {
    _profiles = [];
    get profiles() {
        return this.demoMode ? DemoMode.profiles : this._profiles;
    }
    get realProfiles() {
        return this._profiles;
    }
    _selectedProfileId;
    get selectedProfileId() {
        return this.demoMode ? DemoMode.selectedProfileId : this._selectedProfileId;
    }
    set selectedProfileId(value) {
        if (this.demoMode) {
            DemoMode.setSelectedProfileId(value);
            return;
        }
        if (this._selectedProfileId === value) return;
        this._selectedProfileId = value;
        this.onChange();
        this.state.selectedProfileId = value;
        saveState(this.state);
        this.findScripts();
    }
    _analytics = [
        {
            id: 'durable-objects',
            text: 'Durable Objects',
            description: 'Daily metrics and associated costs'
        }
    ];
    get analytics() {
        return this._analytics;
    }
    _selectedAnalyticId;
    get selectedAnalyticId() {
        return this._selectedAnalyticId;
    }
    analyticsState = {
        querying: false
    };
    _scripts = [];
    get scripts() {
        return this.demoMode ? DemoMode.scripts : this._scripts;
    }
    _selectedScriptIds = new Set();
    get selectedScriptIds() {
        return this.demoMode ? DemoMode.selectedScriptIds : this._selectedScriptIds;
    }
    set selectedScriptIds(scriptIds) {
        if (this._selectedAnalyticId !== undefined) {
            this._selectedAnalyticId = undefined;
            this.onChange();
        }
        if (this.demoMode) {
            DemoMode.setSelectedScriptIds(scriptIds);
            return;
        }
        if (setEqual(this._selectedScriptIds, scriptIds)) return;
        this._selectedScriptIds = new Set(scriptIds);
        this.onChange();
        const profile = this.selectedProfileId && this.state.profiles[this.selectedProfileId];
        if (profile) {
            profile.selectedScriptIds = [
                ...scriptIds
            ];
            saveState(this.state);
        }
        this.setTails();
    }
    profileForm = new ProfileFormVM();
    filterForm = new FilterFormVM();
    filter = {};
    extraFields = [];
    _tails = new Set();
    get tails() {
        return this.demoMode ? DemoMode.tails : this._tails;
    }
    set tails(tails) {
        if (this.demoMode) DemoMode.tails = tails;
        this._tails = tails;
    }
    welcomeShowing = false;
    aboutShowing = false;
    state = loadState();
    tailController;
    tailControllerCallbacks;
    qpsController;
    demoMode = false;
    onChange = ()=>{};
    logger = ()=>{};
    onResetOutput = ()=>{};
    onQpsChange = ()=>{};
    constructor(){
        const dis = this;
        this.qpsController = new QpsController(20, {
            onQpsChanged (qps) {
                if (dis.demoMode) return;
                dis.onQpsChange(qps);
            }
        });
        const logTailsChange = (action, tailKeys)=>{
            if (tailKeys.size > 0) this.logWithPrefix(`${action} ${[
                ...tailKeys
            ].map((v)=>unpackTailKey(v).scriptId).sort().join(', ')}`);
        };
        const logWithPrefix = this.logWithPrefix.bind(this);
        const verboseWithPrefix = this.verboseWithPrefix.bind(this);
        const callbacks = {
            onTailCreating (_accountId, scriptId) {
                verboseWithPrefix(`Creating tail for ${scriptId}...`);
            },
            onTailCreated (_accountId, scriptId, tookMillis, tail) {
                verboseWithPrefix(`Created tail for ${scriptId} in ${tookMillis}ms, ${JSON.stringify(tail)}`);
            },
            onTailConnectionOpen (_accountId, scriptId, _timeStamp, tookMillis) {
                verboseWithPrefix(`Opened tail for ${scriptId} in ${tookMillis}ms`);
            },
            onTailConnectionClose (accountId, scriptId, timeStamp, code, reason, wasClean) {
                console.log('onTailConnectionClose', {
                    accountId,
                    scriptId,
                    timeStamp,
                    code,
                    reason,
                    wasClean
                });
                verboseWithPrefix(`Closed tail for ${scriptId}, ${JSON.stringify({
                    code,
                    reason,
                    wasClean
                })}`);
            },
            onTailConnectionError (accountId, scriptId, timeStamp, errorInfo) {
                console.log('onTailConnectionError', {
                    accountId,
                    scriptId,
                    timeStamp,
                    errorInfo
                });
                logWithPrefix(`Error in tail for ${scriptId}`, {
                    errorInfo
                });
            },
            onTailConnectionMessage (_accountId, _scriptId, _timeStamp, message) {
                if (computeMessagePassesFilter(message, dis.filter)) {
                    dumpMessagePretty(message, dis.logger, dis.computeAdditionalLogs(message));
                }
                if (dis.demoMode) return;
                dis.qpsController.addEvent(message.eventTimestamp);
            },
            onTailConnectionUnparsedMessage (_accountId, scriptId, _timeStamp, message, parseError) {
                console.log(message);
                logWithPrefix(`Unparsed message in tail for ${scriptId}`, parseError.stack || parseError.message);
            },
            onTailsChanged (tails) {
                if (setEqual(dis.tails, tails)) return;
                const removed = setSubtract(dis.tails, tails);
                logTailsChange('Untailing', removed);
                const added = setSubtract(tails, dis.tails);
                logTailsChange('Tailing', added);
                dis.tails = tails;
                dis.onChange();
            },
            onNetworkStatusChanged (online) {
                if (online) {
                    logWithPrefix('%cONLINE%c', 'color: green');
                } else {
                    logWithPrefix('%cOFFLINE%c', 'color: red');
                }
            },
            onTailFailedToStart (_accountId, scriptId, trigger, error) {
                verboseWithPrefix(`Tail for ${scriptId} failed to start (${trigger}): ${error.name} ${error.message}`);
            }
        };
        const websocketPingIntervalSeconds = AppConstants.WEBSOCKET_PING_INTERVAL_SECONDS;
        const inactiveTailSeconds = AppConstants.INACTIVE_TAIL_SECONDS;
        this.tailController = new TailController(new SwitchableTailControllerCallbacks(callbacks, ()=>!this.demoMode), {
            websocketPingIntervalSeconds,
            inactiveTailSeconds
        });
        this.tailControllerCallbacks = callbacks;
        this.extraFields = [
            ...this.state.extraFields || []
        ];
        this.filter = this.state.filter || {};
        this.applyFilter({
            save: false
        });
    }
    start() {
        this.reloadProfiles();
        this.recomputeWelcomeShowing();
        this.performInitialSelection();
    }
    newProfile() {
        if (this.demoMode) {
            if (this.welcomeShowing) {} else {
                return;
            }
        }
        this.profileForm.profileId = generateUuid();
        this.profileForm.showing = true;
        this.profileForm.title = 'New Profile';
        this.profileForm.name = this._profiles.length === 0 ? 'default' : `profile${this._profiles.length + 1}`;
        this.profileForm.accountId = '';
        this.profileForm.apiToken = '';
        this.profileForm.deleteVisible = false;
        this.profileForm.enabled = true;
        this.profileForm.outputMessage = '';
        this.profileForm.computeSaveEnabled();
        this.onChange();
    }
    editProfile(profileId) {
        if (this.demoMode) return;
        const profile = this.state.profiles[profileId];
        if (!profile) throw new Error(`Profile ${profileId} not found`);
        this._selectedProfileId = profileId;
        const { name, accountId, apiToken } = profile;
        this.profileForm.profileId = profileId;
        this.profileForm.showing = true;
        this.profileForm.title = 'Edit Profile';
        this.profileForm.name = name;
        this.profileForm.accountId = accountId;
        this.profileForm.apiToken = apiToken;
        this.profileForm.deleteVisible = true;
        this.profileForm.enabled = true;
        this.profileForm.outputMessage = '';
        this.profileForm.computeSaveEnabled();
        this.onChange();
    }
    deleteProfile(profileId) {
        console.log('delete profile', profileId);
        const profile = this.state.profiles[profileId];
        if (!profile) throw new Error(`Profile ${profileId} not found`);
        delete this.state.profiles[profileId];
        saveState(this.state);
        this.profileForm.showing = false;
        this.reloadProfiles();
        this.recomputeWelcomeShowing();
        this.performInitialSelection();
    }
    cancelProfile() {
        this.profileForm.showing = false;
        this.onChange();
    }
    setProfileName(name) {
        this.profileForm.name = name;
        this.profileForm.computeSaveEnabled();
        this.onChange();
    }
    setProfileAccountId(accountId) {
        this.profileForm.accountId = accountId;
        this.profileForm.computeSaveEnabled();
        this.onChange();
    }
    setProfileApiToken(apiToken) {
        this.profileForm.apiToken = apiToken;
        this.profileForm.computeSaveEnabled();
        this.onChange();
    }
    saveProfile() {
        const { profileForm } = this;
        const { profileId } = profileForm;
        const newProfile = {
            name: profileForm.name.trim(),
            accountId: profileForm.accountId.trim(),
            apiToken: profileForm.apiToken.trim()
        };
        this.trySaveProfile(profileId, newProfile);
    }
    editEventFilter() {
        if (this.demoMode) return;
        const { filter, filterForm } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Event type:';
        filterForm.fieldValueChoices = [
            {
                id: 'all',
                text: 'All'
            },
            {
                id: 'cron',
                text: 'CRON trigger'
            },
            {
                id: 'http',
                text: 'HTTP request'
            }
        ];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = filter.event1 === 'http' ? 'http' : filter.event1 === 'cron' ? 'cron' : 'all';
        filterForm.helpText = 'Choose which types of events to show';
        filterForm.applyValue = ()=>{
            if (filter.event1 === filterForm.fieldValue) return;
            filter.event1 = filterForm.fieldValue;
            this.applyFilter({
                save: true
            });
            const selectedChoiceText = filterForm.fieldValueChoices.find((v)=>v.id === filterForm.fieldValue).text;
            this.logWithPrefix(`Event type filter changed to: ${selectedChoiceText}`);
        };
        this.onChange();
    }
    editStatusFilter() {
        if (this.demoMode) return;
        const { filter, filterForm } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Status:';
        filterForm.fieldValueChoices = [
            {
                id: 'all',
                text: 'All'
            },
            {
                id: 'success',
                text: 'Success'
            },
            {
                id: 'error',
                text: 'Error'
            }
        ];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = filter.status1 === 'success' ? 'success' : filter.status1 === 'error' ? 'error' : 'all';
        filterForm.helpText = 'Show events this this status';
        filterForm.applyValue = ()=>{
            if (filter.status1 === filterForm.fieldValue) return;
            filter.status1 = filterForm.fieldValue;
            this.applyFilter({
                save: true
            });
            const selectedChoiceText = filterForm.fieldValueChoices.find((v)=>v.id === filterForm.fieldValue).text;
            this.logWithPrefix(`Status filter changed to: ${selectedChoiceText}`);
        };
        this.onChange();
    }
    editIpAddressFilter() {
        if (this.demoMode) return;
        const { filter, filterForm } = this;
        const isValidIpAddress = (ipAddress)=>{
            return /^(self|[\d\.:a-f]{3,})$/.test(ipAddress);
        };
        const checkValidIpAddress = (ipAddress)=>{
            if (!isValidIpAddress(ipAddress)) throw new Error(`Bad ip address: ${ipAddress}`);
            return ipAddress;
        };
        const parseFilterIpAddressesFromFieldValue = ()=>{
            const { fieldValue } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map((v)=>v.trim().toLowerCase()).filter((v)=>v !== '').map(checkValidIpAddress));
        };
        const computeFieldValueFromFilterIpAddresses = ()=>{
            return distinct(filter.ipAddress1 || []).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'IP address(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromFilterIpAddresses();
        filterForm.helpText = `'self' to filter your own address, comma-separated if multiple, e.g. self, 1.1.1.1`;
        filterForm.applyValue = ()=>{
            const newValue = parseFilterIpAddressesFromFieldValue();
            if (setEqual(new Set(filter.ipAddress1 || []), new Set(newValue))) return;
            filter.ipAddress1 = newValue;
            this.applyFilter({
                save: true
            });
            const text = newValue.length === 0 ? 'any IP address' : newValue.join(', ');
            this.logWithPrefix(`IP address filter changed to: ${text}`);
        };
        this.onChange();
    }
    editMethodFilter() {
        if (this.demoMode) return;
        const { filter, filterForm } = this;
        const parseFilterMethodsFromFieldValue = ()=>{
            const { fieldValue } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map((v)=>v.trim().toUpperCase()).filter((v)=>v !== ''));
        };
        const computeFieldValueFromFilterMethods = ()=>{
            return distinct(filter.method1 || []).map((v)=>v.toUpperCase()).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'HTTP Method(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromFilterMethods();
        filterForm.helpText = 'comma-separated if multiple, e.g. GET, POST';
        filterForm.applyValue = ()=>{
            const newValue = parseFilterMethodsFromFieldValue();
            if (setEqual(new Set(filter.method1 || []), new Set(newValue))) return;
            filter.method1 = newValue;
            this.applyFilter({
                save: true
            });
            const text = newValue.length === 0 ? 'any method' : newValue.join(', ');
            this.logWithPrefix(`Method filter changed to: ${text}`);
        };
        this.onChange();
    }
    editSamplingRateFilter() {
        if (this.demoMode) return;
        const parseSampleRateFromFieldValue = ()=>{
            const { fieldValue } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return 1;
            const num = parseFloat(v);
            if (!isValidSamplingRate(num)) throw new Error(`Invalid rate: ${v}`);
            return num;
        };
        const { filter, filterForm } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Sampling rate:';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = (typeof filter.samplingRate1 === 'number' && isValidSamplingRate(filter.samplingRate1) ? filter.samplingRate1 : 1).toFixed(2);
        filterForm.helpText = 'Can range from 0 (0%) to 1 (100%)';
        filterForm.applyValue = ()=>{
            const newValue = parseSampleRateFromFieldValue();
            if (filter.samplingRate1 === newValue) return;
            filter.samplingRate1 = newValue;
            this.applyFilter({
                save: true
            });
            const text = newValue === 1 ? 'no sampling' : `${newValue} (${(newValue * 100).toFixed(2)}%)`;
            this.logWithPrefix(`Sample rate filter changed to: ${text}`);
        };
        this.onChange();
    }
    editSearchFilter() {
        if (this.demoMode) return;
        const { filter, filterForm } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Search text:';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = filter.search1 || '';
        filterForm.helpText = 'Filter by a text match in console.log messages';
        filterForm.applyValue = ()=>{
            if (filter.search1 === filterForm.fieldValue) return;
            filter.search1 = filterForm.fieldValue;
            this.applyFilter({
                save: true
            });
            const text = (filter.search1 || '').length === 0 ? 'no search filter' : `'${filter.search1}'`;
            this.logWithPrefix(`Search filter changed to: ${text}`);
        };
        this.onChange();
    }
    editHeaderFilter() {
        if (this.demoMode) return;
        const { filter, filterForm } = this;
        const parseFilterHeadersFromFieldValue = ()=>{
            const { fieldValue } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map((v)=>v.trim()).filter((v)=>v !== ''));
        };
        const computeFieldValueFromFilterHeaders = ()=>{
            return distinct(filter.header1 || []).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Header(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromFilterHeaders();
        filterForm.helpText = `'key', or 'key:query', comma-separated if multiple`;
        filterForm.applyValue = ()=>{
            const newValue = parseFilterHeadersFromFieldValue();
            if (setEqual(new Set(filter.header1 || []), new Set(newValue))) return;
            filter.header1 = newValue;
            this.applyFilter({
                save: true
            });
            const text = newValue.length === 0 ? 'no header filter' : newValue.join(', ');
            this.logWithPrefix(`Header filter changed to: ${text}`);
        };
        this.onChange();
    }
    editLogpropFilter() {
        if (this.demoMode) return;
        const { filter, filterForm } = this;
        const parseLogpropFiltersFromFieldValue = ()=>{
            const { fieldValue } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map((v)=>v.trim()).filter((v)=>v !== ''));
        };
        const computeFieldValueFromLogPropFilters = ()=>{
            return distinct(filter.logprop1 || []).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Logprop(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromLogPropFilters();
        filterForm.helpText = `'key', or 'key:value', comma-separated if multiple, value may include *`;
        filterForm.applyValue = ()=>{
            const newValue = parseLogpropFiltersFromFieldValue();
            this.setLogpropFilter(newValue);
        };
        this.onChange();
    }
    setLogpropFilter(logpropFilters) {
        const { filter } = this;
        if (setEqual(new Set(filter.logprop1 || []), new Set(logpropFilters))) return;
        filter.logprop1 = logpropFilters;
        this.applyFilter({
            save: true
        });
        const text = logpropFilters.length === 0 ? 'no logprop filter' : logpropFilters.join(', ');
        this.logWithPrefix(`Logprop filter changed to: ${text}`);
    }
    hasAnyFilters() {
        const { filter } = this;
        const { event1 } = filter;
        return computeTailOptionsForFilter(filter).filters.length > 0 || typeof event1 === 'string' && event1 !== '' && event1 !== 'all';
    }
    resetFilters() {
        if (this.demoMode) return;
        this.filter = {};
        this.applyFilter({
            save: true
        });
        this.logWithPrefix(`Filters reset`);
        this.onChange();
    }
    cancelFilter() {
        console.log('cancelFilter');
        this.filterForm.showing = false;
        this.onChange();
    }
    saveFilter() {
        console.log('saveFilter');
        const { filterForm } = this;
        filterForm.enabled = false;
        filterForm.outputMessage = 'Checking filter...';
        this.onChange();
        try {
            filterForm.applyValue();
            filterForm.outputMessage = ``;
            filterForm.showing = false;
        } catch (e) {
            filterForm.outputMessage = `Error: ${e.message}`;
        } finally{
            filterForm.enabled = true;
            this.onChange();
        }
    }
    selectFilterChoice(id) {
        if (this.filterForm.fieldValue === id) return;
        this.filterForm.fieldValue = id;
        this.onChange();
    }
    editSelectionFields() {
        if (this.demoMode) return;
        const { filterForm } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Additional fields:';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = EXTRA_FIELDS_OPTIONS;
        filterForm.fieldValue = (this.extraFields || []).join(',');
        filterForm.helpText = 'Select additional fields to show in the output';
        filterForm.applyValue = ()=>{
            const newValues = distinct((filterForm.fieldValue || '').split(',').map((v)=>v.trim()).filter((v)=>v !== ''));
            if (setEqual(new Set(this.extraFields || []), new Set(newValues))) return;
            this.extraFields = newValues;
            this.applyFilter({
                save: true
            });
            const extraFieldsText = this.computeSelectionFieldsText();
            this.logWithPrefix(`Output fields changed to: ${extraFieldsText}`);
        };
        this.onChange();
    }
    computeSelectionFieldsText() {
        return [
            'standard fields',
            ...this.extraFields.map((id)=>EXTRA_FIELDS_OPTIONS.find((v)=>v.id === id)?.text || id)
        ].join(', ');
    }
    toggleFilterOption(id) {
        const extraFields = distinct((this.filterForm.fieldValue || '').split(',').map((v)=>v.trim()).filter((v)=>v !== ''));
        const i = extraFields.indexOf(id);
        if (i >= 0) {
            extraFields.splice(i, 1);
        } else {
            extraFields.push(id);
        }
        const fieldValue = extraFields.join(',');
        if (this.filterForm.fieldValue === fieldValue) return;
        this.filterForm.fieldValue = fieldValue;
        this.onChange();
    }
    toggleDemoMode() {
        this.setDemoMode(!this.demoMode);
        this.onChange();
    }
    resetOutput() {
        if (this.demoMode) return;
        this.onResetOutput();
    }
    showAbout() {
        if (this.demoMode) return;
        this.aboutShowing = true;
        this.onChange();
    }
    closeAbout() {
        this.aboutShowing = false;
        this.onChange();
    }
    showAnalytic(analyticId) {
        const analytic = this.analytics.find((v)=>v.id === analyticId);
        if (!analytic || analytic.id === this._selectedAnalyticId) return;
        if (this.selectedProfileId === undefined) return;
        const profile = this.state.profiles[this.selectedProfileId];
        if (profile === undefined) return;
        const { accountId, apiToken } = profile;
        this._selectedAnalyticId = analyticId;
        this.analyticsState.querying = true;
        this.analyticsState.durableObjectsCosts = undefined;
        this.analyticsState.error = undefined;
        this.onChange();
        const client = new CfGqlClient({
            accountId,
            apiToken
        });
        this.queryDurableObjectsCosts(client);
    }
    setDemoMode(demoMode) {
        if (this.demoMode === demoMode) return;
        this.demoMode = demoMode;
        if (demoMode) {
            console.log('Enable demo mode');
            this.onQpsChange(12.34);
            this.onResetOutput();
            DemoMode.logFakeOutput(this.tailControllerCallbacks);
        } else {
            console.log('Disable demo mode');
            this.onQpsChange(this.qpsController.qps);
            this.onResetOutput();
        }
    }
    applyFilter(opts) {
        const { save } = opts;
        this.state.filter = this.filter;
        this.state.extraFields = this.extraFields;
        if (save) saveState(this.state);
        const tailOptions = computeTailOptionsForFilter(this.filter);
        this.tailController.setTailOptions(tailOptions);
    }
    logWithPrefix(...data) {
        const time = formatLocalYyyyMmDdHhMmSs(new Date());
        if (data.length > 0 && typeof data[0] === 'string') {
            data = [
                `[%c${time}%c] ${data[0]}`,
                'color: gray',
                '',
                ...data.slice(1)
            ];
        }
        this.logger(...data);
    }
    verboseWithPrefix(message) {
        const time = formatLocalYyyyMmDdHhMmSs(new Date());
        this.logger(`[%c${time}%c] %c${message}%c`, 'color: gray', '', 'color: gray');
    }
    performInitialSelection() {
        const initiallySelectedProfileId = computeInitiallySelectedProfileId(this.state, this._profiles);
        if (initiallySelectedProfileId) {
            console.log(`Initially selecting profile: ${this.state.profiles[initiallySelectedProfileId].name}`);
            this.selectedProfileId = initiallySelectedProfileId;
        } else {
            this.onChange();
        }
    }
    async trySaveProfile(profileId, profile) {
        const { profileForm } = this;
        profileForm.enabled = false;
        profileForm.progressVisible = true;
        profileForm.outputMessage = 'Checking profile...';
        this.onChange();
        try {
            const canListTails = await computeCanListTails(profile.accountId, profile.apiToken);
            if (canListTails) {
                this.state.profiles[profileId] = profile;
                saveState(this.state);
                profileForm.outputMessage = '';
                this.reloadProfiles();
                this.recomputeWelcomeShowing();
                profileForm.showing = false;
                this.selectedProfileId = profileId;
            } else {
                profileForm.outputMessage = `These credentials do not have permission to tail`;
            }
        } catch (e) {
            profileForm.outputMessage = `Error: ${e.message}`;
        } finally{
            profileForm.progressVisible = false;
            profileForm.enabled = true;
            this.onChange();
        }
    }
    reloadProfiles() {
        const { state } = this;
        this._profiles.splice(0);
        for (const [profileId, profile] of Object.entries(state.profiles)){
            const name = profile.name || '(unnamed)';
            this._profiles.push({
                id: profileId,
                text: name
            });
        }
    }
    async findScripts() {
        try {
            if (this.selectedProfileId === undefined) return;
            const profile = this.state.profiles[this.selectedProfileId];
            if (profile === undefined) return;
            const { accountId, apiToken } = profile;
            this.verboseWithPrefix(`Finding scripts for ${profile.name.toUpperCase()}...`);
            const start = Date.now();
            const scripts = await listScripts({
                accountId,
                apiToken
            });
            if (!this.demoMode) this.verboseWithPrefix(`Found ${scripts.length} scripts in ${Date.now() - start}ms`);
            this._scripts.splice(0);
            for (const script of scripts){
                this._scripts.push({
                    id: script.id,
                    text: script.id
                });
            }
            this._scripts.sort((lhs, rhs)=>lhs.text.localeCompare(rhs.text));
            const selectedScriptIds = this.computeSelectedScriptIdsAfterFindScripts();
            if (selectedScriptIds.size > 0) {
                this.selectedScriptIds = selectedScriptIds;
            }
            if (!this.demoMode) this.onChange();
        } catch (e) {
            if (!this.demoMode) this.logger(`Error in findScripts: ${e.stack}`);
        }
    }
    computeSelectedScriptIdsAfterFindScripts() {
        if (this._scripts.length === 0) {
            console.log('Initially selecting no scripts, no scripts to select');
            return new Set();
        }
        if (this.selectedProfileId && this.selectedProfileId && this.selectedProfileId === this.state.selectedProfileId) {
            const initialProfile = this.state.profiles[this.selectedProfileId];
            if (initialProfile && initialProfile.selectedScriptIds && initialProfile.selectedScriptIds.length > 0) {
                const currentScriptIds = new Set(this._scripts.map((v)=>v.id));
                const candidates = setIntersect(currentScriptIds, new Set(initialProfile.selectedScriptIds));
                if (candidates.size > 0) {
                    console.log(`Initially selecting script${candidates.size === 1 ? '' : 's'} ${[
                        ...candidates
                    ].sort().join(', ')}: remembered from last time`);
                    return candidates;
                }
            }
        }
        const firstScriptId = this._scripts[0].id;
        console.log(`Initially selecting script ${firstScriptId}: first one in the list`);
        return new Set([
            this._scripts[0].id
        ]);
    }
    async setTails() {
        if (this.selectedProfileId === undefined) return;
        const profile = this.state.profiles[this.selectedProfileId];
        if (profile === undefined) return;
        const { accountId, apiToken } = profile;
        try {
            await this.tailController.setTails(accountId, apiToken, this._selectedScriptIds);
        } catch (e) {
            this.logger('Error in setTails', e.stack || e.message);
        }
    }
    computeAdditionalLogs(message) {
        const rt = [];
        const includeIpAddress = this.extraFields.includes('ip-address');
        const includeUserAgent = this.extraFields.includes('user-agent');
        const includeReferer = this.extraFields.includes('referer');
        if (includeIpAddress || includeUserAgent || includeReferer) {
            if (message.event !== null && !isTailMessageCronEvent(message.event) && !isTailMessageAlarmEvent(message.event) && !isTailMessageQueueEvent(message.event) && !isTailMessageEmailEvent(message.event) && !isTailMessageOverloadEvent(message.event) && !isTailMessageGetWebSocketEvent(message.event)) {
                if (includeIpAddress) {
                    const ipAddress = message.event.request.headers['cf-connecting-ip'] || undefined;
                    if (ipAddress) rt.push(computeAdditionalLogForExtraField('IP address', ipAddress));
                }
                if (includeUserAgent) {
                    const userAgent = message.event.request.headers['user-agent'] || undefined;
                    if (userAgent) rt.push(computeAdditionalLogForExtraField('User agent', userAgent));
                }
                if (includeReferer) {
                    const referer = message.event.request.headers['referer'] || undefined;
                    if (referer) {
                        const refererUrl = tryParseUrl(referer);
                        let log = true;
                        if (refererUrl !== undefined) {
                            const requestUrl = tryParseUrl(message.event.request.url);
                            if (requestUrl && requestUrl.origin === refererUrl.origin) {
                                log = false;
                            }
                        }
                        if (log) rt.push(computeAdditionalLogForExtraField('Referer', referer));
                    }
                }
            }
        }
        return rt;
    }
    recomputeWelcomeShowing() {
        const shouldShow = this.profiles.length === 0;
        if (shouldShow === this.welcomeShowing) return;
        this.setDemoMode(shouldShow);
        this.welcomeShowing = shouldShow;
    }
    async queryDurableObjectsCosts(client) {
        try {
            this.analyticsState.durableObjectsCosts = await computeDurableObjectsCostsTable(client, {
                lookbackDays: 28
            });
            if (this.analyticsState.durableObjectsCosts.accountTable.rows.length === 0) {
                this.analyticsState.durableObjectsCosts = undefined;
                throw new Error('No durable object analytics found');
            }
        } catch (e) {
            console.warn(e);
            let error = `${e}`;
            if (error.includes('(code=authz)')) {
                error = `The auth token for this profile does not have the Account Analytics:Read permission.`;
            }
            this.analyticsState.error = error;
        } finally{
            this.analyticsState.querying = false;
            this.onChange();
        }
    }
}
function computeAdditionalLogForExtraField(name, value) {
    return {
        data: [
            ` %c|%c [%c${name}%c] ${value}`,
            'color:gray',
            '',
            'color:gray'
        ]
    };
}
class ProfileFormVM {
    showing = false;
    enabled = false;
    name = '';
    accountId = '';
    apiToken = '';
    deleteVisible = false;
    saveEnabled = false;
    profileId = '';
    title = '';
    progressVisible = false;
    outputMessage = '';
    computeSaveEnabled() {
        this.saveEnabled = this.name.trim().length > 0 && this.apiToken.trim().length > 0 && this.accountId.trim().length > 0;
    }
}
class FilterFormVM {
    showing = false;
    enabled = false;
    fieldName = '';
    fieldValueChoices = [];
    fieldValueOptions = [];
    fieldValue;
    helpText = '';
    outputMessage = '';
    applyValue = ()=>{};
}
const EXTRA_FIELDS_OPTIONS = [
    {
        id: 'ip-address',
        text: 'IP address'
    },
    {
        id: 'user-agent',
        text: 'User agent'
    },
    {
        id: 'referer',
        text: 'Referer'
    }
];
const STATE_KEY = 'state1';
function loadState() {
    try {
        const json = localStorage.getItem(STATE_KEY) || undefined;
        if (json) {
            const obj = JSON.parse(json);
            const rt = parseState(obj);
            return rt;
        }
    } catch (e) {
        console.warn('loadState: Error loading state', e.stack || e);
    }
    console.log('loadState: returning new state');
    return {
        profiles: {}
    };
}
function parseState(parsed) {
    if (typeof parsed !== 'object') throw new Error(`Expected object`);
    const { profiles } = parsed;
    if (typeof profiles !== 'object') throw new Error(`Expected profiles object`);
    for (const [profileId, profileState] of Object.entries(profiles)){
        if (typeof profileId !== 'string') throw new Error('Profile id must be string');
        parseProfileState(profileState);
    }
    return parsed;
}
function parseProfileState(parsed) {
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Profile state must be object');
    const { name, accountId, apiToken } = parsed;
    if (typeof name !== 'string' || name.trim().length === 0) throw new Error(`Profile state name must exist`);
    if (typeof accountId !== 'string' || accountId.trim().length === 0) throw new Error(`Profile state accountId must exist`);
    if (typeof apiToken !== 'string' || apiToken.trim().length === 0) throw new Error(`Profile state apiToken must exist`);
    return parsed;
}
function saveState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
async function computeCanListTails(accountId, apiToken) {
    try {
        await listTails({
            accountId,
            scriptName: '',
            apiToken
        });
        return true;
    } catch (e) {
        if (e instanceof CloudflareApiError && e.status === 404) {
            return true;
        } else {}
        return false;
    }
}
function isValidSamplingRate(samplingRate) {
    return !isNaN(samplingRate) && samplingRate >= 0 && samplingRate <= 1;
}
function computeInitiallySelectedProfileId(state, profiles) {
    if (state.selectedProfileId && state.profiles[state.selectedProfileId]) return state.selectedProfileId;
    if (profiles.length > 0) return profiles[0].id;
    return undefined;
}
function computeTailOptionsForFilter(filter) {
    const filters = [];
    if (filter.status1 === 'error') {
        filters.push({
            outcome: [
                'exception',
                'exceededCpu',
                'canceled',
                'unknown'
            ]
        });
    } else if (filter.status1 === 'success') {
        filters.push({
            outcome: [
                'ok'
            ]
        });
    }
    if (filter.samplingRate1 !== undefined && isValidSamplingRate(filter.samplingRate1) && filter.samplingRate1 < 1) {
        filters.push({
            sampling_rate: filter.samplingRate1
        });
    }
    if (filter.search1 !== undefined && filter.search1.length > 0) {
        filters.push({
            query: filter.search1
        });
    }
    if (filter.method1 && filter.method1.length > 0) {
        filters.push({
            method: filter.method1
        });
    }
    if (filter.ipAddress1 && filter.ipAddress1.length > 0) {
        filters.push({
            client_ip: filter.ipAddress1
        });
    }
    if (filter.header1 && filter.header1.length > 0) {
        for (const header of filter.header1){
            filters.push(parseHeaderFilter(header));
        }
    }
    return {
        filters
    };
}
function computeMessagePassesFilter(message, filter) {
    if (!computeMessagePassesLogPropFilter(message, filter.logprop1)) return false;
    if (filter.event1 === 'cron' || filter.event1 === 'http') {
        const isCron = isTailMessageCronEvent(message);
        return isCron && filter.event1 === 'cron' || !isCron && filter.event1 === 'http';
    }
    return true;
}
function computeMessagePassesLogPropFilter(message, logprop1) {
    if (logprop1 === undefined || logprop1.length === 0) return true;
    const logpropFilters = logprop1.map(parseHeaderFilter);
    const { props } = parseLogProps(message.logs);
    for (const logpropFilter of logpropFilters){
        if (computePropsPassLogpropFilter(props, logpropFilter)) return true;
    }
    return false;
}
function computePropsPassLogpropFilter(props, logpropFilter) {
    const val = props[logpropFilter.key];
    if (val === undefined) return false;
    if (logpropFilter.query === undefined) return true;
    const q = logpropFilter.query.trim().replaceAll(/\*+/g, '*');
    if (!q.includes('*')) return q === val;
    if (q === '*') return true;
    if (typeof val !== 'string') return false;
    const pattern = '^' + escapeForRegex(q).replaceAll('\\*', '.*') + '$';
    return new RegExp(pattern).test(val);
}
function escapeForRegex(str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
function distinct(values) {
    const rt = [];
    for (const value of values){
        if (!rt.includes(value)) {
            rt.push(value);
        }
    }
    return rt;
}
function tryParseUrl(url) {
    try {
        return new URL(url);
    } catch  {
        return undefined;
    }
}
const FILTER_EDITOR_HTML = $1`
<form id="filter-form" autocomplete="off">
<fieldset id="filter-fieldset">
  <div id="filter-form-title" class="h6 high-emphasis-text form-row">Edit filter</div>

  <label id="filter-field-label">Filter field:</label>
  <input id="filter-field-text" type="text">
  <div id="filter-field-choice"></div>
  <div id="filter-field-options"></div>

  <div id="filter-form-help" class="body2 medium-emphasis-text">
  </div>  

  <div id="filter-form-output-row" class="form-row">
    <output id="filter-form-output"></output>
  </div>

  <div id="filter-form-buttons" class="form-rhs">
    <button id="filter-apply" type="submit">Apply</button><!-- first so it is default button on return -->
    <button id="filter-cancel">Cancel</button>
  </div>
</fieldset>
</form>
`;
const FILTER_EDITOR_CSS = r3`

    #filter-form-buttons {
        justify-self: end;
        display: flex;
        flex-direction: row-reverse;
        gap: 1rem;
    }

    #filter-field-choice {
        display: flex;
        gap: 1px;
    }

    #filter-field-options {
        display: flex;
        flex-wrap: wrap;
        gap: 1px;
    }

    #filter-field-options button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    #filter-form-help {
        grid-column: 2;
    }

    #filter-form-output-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        min-height: 2.5rem;
    }

    #filter-form-output-row output {
        flex-grow: 1;
    }

`;
function initFilterEditor(document1, vm) {
    const filterForm = document1.getElementById('filter-form');
    const filterFieldset = document1.getElementById('filter-fieldset');
    const filterFieldLabel = document1.getElementById('filter-field-label');
    const filterFieldTextInput = document1.getElementById('filter-field-text');
    const filterFieldChoiceDiv = document1.getElementById('filter-field-choice');
    const filterFieldOptionsDiv = document1.getElementById('filter-field-options');
    const filterCancelButton = document1.getElementById('filter-cancel');
    const filterApplyButton = document1.getElementById('filter-apply');
    const filterFormOutput = document1.getElementById('filter-form-output');
    const filterFormHelpDiv = document1.getElementById('filter-form-help');
    filterCancelButton.onclick = (e)=>{
        e.preventDefault();
        vm.cancelFilter();
    };
    filterApplyButton.onclick = (e)=>{
        e.preventDefault();
        const type = computeType(vm);
        if (type === 'text') {
            vm.filterForm.fieldValue = filterFieldTextInput.value;
        }
        vm.saveFilter();
    };
    return ()=>{
        const wasHidden = filterForm.style.display === 'none';
        filterForm.style.display = vm.filterForm.showing ? 'block' : 'none';
        filterFieldset.disabled = !vm.filterForm.enabled;
        const type = computeType(vm);
        filterFieldLabel.textContent = vm.filterForm.fieldName;
        filterFieldLabel.htmlFor = type == 'choice' ? filterFieldChoiceDiv.id : type == 'options' ? filterFieldOptionsDiv.id : filterFieldTextInput.id;
        filterFieldTextInput.style.display = type == 'text' ? 'block' : 'none';
        filterFieldChoiceDiv.style.display = type == 'choice' ? 'flex' : 'none';
        T1(CHOICES_HTML(vm), filterFieldChoiceDiv);
        filterFieldOptionsDiv.style.display = type == 'options' ? 'flex' : 'none';
        T1(OPTIONS_HTML(vm), filterFieldOptionsDiv);
        filterFormHelpDiv.textContent = vm.filterForm.helpText;
        filterFormOutput.textContent = vm.filterForm.outputMessage;
        if (wasHidden && vm.filterForm.showing) {
            console.log('filter form open');
            if (type === 'text' && vm.filterForm.fieldValue) filterFieldTextInput.value = vm.filterForm.fieldValue;
            setTimeout(()=>{
                filterFieldTextInput.focus();
                filterFieldTextInput.select();
            }, 0);
        }
    };
}
function computeType(vm) {
    return vm.filterForm.fieldValueChoices.length > 0 ? 'choice' : vm.filterForm.fieldValueOptions.length ? 'options' : 'text';
}
const CHOICES_HTML = (vm)=>{
    return vm.filterForm.fieldValueChoices.map((choice)=>$1`<button class="${choice.id === vm.filterForm.fieldValue ? 'selected' : ''}" @click=${(e)=>{
            e.preventDefault();
            vm.selectFilterChoice(choice.id);
        }} ?disabled="${!vm.filterForm.showing}">${choice.text}</button>`);
};
const OPTIONS_HTML = (vm)=>{
    return vm.filterForm.fieldValueOptions.map((option)=>{
        const selected = fieldValueSet(vm).has(option.id);
        return $1`<button class="${selected ? 'selected' : ''}" @click=${(e)=>{
            e.preventDefault();
            vm.toggleFilterOption(option.id);
        }} ?disabled="${!vm.filterForm.showing}">${selected ? CHECK_BOX_CHECKED_ICON : CHECK_BOX_UNCHECKED_ICON} ${option.text}</button>`;
    });
};
function fieldValueSet(vm) {
    return new Set((vm.filterForm.fieldValue || '').split(',').map((v)=>v.trim()).filter((v)=>v.length > 0));
}
const PROFILE_EDITOR_HTML = $1`
<form id="profile-form" autocomplete="off">
<fieldset id="profile-fieldset">
  <div id="profile-form-title" class="h6 high-emphasis-text form-row">Profile</div>

  <label for="profile-name">Profile name:</label>
  <input id="profile-name" type="text">

  <label for="account-id">Cloudflare Account ID:</label>
  <input id="profile-account-id" type="text">

  <label for="api-token">Cloudflare API Token:</label>
  <input id="profile-api-token" type="text">

  <details id="profile-form-help-row" class="form-row">
    <summary>Use a <a href="https://en.wikipedia.org/wiki/Principle_of_least_privilege" target="_blank">least privilege</a> token with permission: <code>Account &gt; Workers Tail &gt; Read</code></summary>
    <ol>
        <li>Select <span class="cf-button">Create Token</span> on your Cloudflare <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">API Tokens</a> page.</li>
        <li>Scroll down to <span class="cf-section">Create Custom Token</span>, then <span class="cf-button">Get started</span></li>
        <li>Under <span class="cf-section">Permissions</span>, grant your token <span class="cf-section">Account</span> <span class="cf-section">Workers Tail</span> <span class="cf-section">Read</span></li>
        <li>Also (for analytics), grant your token <span class="cf-section">Account</span> <span class="cf-section">Account Analytics</span> <span class="cf-section">Read</span></li>
        <li>Also (for DO names), grant your token <span class="cf-section">Account</span> <span class="cf-section">Worker Scripts</span> <span class="cf-section">Read</span></li>
    </ol>
  </details>  

  <div id="profile-form-output-row" class="form-row">
    <output id="profile-form-output"></output>
    <progress id="profile-form-progress" class="pure-material-progress-circular"></progress>
  </div>

  <div class="form-lhs">
    <button id="profile-delete">Delete</button>
  </div>
  <div id="profile-form-buttons" class="form-rhs">
    <button id="profile-cancel">Cancel</button>
    <button id="profile-save">Save</button>
  </div>
</fieldset>
</form>
`;
const PROFILE_EDITOR_CSS = r3`

    #profile-form-buttons {
        justify-self: end;
        display: flex;
        gap: 1rem;
    }

    #profile-form-help-row {
        cursor: pointer;
    }

    #profile-form-help-row summary {
        user-select: none; -webkit-user-select: none;
    }

    #profile-form-help-row ol {
        cursor: default;
    }

    #profile-form-help-row li {
        padding: 0.5rem 0;
    }

    .cf-button {
        display: inline-block;
        background-color: blue;
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .cf-section {
        display: inline-block;
        background-color: white;
        color: black;
        padding: 0.25rem 0.5rem;
        outline: solid 1px gray;
    }

    #profile-form-output-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        min-height: 2.5rem;
    }

    #profile-form-output-row output {
        flex-grow: 1;
    }

    #profile-form-progress {
        font-size: 0.5rem; /* default 3em => 1.5rem */
    }

`;
function initProfileEditor(document1, vm) {
    const profileForm = document1.getElementById('profile-form');
    const profileFormTitleDiv = document1.getElementById('profile-form-title');
    const profileFieldset = document1.getElementById('profile-fieldset');
    const profileNameInput = document1.getElementById('profile-name');
    const profileAccountIdInput = document1.getElementById('profile-account-id');
    const profileApiTokenInput = document1.getElementById('profile-api-token');
    const profileDeleteButton = document1.getElementById('profile-delete');
    const profileCancelButton = document1.getElementById('profile-cancel');
    const profileSaveButton = document1.getElementById('profile-save');
    const profileFormProgress = document1.getElementById('profile-form-progress');
    const profileFormOutput = document1.getElementById('profile-form-output');
    const profileFormHelpDetails = document1.getElementById('profile-form-help-row');
    profileCancelButton.onclick = (e)=>{
        e.preventDefault();
        vm.cancelProfile();
    };
    profileNameInput.oninput = ()=>{
        vm.setProfileName(profileNameInput.value);
    };
    profileAccountIdInput.oninput = ()=>{
        vm.setProfileAccountId(profileAccountIdInput.value);
    };
    profileApiTokenInput.oninput = ()=>{
        vm.setProfileApiToken(profileApiTokenInput.value);
    };
    profileSaveButton.onclick = (e)=>{
        e.preventDefault();
        vm.saveProfile();
    };
    profileDeleteButton.onclick = (e)=>{
        e.preventDefault();
        vm.deleteProfile(vm.profileForm.profileId);
    };
    return ()=>{
        const wasHidden = profileForm.style.display === 'none';
        profileForm.style.display = vm.profileForm.showing ? 'block' : 'none';
        profileFieldset.disabled = !vm.profileForm.enabled;
        profileFormTitleDiv.textContent = vm.profileForm.title;
        profileNameInput.value = vm.profileForm.name;
        profileAccountIdInput.value = vm.profileForm.accountId;
        profileApiTokenInput.value = vm.profileForm.apiToken;
        profileDeleteButton.style.display = vm.profileForm.deleteVisible ? 'inline-block' : 'none';
        profileSaveButton.disabled = !vm.profileForm.saveEnabled;
        profileFormProgress.style.display = vm.profileForm.progressVisible ? 'block' : 'none';
        profileFormOutput.textContent = vm.profileForm.outputMessage;
        if (wasHidden && vm.profileForm.showing) {
            const initialDetailsOpen = vm.realProfiles.length === 0;
            profileFormHelpDetails.open = initialDetailsOpen;
            setTimeout(()=>{
                profileNameInput.focus();
                profileNameInput.select();
            }, 0);
        }
    };
}
const WELCOME_PANEL_HTML = $1`
<form id="welcome-panel" autocomplete="off">
<fieldset id="welcome-panel-fieldset">
  <div id="welcome-panel-form-title" class="h6 high-emphasis-text form-row">title</div>

  <div class="form-row body2 medium-emphasis-text">
    Welcome to <span class="high-emphasis-text">Webtail for Cloudflare Workers</span>!
    <p>View live requests and logs from <a href="https://workers.cloudflare.com/" target="_blank">Cloudflare Workers</a> from the comfort of your browser. 
    A few enhancements over what's provided <a href="https://blog.cloudflare.com/introducing-workers-dashboard-logs/" target="_blank">by default</a> in the Cloudflare dashboard:</p>
    <ul>
        <li>Tail multiple workers at the same time</li>
        <li>Advanced filtering and multi-color output similar to <a href="https://developers.cloudflare.com/workers/cli-wrangler/commands#tail" target="_blank">wrangler tail</a></li>
        <li>Durable object class/name/id and colo information can be surfaced with <a href="https://denoflare.dev/examples/webtail#logprops" target="_blank">logprops</a></li>
        <li>Multiple profiles, switch easily between multiple accounts</li>
        <li>No need to log in with your full Cloudflare credentials.  Profiles are stored locally in the browser, and can be permissioned only for tailing workers</li>
        <li>Implemented as <a href="https://github.com/skymethod/denoflare/tree/master/examples/webtail-worker" target="_blank">an open-source Cloudflare Worker</a>, 
           <a href="https://denoflare.dev/examples/webtail#deploy-it-to-your-own-account" target="_blank">deploy it to your own account</a>, 
            or <a href="https://denoflare.dev/examples/webtail#host-it-locally" target="_blank">host it locally</a> with <a href="https://github.com/skymethod/denoflare" target="_blank"><code>denoflare</code></a></li>
    </ul>
    <p id="welcome-panel-trailer">Create a new profile to get started!</p>
    <p id="about-panel-trailer">Head over to the <a href="https://github.com/skymethod/denoflare" target="_blank">Denoflare GitHub repo</a> to request features, report bugs, or check out the code!</p>
  </div>

  <div class="form-rhs">
    <button id="welcome-panel-new-profile" type="submit">New profile</button>
    <button id="welcome-panel-close" type="submit">Close</button>
  </div>
</fieldset>
</form>
`;
const WELCOME_PANEL_CSS = r3`

    #welcome-panel-form-title {
        user-select: none; -webkit-user-select: none;
    }

`;
function initWelcomePanel(document1, vm) {
    const welcomePanelElement = document1.getElementById('welcome-panel');
    const titleElement = document1.getElementById('welcome-panel-form-title');
    const welcomeTrailerElement = document1.getElementById('welcome-panel-trailer');
    const aboutTrailerElement = document1.getElementById('about-panel-trailer');
    const newProfileButton = document1.getElementById('welcome-panel-new-profile');
    const closeButton = document1.getElementById('welcome-panel-close');
    newProfileButton.onclick = (e)=>{
        e.preventDefault();
        vm.newProfile();
    };
    closeButton.onclick = (e)=>{
        e.preventDefault();
        vm.closeAbout();
    };
    return ()=>{
        const wasHidden = welcomePanelElement.style.display === 'none';
        const show = vm.welcomeShowing && !vm.profileForm.showing || vm.aboutShowing;
        welcomePanelElement.style.display = show ? 'block' : 'none';
        const welcome = vm.welcomeShowing;
        titleElement.textContent = welcome ? 'Hello 👋' : 'About';
        welcomeTrailerElement.style.display = welcome ? 'block' : 'none';
        aboutTrailerElement.style.display = welcome ? 'none' : 'block';
        newProfileButton.style.display = welcome ? 'block' : 'none';
        closeButton.style.display = welcome ? 'none' : 'block';
        if (wasHidden && show) {
            console.log(`${welcome ? 'welcome' : 'about'} panel open`);
            setTimeout(()=>{
                (welcome ? newProfileButton : closeButton).focus();
            }, 0);
        }
    };
}
const MODAL_HTML = $1`
<div id="modal" class="modal hidden-vertical-scroll">
    <div class="modal-content">
    ${WELCOME_PANEL_HTML}
    ${PROFILE_EDITOR_HTML}
    ${FILTER_EDITOR_HTML}
    </div>
</div>
`;
const MODAL_CSS = r3`
.modal {
    display: none;
    position: fixed;
    z-index: 1;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.4);
}

.modal-content {
    margin: 10% auto;
    width: 80%;
    max-width: 40rem;
    background-color: var(--background-color);
}

@media screen and (max-width: 600px) {
    .modal-content {
        margin: 10% 0;
        width: 100%;
    }
}

`;
function initModal(document1, vm) {
    const modal = document1.getElementById('modal');
    const updateProfileEditor = initProfileEditor(document1, vm);
    const updateFilterEditor = initFilterEditor(document1, vm);
    const updateWelcomePanel = initWelcomePanel(document1, vm);
    const closeModal = ()=>{
        if (!vm.profileForm.showing && !vm.filterForm.showing && !vm.welcomeShowing && !vm.aboutShowing) return;
        if (vm.profileForm.progressVisible) return;
        vm.profileForm.showing = false;
        vm.filterForm.showing = false;
        vm.aboutShowing = false;
        vm.onChange();
    };
    window.addEventListener('click', (event)=>{
        if (event.target == modal) {
            closeModal();
        }
    });
    document1.addEventListener('keydown', (event)=>{
        event = event || window.event;
        if (event.key === 'Escape') {
            closeModal();
        }
    });
    return ()=>{
        updateProfileEditor();
        updateFilterEditor();
        updateWelcomePanel();
        modal.style.display = vm.profileForm.showing || vm.filterForm.showing || vm.welcomeShowing || vm.aboutShowing ? 'block' : 'none';
    };
}
const CIRCULAR_PROGRESS_CSS = r3`
.pure-material-progress-circular {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    box-sizing: border-box;
    border: none;
    border-radius: 50%;
    padding: 0.25em;
    width: 3em;
    height: 3em;
    color: var(--pure-material-primary-rgb, rgb(33, 150, 243));
    background-color: transparent;
    font-size: 16px;
    overflow: hidden;
}

.pure-material-progress-circular::-webkit-progress-bar {
    background-color: transparent;
}

/* Indeterminate */
.pure-material-progress-circular:indeterminate {
    -webkit-mask-image: linear-gradient(transparent 50%, black 50%), linear-gradient(to right, transparent 50%, black 50%);
    mask-image: linear-gradient(transparent 50%, black 50%), linear-gradient(to right, transparent 50%, black 50%);
    animation: pure-material-progress-circular 6s infinite cubic-bezier(0.3, 0.6, 1, 1);
}

:-ms-lang(x), .pure-material-progress-circular:indeterminate {
    animation: none;
}

.pure-material-progress-circular:indeterminate::before,
.pure-material-progress-circular:indeterminate::-webkit-progress-value {
    content: "";
    display: block;
    box-sizing: border-box;
    margin-bottom: 0.25em;
    border: solid 0.25em transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    width: 100% !important;
    height: 100%;
    background-color: transparent;
    animation: pure-material-progress-circular-pseudo 0.75s infinite linear alternate;
}

.pure-material-progress-circular:indeterminate::-moz-progress-bar {
    box-sizing: border-box;
    border: solid 0.25em transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    width: 100%;
    height: 100%;
    background-color: transparent;
    animation: pure-material-progress-circular-pseudo 0.75s infinite linear alternate;
}

.pure-material-progress-circular:indeterminate::-ms-fill {
    animation-name: -ms-ring;
}

@keyframes pure-material-progress-circular {
    0% {
        transform: rotate(0deg);
    }
    12.5% {
        transform: rotate(180deg);
        animation-timing-function: linear;
    }
    25% {
        transform: rotate(630deg);
    }
    37.5% {
        transform: rotate(810deg);
        animation-timing-function: linear;
    }
    50% {
        transform: rotate(1260deg);
    }
    62.5% {
        transform: rotate(1440deg);
        animation-timing-function: linear;
    }
    75% {
        transform: rotate(1890deg);
    }
    87.5% {
        transform: rotate(2070deg);
        animation-timing-function: linear;
    }
    100% {
        transform: rotate(2520deg);
    }
}

@keyframes pure-material-progress-circular-pseudo {
    0% {
        transform: rotate(-30deg);
    }
    29.4% {
        border-left-color: transparent;
    }
    29.41% {
        border-left-color: currentColor;
    }
    64.7% {
        border-bottom-color: transparent;
    }
    64.71% {
        border-bottom-color: currentColor;
    }
    100% {
        border-left-color: currentColor;
        border-bottom-color: currentColor;
        transform: rotate(225deg);
    }
}
`;
const CONSOLE_HTML = $1`
<div id="console">
    <div id="console-header">
        <div id="console-header-filters" class="body2"></div>
        <div id="console-header-status">
            <div id="console-header-tails" class="overline medium-emphasis-text"></div>
            <div id="console-header-qps" class="overline medium-emphasis-text"></div>
            <div id="console-header-clear"></div>
        </div>
    </div>
    <code id="console-last-line" class="line">spacer</code>
</div>
`;
const CONSOLE_CSS = r3`

#console {
    color: var(--high-emphasis-text-color);
    height: 100vh;
    width: 100%;
    background-color: var(--background-color);
    overflow-y: scroll;
    overflow-x: hidden;
    flex-grow: 1;
}

#console::-webkit-scrollbar {
    width: 1rem;
    height: 3rem;
    background-color: var(--background-color);
}

#console::-webkit-scrollbar-thumb {
    background-color: var(--medium-emphasis-text-color);
}

#console-header {
    position: sticky;
    top: 0;
    height: 3.75rem;
    background-color: var(--background-color);
    display: flex;
    padding: 1.25rem 1rem 1rem 0;
}

#console-header-filters {
    flex-grow: 1;
    color: var(--medium-emphasis-text-color);
    font-family: var(--sans-serif-font-family);

    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;  
    overflow: hidden;
}

#console-header-status {
    height: 1rem;
    display: flex;
    flex-direction: column;
    min-width: 6rem;
    text-align: right;
    padding-top: 0.25rem;
    user-select: none; -webkit-user-select: none;
}

#console-header-tails {
    white-space: nowrap;
}

#console-header-clear {
    margin-right: -0.5rem;
    margin-left: 1rem;
    visibility: hidden;
}

#console-header-clear .action-icon {
    padding-right: 0.5rem;
    padding-left: 0.5rem;
}

#console .line {
    display: block;
    font-size: 0.75rem; /* 12px */
    line-height: 1.1rem;
    font-family: var(--monospace-font-family);
    white-space: pre-wrap;
}

#console-last-line {
    visibility: hidden;
}

`;
function initConsole(document1, vm) {
    const consoleDiv = document1.getElementById('console');
    const consoleHeaderFiltersDiv = document1.getElementById('console-header-filters');
    const consoleHeaderTailsElement = document1.getElementById('console-header-tails');
    const consoleHeaderQpsElement = document1.getElementById('console-header-qps');
    const consoleHeaderClearElement = document1.getElementById('console-header-clear');
    const consoleLastLineElement = document1.getElementById('console-last-line');
    let showingClearButton = false;
    vm.logger = (...data)=>{
        const lineElement = document1.createElement('code');
        lineElement.className = 'line';
        let pos = 0;
        while(pos < data.length){
            if (pos > 0) {
                lineElement.appendChild(document1.createTextNode(', '));
            }
            const msg = data[pos];
            if (typeof msg === 'string') {
                const tokens = msg.split('%c');
                for(let i = 0; i < tokens.length; i++){
                    const span = document1.createElement('span');
                    let rendered = false;
                    if (i > 0 && i < tokens.length - 1) {
                        const style = data[pos + i];
                        span.setAttribute('style', style);
                        if (typeof style === 'string') {
                            if (style.includes('x-')) {
                                const m = /x-durable-object-(class|name|id)\s*:\s*'(.*?)'/.exec(style);
                                if (m) {
                                    const type = m[1];
                                    const value = m[2];
                                    const logpropName = 'durableObject' + type.substring(0, 1).toUpperCase() + type.substring(1);
                                    const a = document1.createElement('a');
                                    a.href = '#';
                                    a.onclick = ()=>{
                                        vm.setLogpropFilter([
                                            logpropName + ':' + value
                                        ]);
                                        vm.onChange();
                                    };
                                    a.appendChild(document1.createTextNode(tokens[i]));
                                    span.appendChild(a);
                                    rendered = true;
                                }
                            }
                        }
                    }
                    if (!rendered) renderTextIntoSpan(tokens[i], span);
                    lineElement.appendChild(span);
                }
                pos += 1 + tokens.length - 1;
            } else {
                lineElement.appendChild(document1.createTextNode(JSON.stringify(msg)));
                pos++;
            }
        }
        consoleDiv.insertBefore(lineElement, consoleLastLineElement);
        const { scrollHeight, scrollTop, clientHeight } = consoleDiv;
        const diff = scrollHeight - scrollTop;
        const autoscroll = diff - 16 * 4 <= clientHeight;
        if (autoscroll) {
            consoleLastLineElement.scrollIntoView(false);
        }
        if (!showingClearButton) {
            consoleHeaderClearElement.style.visibility = 'visible';
            showingClearButton = true;
        }
    };
    vm.onResetOutput = ()=>{
        const lines = consoleDiv.querySelectorAll('.line');
        lines.forEach((line)=>{
            if (line.id !== 'console-last-line') consoleDiv.removeChild(line);
        });
        consoleHeaderClearElement.style.visibility = 'hidden';
        showingClearButton = false;
    };
    consoleHeaderQpsElement.textContent = computeQpsText(0);
    vm.onQpsChange = (qps)=>{
        consoleHeaderQpsElement.textContent = computeQpsText(qps);
    };
    T1(actionIcon(CLEAR_ICON, {
        text: 'Clear',
        onclick: ()=>vm.resetOutput()
    }), consoleHeaderClearElement);
    return ()=>{
        consoleDiv.style.display = vm.selectedAnalyticId ? 'none' : 'block';
        consoleHeaderFiltersDiv.style.visibility = vm.profiles.length > 0 ? 'visible' : 'hidden';
        consoleHeaderTailsElement.textContent = computeTailsText(vm.tails.size);
        T1(FILTERS_HTML(vm), consoleHeaderFiltersDiv);
    };
}
const FILTERS_HTML = (vm)=>{
    return $1`Showing <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editSelectionFields();
    }}>${vm.computeSelectionFieldsText()}</a>
     for <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editEventFilter();
    }}>${computeEventFilterText(vm.filter)}</a>
     with <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editStatusFilter();
    }}>${computeStatusFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editIpAddressFilter();
    }}>${computeIpAddressFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editMethodFilter();
    }}>${computeMethodFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editSamplingRateFilter();
    }}>${computeSamplingRateFilterText(vm.filter)}</a>, 
     <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editSearchFilter();
    }}>${computeSearchFilterText(vm.filter)}</a>, 
    <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editHeaderFilter();
    }}>${computeHeaderFilterText(vm.filter)}</a>,
     and <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editLogpropFilter();
    }}>${computeLogpropFilterText(vm.filter)}</a>.
     ${vm.hasAnyFilters() ? $1`(<a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.resetFilters();
    }}>reset</a>)` : ''}`;
};
function computeEventFilterText(filter) {
    const { event1 } = filter;
    return event1 === 'cron' ? 'CRON trigger events' : event1 === 'http' ? 'HTTP request events' : 'all events';
}
function computeStatusFilterText(filter) {
    const { status1 } = filter;
    return status1 === 'error' ? 'error status' : status1 === 'success' ? 'success status' : 'any status';
}
function computeIpAddressFilterText(filter) {
    const ipAddress1 = filter.ipAddress1 || [];
    return ipAddress1.length === 0 ? 'any IP address' : ipAddress1.length === 1 ? `IP address of ${ipAddress1[0]}` : `IP address in [${ipAddress1.join(', ')}]`;
}
function computeMethodFilterText(filter) {
    const method1 = filter.method1 || [];
    return method1.length === 0 ? 'any method' : method1.length === 1 ? `method of ${method1[0]}` : `method in [${method1.join(', ')}]`;
}
function computeSamplingRateFilterText(filter) {
    const samplingRate1 = typeof filter.samplingRate1 === 'number' ? filter.samplingRate1 : 1;
    return samplingRate1 >= 1 ? 'no sampling' : `${(Math.max(0, samplingRate1) * 100).toFixed(2)}% sampling rate`;
}
function computeSearchFilterText(filter) {
    const { search1 } = filter;
    return typeof search1 === 'string' && search1.length > 0 ? `console logs containing "${search1}"` : 'no search filter';
}
function computeHeaderFilterText(filter) {
    const header1 = filter.header1 || [];
    return header1.length === 0 ? 'no header filter' : header1.length === 1 ? `header filter of ${header1[0]}` : `header filters of [${header1.join(', ')}]`;
}
function computeLogpropFilterText(filter) {
    const logprop1 = filter.logprop1 || [];
    return logprop1.length === 0 ? 'no logprop filter' : logprop1.length === 1 ? `logprop filter of ${logprop1[0]}` : `logprop filters of [${logprop1.join(', ')}]`;
}
function computeTailsText(tailCount) {
    return tailCount === 0 ? 'no tails' : tailCount === 1 ? '1 tail' : `${tailCount} tails`;
}
function computeQpsText(qps) {
    return `${qps.toFixed(2)} qps`;
}
function renderTextIntoSpan(text, span) {
    const pattern = /(https:\/\/[^\s)]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[\d0-f]+(:([\d0-f]{0,4})?){5,7})/g;
    let m;
    let i = 0;
    while(null !== (m = pattern.exec(text))){
        if (m.index > i) {
            span.appendChild(document.createTextNode(text.substring(i, m.index)));
        }
        const urlOrIp = m[0];
        const a = document.createElement('a');
        a.href = urlOrIp.startsWith('https://') ? urlOrIp : `https://ipinfo.io/${urlOrIp}`;
        a.target = '_blank';
        a.rel = 'noreferrer noopener nofollow';
        a.appendChild(document.createTextNode(urlOrIp));
        span.appendChild(a);
        i = m.index + urlOrIp.length;
    }
    if (i < text.length) {
        span.appendChild(document.createTextNode(text.substring(i)));
    }
}
const ANALYTICS_HTML1 = $1`
<div id="analytics">
    <div id="analytics-header">
        <div id="analytics-heading" class="h6 high-emphasis-text"></div>
        <div id="analytics-subheading" class="medium-emphasis-text"></div>
    </div>
    <div id="analytics-querying"><progress id="analytics-progress" class="pure-material-progress-circular"></progress><div class="medium-emphasis-text">Fetching analytics...</div></div>
    <div id="analytics-error" class="medium-emphasis-text"></div>
    <div id="analytics-table" class="medium-emphasis-text"></div>
    <div id="analytics-namespaces-table"  class="medium-emphasis-text"></div>
    <div id="analytics-footnote" class="medium-emphasis-text"><sup>*</sup> Estimated based on recent usage</div>
</div>
`;
const ANALYTICS_CSS = r3`

#analytics {
    color: var(--high-emphasis-text-color);
    height: 100vh;
    width: 100%;
    background-color: var(--background-color);
    overflow-y: scroll;
    overflow-x: hidden;
    flex-grow: 1;
    display: none;
}

#analytics::-webkit-scrollbar {
    width: 1rem;
    height: 3rem;
    background-color: var(--background-color);
}

#analytics::-webkit-scrollbar-thumb {
    background-color: var(--medium-emphasis-text-color);
}

#analytics-header {
    position: sticky;
    top: 0;
    background-color: var(--background-color);
    padding: 1rem 0;
    height: 3rem;
}

#analytics-subheading {
    padding: 0.5rem 0;
}

#analytics-progress {
    font-size: 0.5rem; /* default 3em => 1.5rem */
}

#analytics-querying {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

#analytics table {
    text-align: right;
    border-spacing: 0.375rem;
    font-size: 0.75rem;
    white-space: nowrap;
}

#analytics th {
    text-align: center;
}

#analytics .spacer {
    width: 0.75rem;
}

#analytics-table .estimate td {
    padding-top: 1rem;
}

#analytics .mono {
    font-family: var(--monospace-font-family);
}

#analytics-namespaces-table {
    margin-top: 2rem;
}

#analytics-namespaces-table a.unselected {
    color: var(--medium-emphasis-text-color);
}

@media (hover: hover) {
    #analytics-namespaces-table a.unselected:hover {
        color: var(--primary-color);
    }
}

#analytics .left-aligned {
    text-align: left;
}

#analytics-footnote {
    margin-top: 1rem;
    font-size: 0.75rem;
    display: none;
}

`;
function initAnalytics(document1, vm) {
    const analyticsDiv = document1.getElementById('analytics');
    const analyticsHeading = document1.getElementById('analytics-heading');
    const analyticsSubheading = document1.getElementById('analytics-subheading');
    const analyticsQueryingElement = document1.getElementById('analytics-querying');
    const analyticsErrorElement = document1.getElementById('analytics-error');
    const analyticsTableElement = document1.getElementById('analytics-table');
    const analyticsNamespacesTableElement = document1.getElementById('analytics-namespaces-table');
    const analyticsFootnoteElement = document1.getElementById('analytics-footnote');
    return ()=>{
        analyticsDiv.style.display = vm.selectedAnalyticId ? 'block' : 'none';
        if (!vm.selectedAnalyticId) return;
        const selectedAnalytic = vm.analytics.find((v)=>v.id === vm.selectedAnalyticId);
        if (!selectedAnalytic) return;
        analyticsHeading.textContent = selectedAnalytic.text;
        analyticsSubheading.textContent = selectedAnalytic.description || '';
        const { durableObjectsCosts, querying, error } = vm.analyticsState;
        analyticsQueryingElement.style.display = querying ? 'flex' : 'none';
        analyticsErrorElement.textContent = error || '';
        analyticsFootnoteElement.style.display = durableObjectsCosts ? 'block' : 'none';
        if (durableObjectsCosts) {
            const renderCosts = (namespaceId)=>{
                const table = durableObjectsCosts.namespaceTables[namespaceId || ''] || durableObjectsCosts.accountTable;
                T1(COSTS_HTML(table, namespaceId), analyticsTableElement);
            };
            renderCosts(undefined);
            T1(NAMESPACES_HTML(durableObjectsCosts, renderCosts), analyticsNamespacesTableElement);
        } else {
            T1(undefined, analyticsTableElement);
            T1(undefined, analyticsNamespacesTableElement);
        }
    };
}
const FIXED_1 = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
});
const FIXED_2 = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
});
function format1(val) {
    if (val < 1000) return val.toString();
    return `${FIXED_1.format(val / 1000)}k`;
}
function format2(val) {
    if (val < 1000) return val.toFixed(2);
    return `${FIXED_2.format(val / 1000)}k`;
}
function formatGb(val) {
    if (val < 1) return `${format2(val * 1024)}mb`;
    return `${format2(val)}gb`;
}
function clickNamespace(e, renderCosts) {
    e.preventDefault();
    const text = e.target.textContent || '';
    console.log('clickNamespace', text);
    renderCosts(text.startsWith('All') ? undefined : text);
    const anchors = document.querySelectorAll('#analytics-namespaces-table a');
    anchors.forEach((a)=>{
        a.className = a === e.target ? '' : 'unselected';
    });
}
const NAMESPACES_HTML = (table, renderCosts)=>$1`
    <table>
        <tr>
            <th>Namespace ID</th><th class="spacer"></th>
            <th>Script</th>
            <th>Class</th><th class="spacer"></th>
            <th>Total</th>
        </tr>
        <tr>
            <td class="left-aligned mono"><a href="#" @click=${(e)=>clickNamespace(e, renderCosts)}>All durable objects</a></td><td></td>
            <td></td>
            <td></td><td></td>
            <td>$${(table.accountTable.estimated30DayRow?.totalCost || 0).toFixed(2)}</td>
        </tr>
    ${[
        ...Object.entries(table.namespaceTables)
    ].sort((a, b)=>(b[1].estimated30DayRow?.totalCost || 0) - (a[1].estimated30DayRow?.totalCost || 0)).map((v)=>{
        const [namespaceId, t] = v;
        return $1`<tr>
            <td class="left-aligned mono"><a href="#" @click=${(e)=>clickNamespace(e, renderCosts)} class="unselected">${namespaceId}</a></td><td></td>
            <td class="left-aligned">${t.namespace?.script || ''}</td>
            <td class="left-aligned">${t.namespace?.class || ''}</td><td></td>
            <td>$${(t.estimated30DayRow?.totalCost || 0).toFixed(2)}</td>
            </tr>`;
    })}
    </table>
`;
const COSTS_HTML = (table, _namespaceId)=>$1`
    <table>
        <tr>
            <th>UTC Day</th><th class="spacer"></th>
            <th colspan="2">Requests</th><th class="spacer"></th>
            <th colspan="4">Websockets</th><th class="spacer"></th>
            <th colspan="2">Subrequests</th><th class="spacer"></th>
            <th colspan="2">Duration</th><th class="spacer"></th>
            <th colspan="2">Reads</th><th class="spacer"></th>
            <th colspan="2">Writes</th><th class="spacer"></th>
            <th colspan="2">Deletes</th><th class="spacer"></th>
            <th colspan="2">Storage</th><th class="spacer"></th>
            <th>Total</th>
        </tr>
        <tr>
            <th></th><th></th>
            <th colspan="2"></th><th></th>
            <th>Max</th>
            <th>In</th>
            <th>Out</th>
            <th></th><th></th>
            <th colspan="2"></th><th></th>
            <th>GB-sec</th>
            <th></th><th></th>
            <th colspan="2"></th><th></th>
            <th colspan="2"></th><th></th>
            <th colspan="2"></th><th></th>
            <th colspan="2"></th><th></th>
            <th></th>
        </tr>
        ${table.rows.map((v)=>$1`<tr>
            <td>${v.date}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumRequests)}</td>
            <td>$${format2(v.requestsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.maxActiveWebsocketConnections)}</td>
            <td class="high-emphasis-text">${format1(v.sumInboundWebsocketMsgCount)}</td>
            <td class="high-emphasis-text">${format1(v.sumOutboundWebsocketMsgCount)}</td>
            <td>$${format2(v.websocketsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumSubrequests)}</td>
            <td>$${format2(v.subrequestsCost)}</td><td></td>
            <td class="high-emphasis-text">${format2(v.activeGbSeconds)}</td>
            <td>$${format2(v.activeCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumStorageReadUnits)}</td>
            <td>$${format2(v.readUnitsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumStorageWriteUnits)}</td>
            <td>$${format2(v.writeUnitsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumStorageDeletes)}</td>
            <td>$${format2(v.deletesCost)}</td><td></td>
            <td class="high-emphasis-text">${v.storageGb === undefined ? '?' : formatGb(v.storageGb)}</td>
            <td>${v.storageCost === undefined ? '' : `$${format2(v.storageCost)}`}</td><td></td>
            <td>$${format2(v.totalCost)}</td>
        </tr>`)}

        ${table.estimated30DayRow ? $1`<tr class="estimate">
            <td>30-day bill<sup>*</sup></td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.requestsCost)}</td><td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.websocketsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.subrequestsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.activeCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.readUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.writeUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.deletesCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.storageCost || 0)}</td><td></td>
            <td>$${format2(table.estimated30DayRow.totalCost)}</td>
        </tr>` : ''}
        ${table.estimated30DayRowMinusFree ? $1`<tr>
            <td>− free usage</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.requestsCost)}</td><td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.websocketsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.subrequestsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.activeCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.readUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.writeUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.deletesCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.storageCost || 0)}</td><td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.totalCost)}</td>
        </tr>` : ''}
    </table>
`;
const appModuleScript = document.getElementById('app-module-script');
function setAppState(appState) {
    appModuleScript.dataset.state = appState;
}
setAppState('starting');
const appCss = r3`

main {
    display: flex;
    gap: 0.5rem;
}

:root {
    --pure-material-primary-rgb: rgb(187, 134, 252);
}

.hidden-vertical-scroll {
    scrollbar-width: none; -ms-overflow-style: none;
    overflow-y: scroll;
}

.hidden-vertical-scroll::-webkit-scrollbar {
    display: none; /* for Chrome, Safari, and Opera */
}

`;
const appHtml = $1`
<main>
${SIDEBAR_HTML}
${CONSOLE_HTML}
${ANALYTICS_HTML1}
${MODAL_HTML}
</main>`;
function appendStylesheets(cssTexts) {
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.textContent = cssTexts.join('\n\n');
    document.head.appendChild(styleSheet);
}
appendStylesheets([
    MATERIAL_CSS.cssText,
    appCss.cssText,
    HEADER_CSS.cssText,
    SIDEBAR_CSS.cssText,
    CONSOLE_CSS.cssText,
    ANALYTICS_CSS.cssText,
    MODAL_CSS.cssText,
    WELCOME_PANEL_CSS.cssText,
    PROFILE_EDITOR_CSS.cssText,
    FILTER_EDITOR_CSS.cssText,
    CIRCULAR_PROGRESS_CSS.cssText
]);
T1(appHtml, document.body);
function parseStaticData() {
    const script = document.getElementById('static-data-script');
    const data = JSON.parse(script.text);
    const version = typeof data.version === 'string' ? data.version : undefined;
    const flags = typeof data.flags === 'string' ? data.flags : undefined;
    return {
        version,
        flags
    };
}
const data = parseStaticData();
const vm = new WebtailAppVM();
const updateSidebar = initSidebar(document, vm, data);
const updateConsole = initConsole(document, vm);
const updateAnalytics = initAnalytics(document, vm);
const updateModal = initModal(document, vm);
vm.onChange = ()=>{
    updateSidebar();
    updateConsole();
    updateAnalytics();
    updateModal();
};
CloudflareApi.URL_TRANSFORMER = CfGqlClient.URL_TRANSFORMER = (v)=>`/fetch/${v.substring('https://'.length)}`;
vm.start();
setAppState('started');
