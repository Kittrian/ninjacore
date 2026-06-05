import { g as l, h as n, i as s, p as o, u as z, t as U, c as f, r as k, e as J, k as N, m as b, j as r, F as g, v as Y, x as C, w as V, l as q, n as G, q as W, y as Q, T as H, a as K, d as X } from "./index-WOJTja2Z.js";
const Z = {
    id: "print-error-modal",
    class: "modal-dialog"
}
    , ee = {
        __name: "PrintErrorModal",
        emits: ["close-modal"],
        setup(I, { emit: h }) {
            const x = h
                , w = () => {
                    x("close-modal", !0)
                }
                ;
            return (B, a) => (n(),
                l("div", Z, [s("div", {
                    class: "modal-content"
                }, [s("div", {
                    class: "modal-body"
                }, [a[2] || (a[2] = s("p", null, [o(" There was an issue with printing your 3b report. Please click "), s("a", {
                    href: "/member/credit-report/3b/"
                }, "here"), o(" to switch to your report's classic view and try printing again. ")], -1)), s("div", {
                    class: "d-flex justify-content-end mt-5"
                }, [a[1] || (a[1] = s("a", {
                    class: "btn btn-primary mx-3",
                    href: "/member/credit-report/3b/"
                }, [s("small", null, "Classic View")], -1)), s("button", {
                    type: "button",
                    class: "btn btn-outline",
                    onClick: w
                }, a[0] || (a[0] = [s("small", null, "Cancel Print", -1)]))])])])]))
        }
    }
    , te = "data:image/svg+xml,%3csvg%20height='21.568'%20viewBox='0%200%2021.568%2021.568'%20width='21.568'%20xmlns='http://www.w3.org/2000/svg'%3e%3ccircle%20cx='10.5'%20cy='11.284'%20fill='%23fff'%20r='7.5'/%3e%3cpath%20d='m22.13%2011.346a10.784%2010.784%200%201%201%20-10.784-10.783%2010.783%2010.783%200%200%201%2010.784%2010.783zm-10.784%202.175a2%202%200%201%200%202%202%202%202%200%200%200%20-2-2zm-1.9-7.19.323%205.914a.522.522%200%200%200%20.521.493h2.11a.522.522%200%200%200%20.521-.493l.323-5.914a.522.522%200%200%200%20-.521-.55h-2.755a.522.522%200%200%200%20-.521.55z'%20fill='%23ffb352'%20transform='translate(-.562%20-.563)'/%3e%3c/svg%3e"
    , se = "data:image/svg+xml,%3csvg%20height='14.864'%20viewBox='0%200%2014.855%2014.864'%20width='14.855'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='m18.686%208.183a7.433%207.433%200%201%200%201.932%207.107h-1.932a5.571%205.571%200%201%201%20-5.249-7.432%205.5%205.5%200%200%201%203.92%201.654l-2.99%202.988h6.5v-6.5z'%20fill='%23fff'%20transform='translate(-6.015%20-6)'/%3e%3c/svg%3e"
    , re = {
        class: "hero-3b py-5 d-print-none"
    }
    , ne = {
        class: "container"
    }
    , oe = {
        class: "row justify-content-center"
    }
    , le = {
        class: "col-xs-12 col-md-8"
    }
    , ae = {
        class: "h3 fw-bold my-0 text-white"
    }
    , ie = {
        key: 0,
        id: "report-switcher",
        class: "date-select fw-bold"
    }
    , ce = ["value", "selected"]
    , ue = {
        key: 0,
        class: "d-flex align-items-start align-items-xl-center fade show mt-4 fs-18 text-white",
        role: "alert"
    }
    , de = {
        class: "container clearfix d-print-none"
    }
    , pe = {
        class: "float-end my-4 d-flex align-items-center"
    }
    , me = {
        key: 0,
        class: "pull-right mt-4"
    }
    , ve = {
        key: 0
    }
    , fe = {
        key: 1,
        class: "container"
    }
    , ye = {
        __name: "report",
        props: {
            clientUrl: {
                type: String,
                required: !0
            },
            token: {
                type: String,
                required: !0
            },
            canned: {
                type: String,
                required: !0
            },
            actions3b: {
                type: String,
                required: !0
            },
            reportAge: {
                type: String,
                required: !0
            },
            reports: {
                type: String,
                required: !0
            },
            displayStrategy: {
                type: String,
                required: !0
            }
        },
        setup(I) {
            const h = I
                , x = X()
                , w = K()
                , B = z()
                , { mountElData: a } = U(B)
                , E = parseInt(a.value.reportAge)
                , y = []
                , P = f(() => w.query.printReport !== "true" && E > 1)
                , $ = f(() => a.value.hideNavigation === "true")
                , D = h.actions3b === "true"
                , T = h.canned === "true"
                , p = k(!0)
                , m = k({})
                , _ = k(!1)
                , i = k(!1)
                , j = f(() => a.value.displayStrategy === "CLIENT")
                , v = f(() => {
                    var u;
                    const e = window.location.search
                        , c = new URLSearchParams(e).get("serviceBundleFulfillmentId");
                    return c || ((u = y[0]) == null ? void 0 : u.orderId)
                }
                )
                , R = f(() => j.value ? `${a.value.clientUrl}?pdt=${a.value.token}&xsl=CC2CONSUMERDIRECT_GENERIC_JSON` : `/member/credit/3bs/${v.value}`)
                , F = async () => {
                    const dataElement = document.getElementById('initial-data-json');
                    const jsonText = dataElement.textContent;
                    if (dataElement && jsonText)
                        try {
                            m.value = await JSON.parse(jsonText).BundleComponents,
                            console.log(m.value),
                                p.value = !1
                        } catch (e) {
                            console.log(e.message),
                                i.value = !0
                        }
                    else
                        T ? fetch("/member/credit-report/3b/canned.json").then(e => e.json()).then(e => {
                            m.value = e.BundleComponents
                        }
                        ).catch(e => {
                            console.error(e == null ? void 0 : e.message),
                                i.value = !0
                        }
                        ).finally(() => {
                            p.value = !1
                        }
                        ) : j.value ? jQuery.ajax({
                            url: R.value,
                            type: "GET",
                            dataType: "jsonp",
                            jsonp: "jsonp_callback",
                            jsonpCallback: "jsonp_callback",
                            cache: !1,
                            success: function (e) {
                                (e == null ? void 0 : e.Status) === "Failed" ? (console.error("Report failed to load"),
                                    i.value = !0) : (m.value = e.BundleComponents,
                                        p.value = !1)
                            },
                            error: function (e) {
                                console.error(e == null ? void 0 : e.message),
                                    i.value = !0
                            }
                        }) : fetch(R.value).then(e => e.json()).then(e => {
                            m.value = e.BundleComponents
                        }
                        ).catch(e => {
                            console.error(e == null ? void 0 : e.message),
                                i.value = !0
                        }
                        ).finally(() => {
                            p.value = !1
                        }
                        )
                }
                , S = f(() => w.name === "smart-3b")
                , A = e => {
                    p.value = !0,
                        window.location = `/member/credit-report/${S.value ? "smart-3b" : "3b"}/?serviceBundleFulfillmentId=${e.target.value}`
                }
                , L = () => {
                    const e = S.value ? "classic-3b" : "smart-3b";
                    x.push({
                        name: e,
                        query: {
                            ...v.value && {
                                serviceBundleFulfillmentId: v.value
                            }
                        }
                    })
                }
                , M = () => {
                    const o = window.location.search
                    const e = `${o}&printReport=true${v.value ? "&serviceBundleFulfillmentId=" + v.value : ""}`
                        , t = window.open(e, "Print", "left=200, top=200, width=1000, height=600, toolbar=0, resizable=0");
                    let c = 0;
                    t.addEventListener("afterprint", function () {
                        t.close()
                    });
                    const u = setInterval(function () {
                        c++,
                            t.document.querySelector(".report-container.fadein") ? (clearInterval(u),
                                setInterval(t.print(), 300)) : c === 7 && (clearInterval(u),
                                    t.close(),
                                    _.value = !0)
                    }, 1e3)
                }
                ;
            return J(() => {
                F(),
                    document.getElementById("report-switcher") && document.getElementById("report-switcher").addEventListener("change", A)
            }
            ),
                (e, t) => {
                    const c = W("router-view")
                        , u = ee;
                    return n(),
                        l(g, null, [s("div", re, [s("div", ne, [s("div", oe, [s("div", le, [s("h1", ae, [t[2] || (t[2] = o(" Your 3B Report & Vantage Scores")), t[3] || (t[3] = s("sup", null, "Â®", -1)), t[4] || (t[4] = o(" 3.0 ")), r(y).length > 0 ? (n(),
                            l(g, {
                                key: 0
                            }, [t[1] || (t[1] = o(" as of ")), r(y).length > 1 ? (n(),
                                l("select", ie, [(n(!0),
                                    l(g, null, Y(r(y), d => (n(),
                                        l("option", {
                                            key: d.orderId,
                                            value: d.orderId,
                                            selected: d.orderId === r(v)
                                        }, C(d.keyDate), 9, ce))), 128))])) : (n(),
                                            l(g, {
                                                key: 1
                                            }, [o(C(r(y)[0].keyDate), 1)], 64))], 64)) : b("", !0)]), !r(i) && r(P) ? (n(),
                                                l("div", ue, [t[8] || (t[8] = s("img", {
                                                    src: te,
                                                    class: "me-2 block"
                                                }, null, -1)), s("span", null, [t[5] || (t[5] = o(" Your 3-Bureau Credit Report & Scores is ")), s("strong", null, C(r(E)), 1), t[6] || (t[6] = o(" days old. ")), t[7] || (t[7] = s("a", {
                                                    href: "/member/credit-report/3b/confirm.htm",
                                                    class: "text-white items-center d-inline-flex items-center d-none"
                                                }, [s("span", {
                                                    class: "underline"
                                                }, "Order an update now"), s("img", {
                                                    src: se,
                                                    class: "ms-1",
                                                    alt: "refresh icon"
                                                })], -1))])])) : b("", !0)])])])]), t[13] || (t[13] = s("div", {
                                                    class: "d-none d-print-block"
                                                }, [s("h1", {
                                                    class: "h3 fw-bold"
                                                }, [o(" Your 3B Report & Vantage Scores"), s("sup", null, "Â®"), o(" 3.0 ")])], -1)), s("div", de, [s("div", pe, [r(i) ? b("", !0) : (n(),
                                                    l("div", me, [r($) ? b("", !0) : (n(),
                                                        l("span", {
                                                            key: 0,
                                                            class: "px-3 print-icon-3b appView-display-none",
                                                            onClick: M
                                                        }, t[9] || (t[9] = [s("i", {
                                                            class: "fa fa-print"
                                                        }, null, -1), o(" Print")]))), s("button", {
                                                            type: "button",
                                                            class: "btn btn-sm btn-secondary fs-12",
                                                            onClick: L
                                                        }, [t[10] || (t[10] = o(" Switch to ")), r(S) ? (n(),
                                                            l(g, {
                                                                key: 0
                                                            }, [o(" Classic ")], 64)) : (n(),
                                                                l(g, {
                                                                    key: 1
                                                                }, [o(" Smart ")], 64)), t[11] || (t[11] = o(" View "))])]))])]), !r(i) && r(m) ? (n(),
                                                                    l("div", ve, [N(c, null, {
                                                                        default: V(({ Component: d, rte: O }) => [(n(),
                                                                            q(G(d), {
                                                                                key: O,
                                                                                "report-data": r(m),
                                                                                loading: r(p),
                                                                                "actions-3b": D
                                                                            }, null, 8, ["report-data", "loading"]))]),
                                                                        _: 1
                                                                    })])) : (n(),
                                                                        l("div", fe, t[12] || (t[12] = [Q('<div class="row justify-content-center"><h2 class="fw-bold">Error</h2><div class="col-xs-12 col-md-8 mt-3"><h4 class="mb-4 mt-5 text-center"> We&#39;re sorry but something went wrong. Please try again later. </h4><p class="text-center"><small><a href="/member/credit-report/3b/simple.htm?format=html">If the problem persists, try our simple 3B report here Â»</a></small></p></div></div>', 1)]))), N(H, {
                                                                            name: "fade"
                                                                        }, {
                                                                            default: V(() => [r(_) ? (n(),
                                                                                q(u, {
                                                                                    key: 0,
                                                                                    onCloseModal: t[0] || (t[0] = d => _.value = !1)
                                                                                })) : b("", !0)]),
                                                                            _: 1
                                                                        })], 64)
                }
        }
    };
export { ye as default };
