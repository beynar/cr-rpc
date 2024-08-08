'use strict';

var c = require('devalue');

function _interopNamespace(e) {
	if (e && e.__esModule) return e;
	var n = Object.create(null);
	if (e) {
		Object.keys(e).forEach(function (k) {
			if (k !== 'default') {
				var d = Object.getOwnPropertyDescriptor(e, k);
				Object.defineProperty(n, k, d.get ? d : {
					enumerable: true,
					get: function () { return e[k]; }
				});
			}
		});
	}
	n.default = e;
	return Object.freeze(n);
}

var c__namespace = /*#__PURE__*/_interopNamespace(c);

var w=e=>{try{return typeof e!="string"?e:JSON.parse(e)}catch{return e}},x=(e,t="input")=>{let a=0,i=new FormData,n=c__namespace.stringify({[t]:e},{File:o=>{if(o instanceof File){let s=`#FILE_${a}_FILE#`;return i.set(s,o),a++,s}}});return i.set(t,n),i},b=(e,t="input")=>c__namespace.parse(e.get(t),{File:a=>e.get(a)})[t];var F=(e,t)=>new Proxy(()=>{},{get(i,n){if(typeof n=="string")return F(e,[...t,n])},apply(i,n,o){return e({path:t,args:o})}}),P=({endpoint:e="/api",headers:t,fetch:a=fetch,onError:i=()=>{}}={endpoint:"/api",onError:()=>{}})=>F(async({path:n,args:o})=>{let s="POST",m=n[n.length-1];return new Set(["get","put","delete","update","patch"]).has(m)&&(n.pop(),s=m.toUpperCase()),a(`${e}/${n.join("/")}`,{method:"POST",body:s==="GET"?void 0:x(o[0]),headers:Object.assign({"x-wrpc-client":"true"},typeof t=="function"?await t({path:n.join("/"),input:o[0]}):t)}).then(async r=>{if(console.log(r.headers.get("content-type"),r.headers.get("content-type")==='multipart/form-data; boundary="abcd"'),r.headers.get("content-type")==="text/event-stream"){let l=r.body.getReader(),p=new TextDecoder,y="",f=!0,v=(u,d)=>{if(d)return;let g=(y+u).split(`
`);y=g.pop(),g.forEach((h,I)=>{f&&I===0&&h===""||(o[1]({chunk:w(h),first:f}),f=!1);});};for(;;){let{done:u,value:d}=await l.read();if(u)break;v(p.decode(d),u);}}else if(r.headers.get("content-type")?.includes("multipart/form-data")){let l=await r.formData(),p=b(l,"result");if(r.ok)return p;i(p);}else {if(r.headers.get("content-disposition")?.includes("filename"))return new File([await r.arrayBuffer()],r.headers.get("content-disposition")?.split("filename=")[1]||"file");console.log(r.headers.get("content-type"));}})},[]);var E=P({endpoint:"https://example.com/api/"});

exports.api = E;
//# sourceMappingURL=out.js.map
//# sourceMappingURL=api.js.map