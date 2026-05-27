import {_ as et} from "./_plugin-vue_export-helper-DlAUqK2U.js";
import {g as a, h as s, _ as ot, v as R, i as u, F as l, l as _, w as i, p as r, x as m, s as f, k as d, c as j, j as O, m as I, y as nt, af as W, ag as Z, a5 as J, ah as lt, $ as ct, r as F, e as dt, ai as it} from "./index-WOJTja2Z.js";
import {b as tt} from "./route-block-B_A1xBdJ.js";
const ut = {}
  , yt = {
    class: "grid-cell px-1"
};
function mt(o, $) {
    return s(),
    a("p", yt, [ot(o.$slots, "default")])
}
const z = et(ut, [["render", mt]])
  , ft = {
    class: "d-contents flex-1 grid-rows-10 labels"
}
  , gt = ["innerHTML"]
  , wt = ["innerHTML"]
  , pt = {
    __name: "PublicRecords",
    props: {
        records: {
            type: Object,
            required: !0
        },
        bureaus: {
            type: Array,
            required: !0
        }
    },
    setup(o) {
        const $ = g => {
            var k, y, w;
            return ((k = g.EXP) == null ? void 0 : k.Bankruptcy) || ((y = g.EQF) == null ? void 0 : y.Bankruptcy) || ((w = g.TUC) == null ? void 0 : w.Bankruptcy)
        }
          , T = g => {
            var k, y, w;
            return ((k = g.EXP) == null ? void 0 : k.TaxLien) || ((y = g.EQF) == null ? void 0 : y.TaxLien) || ((w = g.TUC) == null ? void 0 : w.TaxLien)
        }
          , C = g => T(g) ? ["Type", "Status", "Date Filed/Reported", "Reference#", "Closing Date", "Amount", "Court", "Date Released"] : $(g) ? ["Type", "Status", "Date Filed/Reported", "Reference#", "Closing Date", "Asset Amount", "Court", "Liability", "Exempt Amount"] : ["Type", "Status", "Date Filed/Reported", "Reference#", "Closing Date", "Action Amount", "Court", "Balance", "Plaintiff"];
        return (g, k) => {
            const y = z;
            return s(!0),
            a(l, null, R(o.records, (w, n) => (s(),
            a("div", {
                key: n,
                class: "d-grid grid-cols-4 my-1"
            }, [u("div", ft, [(s(!0),
            a(l, null, R(C(w), (e, c) => (s(),
            _(y, {
                key: e,
                class: f([[`row-start-${c + 2}`], "fw-bold col-start-1"])
            }, {
                default: i( () => [r(m(e), 1)]),
                _: 2
            }, 1032, ["class"]))), 128))]), (s(!0),
            a(l, null, R(o.bureaus, (e, c) => (s(),
            a("div", {
                key: e.name,
                class: "grid-rows-7 d-contents",
                "data-uw-ignore-translate": "true"
            }, [d(y, {
                class: f([[`bg-${e.name} col-start-${c + 2}`], "row-start-1 text-white fw-bold text-capitalize"]),
                "data-uw-ignore-translate": "true"
            }, {
                default: i( () => [r(m(e.name), 1), k[0] || (k[0] = u("sup", null, "®", -1))]),
                _: 2,
                __: [0]
            }, 1032, ["class"]), d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-2"])
            }, {
                default: i( () => {
                    var t, p;
                    return [u("span", {
                        innerHTML: (p = (t = w[e.code]) == null ? void 0 : t.Type) == null ? void 0 : p.description
                    }, null, 8, gt)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-3"])
            }, {
                default: i( () => {
                    var t, p;
                    return [u("span", {
                        innerHTML: (p = (t = w[e.code]) == null ? void 0 : t.Status) == null ? void 0 : p.description
                    }, null, 8, wt)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-4"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(g.$filters.formatDate((t = w[e.code]) == null ? void 0 : t.dateFiled)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-5"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m((t = w[e.code]) == null ? void 0 : t.referenceNumber), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), T(w) ? (s(),
            a(l, {
                key: 0
            }, [d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-6"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(g.$filters.formatDate((t = w[e.code]) == null ? void 0 : t.closingDate)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-7"])
            }, {
                default: i( () => {
                    var t, p;
                    return [r(m(g.$filters.currency((p = (t = w[e.code]) == null ? void 0 : t.TaxLien) == null ? void 0 : p.amount)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"])], 64)) : $(w) ? (s(),
            a(l, {
                key: 1
            }, [d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-6"])
            }, {
                default: i( () => {
                    var t, p;
                    return [r(m(g.$filters.formatDate((p = (t = w[e.code]) == null ? void 0 : t.Bankruptcy) == null ? void 0 : p.dateResolved)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-7"])
            }, {
                default: i( () => {
                    var t, p;
                    return [r(m(g.$filters.currency((p = (t = w[e.code]) == null ? void 0 : t.Bankruptcy) == null ? void 0 : p.assetAmount)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"])], 64)) : (s(),
            a(l, {
                key: 2
            }, [d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-6"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(g.$filters.formatDate((t = w[e.code]) == null ? void 0 : t.closingDate)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-7"])
            }, {
                default: i( () => {
                    var t, p;
                    return [r(m(g.$filters.currency((p = (t = w[e.code]) == null ? void 0 : t.LegalItem) == null ? void 0 : p.actionAmount)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"])], 64)), d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-8"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m((t = w[e.code]) == null ? void 0 : t.courtName), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), T(w) ? (s(),
            _(y, {
                key: 3,
                class: f([[`col-start-${c + 2}`], "row-start-9"])
            }, {
                default: i( () => {
                    var t, p;
                    return [r(m(g.$filters.formatDate((p = (t = w[e.code]) == null ? void 0 : t.TaxLien) == null ? void 0 : p.dateReleased)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"])) : $(w) ? (s(),
            a(l, {
                key: 4
            }, [d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-9"])
            }, {
                default: i( () => {
                    var t, p;
                    return [r(m(g.$filters.currency((p = (t = w[e.code]) == null ? void 0 : t.Bankruptcy) == null ? void 0 : p.liabilityAmount)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-10"])
            }, {
                default: i( () => {
                    var t, p;
                    return [r(m(g.$filters.currency((p = (t = w[e.code]) == null ? void 0 : t.Bankruptcy) == null ? void 0 : p.exemptAmount)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"])], 64)) : (s(),
            a(l, {
                key: 5
            }, [d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-9"])
            }, {
                default: i( () => {
                    var t, p;
                    return [r(m(g.$filters.currency((p = (t = w[e.code]) == null ? void 0 : t.LegalItem) == null ? void 0 : p.balance)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(y, {
                class: f([[`col-start-${c + 2}`], "row-start-10"])
            }, {
                default: i( () => {
                    var t, p;
                    return [r(m((p = (t = w[e.code]) == null ? void 0 : t.LegalItem) == null ? void 0 : p.plaintiff), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"])], 64))]))), 128))]))), 128)
        }
    }
}
  , kt = {
    class: "d-grid grid-cols-3"
}
  , $t = {
    class: "d-grid grid-cols-3 bg-gray-100 text-center py-1"
}
  , vt = {
    __name: "PayStatusHistory",
    props: {
        account: {
            type: Object,
            required: !0
        },
        bureaus: {
            type: Array,
            required: !0
        }
    },
    setup(o) {
        return ($, T) => (s(),
        a("div", kt, [(s(!0),
        a(l, null, R(o.bureaus, C => {
            var g;
            return s(),
            a("div", {
                key: C.code,
                class: "border-right border-color-gray-600"
            }, [u("p", {
                class: f([[`text-${C.name}`], "fw-bold px-1 mb-1 text-capitalize"]),
                "data-uw-ignore-translate": "true"
            }, [r(m(C.name), 1), T[0] || (T[0] = u("sup", null, "®", -1))], 2), u("div", $t, [(g = o.account[C.code]) != null && g.GrantedTrade ? (s(),
            a(l, {
                key: 0
            }, [u("p", null, [T[1] || (T[1] = r(" 30: ")), u("span", {
                class: f({
                    "late-count-number": o.account[C.code].GrantedTrade.late30Count > 0
                })
            }, m(o.account[C.code].GrantedTrade.late30Count), 3)]), u("p", null, [T[2] || (T[2] = r(" 60: ")), u("span", {
                class: f({
                    "late-count-number": o.account[C.code].GrantedTrade.late60Count > 0
                })
            }, m(o.account[C.code].GrantedTrade.late60Count), 3)]), u("p", null, [T[3] || (T[3] = r(" 90: ")), u("span", {
                class: f({
                    "late-count-number": o.account[C.code].GrantedTrade.late90Count > 0
                })
            }, m(o.account[C.code].GrantedTrade.late90Count), 3)])], 64)) : (s(),
            a(l, {
                key: 1
            }, [T[4] || (T[4] = u("p", null, "30: --", -1)), T[5] || (T[5] = u("p", null, "60: --", -1)), T[6] || (T[6] = u("p", null, "90: --", -1))], 64))])])
        }
        ), 128))]))
    }
}
  , Tt = {
    key: 0,
    class: "d-flex gap-1 flex-wrap flex-1"
}
  , Ct = {
    class: "month-badge"
}
  , bt = {
    "data-uw-ignore-translate": "true",
    class: "month-label text-center"
}
  , At = {
    key: 1,
    class: "fw-bold text-gray-800"
}
  , St = {
    __name: "PaymentHistory",
    props: {
        account: {
            type: Object,
            required: !0
        },
        bureaus: {
            type: Array,
            required: !0
        }
    },
    setup(o) {
        const $ = {
            U: "",
            C: "OK",
            1: "30",
            2: "60",
            3: "90",
            4: "120",
            5: "150",
            7: "PP",
            8: "RP",
            9: "CO"
        }
          , T = C => {
            const g = C.MonthlyPayStatus;
            if (g.length < 24) {
                const k = g[g.length - 1].date.split("-");
                for (let y = g.length; y < 24; y++) {
                    const w = parseInt(k[1])
                      , n = parseInt(k[0]);
                    w === 1 ? (k[1] = "12",
                    k[0] = (n - 1).toString()) : k[1] = w - 1 < 10 ? "0" + (w - 1).toString() : (w - 1).toString(),
                    g.push({
                        status: "U",
                        date: k.join("-")
                    })
                }
                return g.slice().reverse()
            } else
                return g.slice(0, 24).reverse()
        }
        ;
        return (C, g) => (s(!0),
        a(l, null, R(o.bureaus, k => {
            var y, w;
            return s(),
            a("div", {
                key: k.code,
                class: "d-flex flex-wrap my-1 payment-history"
            }, [u("p", {
                class: f([[`text-${k.name}`], "fw-bold payment-history-heading mb-1 text-capitalize"]),
                "data-uw-ignore-translate": "true"
            }, m(k.name), 3), (w = (y = o.account[k.code]) == null ? void 0 : y.GrantedTrade) != null && w.PayStatusHistory ? (s(),
            a("div", Tt, [(s(!0),
            a(l, null, R(T(o.account[k.code].GrantedTrade.PayStatusHistory), (n, e) => (s(),
            a("div", {
                key: e,
                class: f("status-" + n.status)
            }, [u("p", Ct, m($[n.status]), 1), u("p", bt, m(C.$filters.formatPaymentDate(n.date)), 1)], 2))), 128))])) : (s(),
            a("p", At, "NONE REPORTED"))])
        }
        ), 128))
    }
}
  , Dt = {
    class: "mb-3 h6"
}
  , Pt = {
    class: "d-grid grid-cols-4"
}
  , ht = {
    class: "d-contents grid-rows-23 labels"
}
  , Rt = {
    __name: "AccountDetail",
    props: {
        account: {
            type: Object,
            required: !0
        },
        bureaus: {
            type: Array,
            required: !0
        },
        accountType: {
            type: String,
            required: !0
        }
    },
    setup(o) {
        const $ = o
          , T = ["Account #", "High Balance:", "Last Verified:", "Date of Last Activity:", "Date Reported:", "Date Opened:", "Balance Owed:", "Closed Date:", "Account Rating:", "Account Description:", "Dispute Status:", "Creditor Type:", "Account Status:", "Payment Status:", "Creditor Remarks:", "Payment Amount:", "Last Payment:", "Term Length:", "Past Due Amount:", "Account Type:", "Payment Frequency:", "Credit Limit:"]
          , C = ["Account #", "High Balance:", "Last Verified:", "Date of Last Activity:", "Date Reported:", "Date Opened:", "Balance Owed:", "Closed Date:", "Account Rating:", "Account Description:", "Dispute Status:", "Creditor Type:", "Account Status:", "Payment Status:", "Creditor Remarks:", "Original Creditor", "Last Payment:", "Past Due Amount:", "Account Type:"]
          , g = j( () => $.accountType === "Collection")
          , k = j( () => g.value ? C : T);
        return (y, w) => {
            const n = z;
            return s(),
            a("div", null, [u("p", Dt, [u("strong", null, m(o.account.creditorName), 1)]), u("div", Pt, [u("div", ht, [(s(!0),
            a(l, null, R(O(k), (e, c) => (s(),
            _(n, {
                key: e,
                class: f([[`row-start-${c + 2}`], "col-start-1 fw-bold border-color-gray-100 border-l"])
            }, {
                default: i( () => [r(m(e), 1)]),
                _: 2
            }, 1032, ["class"]))), 128))]), O(g) ? (s(!0),
            a(l, {
                key: 0
            }, R(o.bureaus, (e, c) => (s(),
            a("div", {
                key: e.code,
                class: "d-contents grid-rows-23"
            }, [d(n, {
                class: f([[`bg-${e.name} col-start-${c + 2}`], "row-start-1 text-white fw-bold text-capitalize"]),
                "data-uw-ignore-translate": "true"
            }, {
                default: i( () => [r(m(e.name), 1), w[0] || (w[0] = u("sup", null, "®", -1))]),
                _: 2,
                __: [0]
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-2"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(y.$filters.obscureAccountNumber((t = o.account[e.code]) == null ? void 0 : t.accountNumber)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-3"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.highBalance ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.currency(o.account[e.code].highBalance)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-4"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.dateVerified ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].dateVerified)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-5"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.dateAccountStatus ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].dateAccountStatus)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-6"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.dateReported ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].dateReported)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-7"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.dateOpened ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].dateOpened)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-8"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.currentBalance ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.currency(o.account[e.code].currentBalance)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-9"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.dateClosed ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].dateClosed)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-10"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.AccountCondition ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].AccountCondition.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-11"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.AccountDesignator ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].AccountDesignator.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-12"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.DisputeFlag ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].DisputeFlag.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-13"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.IndustryCode ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].IndustryCode.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-14"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.OpenClosed ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].OpenClosed.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-15"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.PayStatus ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].PayStatus.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-16"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.Remark ? (s(),
                    a(l, {
                        key: 0
                    }, [Array.isArray(o.account[e.code].Remark) ? (s(!0),
                    a(l, {
                        key: 0
                    }, R(o.account[e.code].Remark, (p, P) => (s(),
                    a("div", {
                        key: P
                    }, [p.RemarkCode ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(p.RemarkCode.description), 1)], 64)) : I("", !0)]))), 128)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(m(o.account[e.code].Remark.RemarkCode.description), 1)], 64))], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-17"])
            }, {
                default: i( () => {
                    var t, p;
                    return [(p = (t = o.account[e.code]) == null ? void 0 : t.CollectionTrade) != null && p.originalCreditor ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].CollectionTrade.originalCreditor), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-18"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.GrantedTrade ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].GrantedTrade.dateLastPayment)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-19"])
            }, {
                default: i( () => {
                    var t, p;
                    return [(p = (t = o.account[e.code]) == null ? void 0 : t.GrantedTrade) != null && p.amountPastDue ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.currency(o.account[e.code].GrantedTrade.amountPastDue)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-20"])
            }, {
                default: i( () => {
                    var t, p, P;
                    return [(t = o.account[e.code]) != null && t.GrantedTrade ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m((P = (p = o.account[e.code].GrantedTrade) == null ? void 0 : p.AccountType) == null ? void 0 : P.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"])]))), 128)) : (s(!0),
            a(l, {
                key: 1
            }, R(o.bureaus, (e, c) => (s(),
            a("div", {
                key: e.code,
                class: "d-contents grid-rows-23"
            }, [d(n, {
                class: f([[`bg-${e.name} col-start-${c + 2}`], "row-start-1 text-white fw-bold text-capitalize"]),
                "data-uw-ignore-translate": "true"
            }, {
                default: i( () => [r(m(e.name), 1), w[1] || (w[1] = u("sup", null, "®", -1))]),
                _: 2,
                __: [1]
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-2"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(y.$filters.obscureAccountNumber((t = o.account[e.code]) == null ? void 0 : t.accountNumber)), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-3"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.highBalance ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.currency(o.account[e.code].highBalance)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-4"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.dateVerified ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].dateVerified)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-5"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.dateAccountStatus ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].dateAccountStatus)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-6"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.dateReported ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].dateReported)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-7"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.dateOpened ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].dateOpened)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-8"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.currentBalance ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.currency(o.account[e.code].currentBalance)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-9"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.dateClosed ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].dateClosed)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-10"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.AccountCondition ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].AccountCondition.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-11"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.AccountDesignator ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].AccountDesignator.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-12"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.DisputeFlag ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].DisputeFlag.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-13"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.IndustryCode ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].IndustryCode.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-14"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.OpenClosed ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].OpenClosed.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-15"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.PayStatus ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].PayStatus.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-16"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.Remark ? (s(),
                    a(l, {
                        key: 0
                    }, [Array.isArray(o.account[e.code].Remark) ? (s(!0),
                    a(l, {
                        key: 0
                    }, R(o.account[e.code].Remark, (p, P) => (s(),
                    a("div", {
                        key: P
                    }, [p.RemarkCode ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(p.RemarkCode.description), 1)], 64)) : I("", !0)]))), 128)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(m(o.account[e.code].Remark.RemarkCode.description), 1)], 64))], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-17"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.GrantedTrade ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.currency(o.account[e.code].GrantedTrade.monthlyPayment)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-18"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.GrantedTrade ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.formatDate(o.account[e.code].GrantedTrade.dateLastPayment)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-19"])
            }, {
                default: i( () => {
                    var t;
                    return [(t = o.account[e.code]) != null && t.GrantedTrade && o.account[e.code].GrantedTrade.termMonths > 0 ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].GrantedTrade.termMonths) + " Month(s) ", 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-20"])
            }, {
                default: i( () => {
                    var t, p;
                    return [(p = (t = o.account[e.code]) == null ? void 0 : t.GrantedTrade) != null && p.amountPastDue ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.currency(o.account[e.code].GrantedTrade.amountPastDue)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-21"])
            }, {
                default: i( () => {
                    var t, p, P;
                    return [(t = o.account[e.code]) != null && t.GrantedTrade ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m((P = (p = o.account[e.code].GrantedTrade) == null ? void 0 : p.AccountType) == null ? void 0 : P.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-22"])
            }, {
                default: i( () => {
                    var t, p, P;
                    return [(P = (p = (t = o.account[e.code]) == null ? void 0 : t.GrantedTrade) == null ? void 0 : p.PaymentFrequency) != null && P.description ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(o.account[e.code].GrantedTrade.PaymentFrequency.description), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-23"])
            }, {
                default: i( () => {
                    var t, p;
                    return [(p = (t = o.account[e.code]) == null ? void 0 : t.GrantedTrade) != null && p.CreditLimit ? (s(),
                    a(l, {
                        key: 0
                    }, [r(m(y.$filters.currency(o.account[e.code].GrantedTrade.CreditLimit)), 1)], 64)) : (s(),
                    a(l, {
                        key: 1
                    }, [r(" -- ")], 64))]
                }
                ),
                _: 2
            }, 1032, ["class"])]))), 128))])])
        }
    }
}
  , Et = {}
  , Bt = {
    class: "d-flex flex-wrap payment-history-legend justify-content-start w-full"
};
function Lt(o, $) {
    return s(),
    a("div", Bt, $[0] || ($[0] = [nt('<div class="status-U flex-grow-1"><p class="month-badge"></p><p class="month-label"> Unknown </p></div><div class="status-C flex-grow-1"><p class="month-badge"> OK </p><p class="month-label"> Current </p></div><div class="status-1 flex-grow-1"><p class="month-badge"> 30 </p><p class="month-label"> 30 Days Late </p></div><div class="status-2 flex-grow-1"><p class="month-badge"> 60 </p><p class="month-label"> 60 Days Late </p></div><div class="status-3 flex-grow-1"><p class="month-badge"> 90 </p><p class="month-label"> 90 Days Late </p></div><div class="status-4 flex-grow-1"><p class="month-badge"> 120 </p><p class="month-label"> 120 Days Late </p></div><div class="status-5 flex-grow-1"><p class="month-badge"> 150 </p><p class="month-label"> 150+ Days Late </p></div><div class="status-7 flex-grow-1"><p class="month-badge"> PP </p><p class="month-label"> Payment Plan </p></div><div class="status-8 flex-grow-1"><p class="month-badge"> RF </p><p class="month-label"> Repossession Foreclosure </p></div><div class="status-9 flex-grow-1"><p class="month-badge"> CO </p><p class="month-label"> Collection Chargeoff </p></div>', 10)]))
}
const Ot = et(Et, [["render", Lt]])
  , Nt = {
    class: "d-grid grid-cols-4 mt-3"
}
  , qt = {
    class: "d-contents grid-rows-10 labels"
}
  , It = {
    __name: "ReportSummary",
    props: {
        summary: {
            type: Object,
            required: !0
        },
        bureaus: {
            type: Array,
            required: !0
        }
    },
    setup(o) {
        const $ = o
          , T = ["Total Accounts", "Open Accounts:", "Closed Accounts:", "Delinquent:", "Derogatory:", "Balances:", "Payments:", "Public Records:", "Inquiries (2 years):"]
          , C = j( () => {
            var y, w, n;
            return {
                TUC: (y = $.summary.TradelineSummary) == null ? void 0 : y.TransUnion,
                EXP: (w = $.summary.TradelineSummary) == null ? void 0 : w.Experian,
                EQF: (n = $.summary.TradelineSummary) == null ? void 0 : n.Equifax
            }
        }
        )
          , g = j( () => {
            var y, w, n;
            return {
                TUC: (y = $.summary.PublicRecordSummary) == null ? void 0 : y.TransUnion,
                EXP: (w = $.summary.PublicRecordSummary) == null ? void 0 : w.Experian,
                EQF: (n = $.summary.PublicRecordSummary) == null ? void 0 : n.Equifax
            }
        }
        )
          , k = j( () => {
            var y, w, n;
            return {
                TUC: (y = $.summary.InquirySummary) == null ? void 0 : y.TransUnion,
                EXP: (w = $.summary.InquirySummary) == null ? void 0 : w.Experian,
                EQF: (n = $.summary.InquirySummary) == null ? void 0 : n.Equifax
            }
        }
        );
        return (y, w) => {
            const n = z;
            return s(),
            a("div", Nt, [u("div", qt, [(s(),
            a(l, null, R(T, (e, c) => d(n, {
                key: e,
                class: f([[`row-start-${c + 2}`], "col-start-1 fw-bold border-color-gray-100 border-l"])
            }, {
                default: i( () => [r(m(e), 1)]),
                _: 2
            }, 1032, ["class"])), 64))]), (s(!0),
            a(l, null, R(o.bureaus, (e, c) => (s(),
            a("div", {
                key: e.code,
                class: "d-contents grid-rows-10"
            }, [d(n, {
                class: f([[`bg-${e.code} col-start-${c + 2}`], "row-start-1 text-white fw-bold text-capitalize"]),
                "data-uw-ignore-translate": "true"
            }, {
                default: i( () => [r(m(e.name), 1), w[0] || (w[0] = u("sup", null, "®", -1))]),
                _: 2,
                __: [0]
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-2"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(((t = O(C)[e.code]) == null ? void 0 : t.TotalAccounts) || "--"), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-3"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(((t = O(C)[e.code]) == null ? void 0 : t.OpenAccounts) || "--"), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-4"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(((t = O(C)[e.code]) == null ? void 0 : t.CloseAccounts) || "--"), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-5"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(((t = O(C)[e.code]) == null ? void 0 : t.DelinquentAccounts) || "--"), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-6"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(((t = O(C)[e.code]) == null ? void 0 : t.DerogatoryAccounts) || "--"), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-7"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(y.$filters.currency((t = O(C)[e.code]) == null ? void 0 : t.TotalBalances) || "--"), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-8"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(y.$filters.currency((t = O(C)[e.code]) == null ? void 0 : t.TotalMonthlyPayments) || "--"), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-9"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(((t = O(g)[e.code]) == null ? void 0 : t.NumberOfRecords) || "--"), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-10"])
            }, {
                default: i( () => {
                    var t;
                    return [r(m(((t = O(k)[e.code]) == null ? void 0 : t.NumberInLast2Years) || "--"), 1)]
                }
                ),
                _: 2
            }, 1032, ["class"])]))), 128))])
        }
    }
}
  , Ht = {
    class: "mt-3"
}
  , Ut = {
    class: "flex-25"
}
  , Ft = {
    class: "m-0"
}
  , Gt = {
    __name: "ConsumerStatements",
    props: {
        bureaus: {
            type: Array,
            required: !0
        },
        borrower: {
            type: Object,
            required: !0
        }
    },
    setup(o) {
        const $ = o
          , T = C => {
            var g, k, y, w, n;
            if ((g = $.borrower) != null && g.CreditStatement) {
                if (Array.isArray($.borrower.CreditStatement)) {
                    const e = $.borrower.CreditStatement.findIndex(c => c.Source.Bureau.symbol === C);
                    if (e !== -1)
                        return $.borrower.CreditStatement[e].statement
                } else if (((n = (w = (y = (k = $.borrower) == null ? void 0 : k.CreditStatement) == null ? void 0 : y.Source) == null ? void 0 : w.Bureau) == null ? void 0 : n.symbol) === C)
                    return $.borrower.CreditStatement.statement
            }
            return "NONE REPORTED"
        }
        ;
        return (C, g) => (s(),
        a("div", Ht, [g[1] || (g[1] = u("p", null, [u("strong", null, "Consumer Statement")], -1)), (s(!0),
        a(l, null, R(o.bureaus, (k, y) => (s(),
        a("div", {
            key: k.code,
            class: f([{
                "bg-gray-100": y % 2
            }, "d-flex justify-content-start py-2"])
        }, [u("div", Ut, [u("p", {
            class: f([[`text-${k.name}`], "fw-bold m-0 text-capitalize ps-1"]),
            "data-uw-ignore-translate": "true"
        }, [r(m(k.name), 1), g[0] || (g[0] = u("sup", null, "®", -1))], 2)]), u("div", null, [u("p", Ft, m(T(k.code)), 1)])], 2))), 128))]))
    }
}
  , Mt = {
    class: "d-grid grid-cols-4 my-1"
}
  , Vt = {
    class: "d-contents flex-1 grid-rows-7 labels"
}
  , jt = ["innerHTML"]
  , _t = ["innerHTML"]
  , zt = ["innerHTML"]
  , Qt = ["innerHTML"]
  , Xt = ["innerHTML"]
  , Yt = ["innerHTML"]
  , Kt = {
    __name: "PersonalInfo",
    props: {
        scores: {
            type: Object,
            required: !0
        },
        bureaus: {
            type: Array,
            required: !0
        },
        borrower: {
            type: Object,
            required: !0
        }
    },
    setup(o) {
        const $ = o
          , T = y => {
            var w, n, e, c, t;
            if (Array.isArray((w = $.borrower) == null ? void 0 : w.BorrowerName)) {
                let p = "";
                const P = $.borrower.BorrowerName.filter(H => H.Source.Bureau.symbol === y);
                if (P.length > 0) {
                    for (const H of P)
                        p += W(H.Name) + "<br>";
                    return p
                } else
                    return "--"
            } else
                return ((t = (c = (e = (n = $.borrower) == null ? void 0 : n.BorrowerName) == null ? void 0 : e.Source) == null ? void 0 : c.Bureau) == null ? void 0 : t.symbol) === y ? W($.borrower.BorrowerName.Name) : "--"
        }
          , C = y => {
            var w, n, e, c, t;
            if (Array.isArray((w = $.borrower) == null ? void 0 : w.Birth)) {
                const p = $.borrower.Birth.findIndex(P => P.Source.Bureau.symbol === y);
                if (p !== -1)
                    return $.borrower.Birth[p].BirthDate.year
            } else
                return ((t = (c = (e = (n = $.borrower) == null ? void 0 : n.Birth) == null ? void 0 : e.Source) == null ? void 0 : c.Bureau) == null ? void 0 : t.symbol) === y ? $.borrower.Birth.BirthDate.year : "--"
        }
          , g = (y, w) => {
            var n, e;
            if (Array.isArray(y)) {
                const c = y.filter(p => p.Source.Bureau.symbol === w);
                let t = "";
                if (c.length) {
                    for (const p of c)
                        t += Z(p.CreditAddress) + "<br/><br/>";
                    return t.slice(0, -8)
                }
            } else
                return ((e = (n = y == null ? void 0 : y.Source) == null ? void 0 : n.Bureau) == null ? void 0 : e.symbol) === w ? Z(y.CreditAddress) : "--"
        }
          , k = y => {
            var e, c, t, p, P, H, Q;
            let w = ""
              , n = "";
            if (Array.isArray((e = $.borrower) == null ? void 0 : e.Employer) ? w = $.borrower.Employer.filter(G => G.Source.Bureau.symbol === y) : ((P = (p = (t = (c = $.borrower) == null ? void 0 : c.Employer) == null ? void 0 : t.Source) == null ? void 0 : p.Bureau) == null ? void 0 : P.symbol) === y && (n += $.borrower.Employer.name,
            (Q = (H = $.borrower) == null ? void 0 : H.Employer) != null && Q.dateUpdated && (n += "<br> Date Updated: " + J($.borrower.Employer.dateUpdated))),
            w.length > 0) {
                for (const G of w)
                    n += G.name,
                    G.dateUpdated && (n += "<br> Date Updated: " + J(G.dateUpdated)),
                    n += "<br><br>";
                return n.slice(0, -8)
            } else
                return n.length ? n : "--"
        }
        ;
        return (y, w) => {
            const n = z;
            return s(),
            a("div", Mt, [u("div", Vt, [d(n, {
                class: "fw-bold row-start-2 col-start-1 border-color-gray-100 border-l"
            }, {
                default: i( () => w[0] || (w[0] = [r(" Credit Report Date ")])),
                _: 1,
                __: [0]
            }), d(n, {
                class: "fw-bold row-start-3 col-start-1 border-color-gray-100 border-l"
            }, {
                default: i( () => w[1] || (w[1] = [r(" Name "), u("br", null, null, -1), r(" Also Known As: ")])),
                _: 1,
                __: [1]
            }), d(n, {
                class: "fw-bold row-start-4 col-start-1 border-color-gray-100 border-l"
            }, {
                default: i( () => w[2] || (w[2] = [r(" Date of Birth ")])),
                _: 1,
                __: [2]
            }), d(n, {
                class: "fw-bold row-start-5 col-start-1 border-color-gray-100 border-l"
            }, {
                default: i( () => w[3] || (w[3] = [r(" Current Address ")])),
                _: 1,
                __: [3]
            }), d(n, {
                class: "fw-bold row-start-6 col-start-1 border-color-gray-100 border-l"
            }, {
                default: i( () => w[4] || (w[4] = [r(" Previous Address ")])),
                _: 1,
                __: [4]
            }), d(n, {
                class: "fw-bold row-start-7 col-start-1 border-color-gray-100 border-l border-b"
            }, {
                default: i( () => w[5] || (w[5] = [r(" Employer ")])),
                _: 1,
                __: [5]
            })]), (s(!0),
            a(l, null, R(o.bureaus, (e, c) => (s(),
            a("div", {
                key: e,
                class: "grid-rows-7 d-contents"
            }, [d(n, {
                class: f([[`bg-${e.name} col-start-${c + 2}`], "row-start-1 text-white fw-bold text-capitalize"]),
                "data-uw-ignore-translate": "true"
            }, {
                default: i( () => [r(m(e.name), 1), w[6] || (w[6] = u("sup", null, "®", -1))]),
                _: 2,
                __: [6]
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-2"])
            }, {
                default: i( () => {
                    var t, p;
                    return [u("span", {
                        innerHTML: y.$filters.formatDate((p = (t = o.scores[e.code]) == null ? void 0 : t.Source) == null ? void 0 : p.InquiryDate)
                    }, null, 8, jt)]
                }
                ),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-3"])
            }, {
                default: i( () => [u("span", {
                    innerHTML: T(e.code)
                }, null, 8, _t)]),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-4"])
            }, {
                default: i( () => [u("span", {
                    innerHTML: C(e.code)
                }, null, 8, zt)]),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-5"])
            }, {
                default: i( () => [u("span", {
                    innerHTML: g(o.borrower.BorrowerAddress, e.code)
                }, null, 8, Qt)]),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-6"])
            }, {
                default: i( () => [u("span", {
                    innerHTML: g(o.borrower.PreviousAddress, e.code)
                }, null, 8, Xt)]),
                _: 2
            }, 1032, ["class"]), d(n, {
                class: f([[`col-start-${c + 2}`], "row-start-7 border-color-gray-100 border-b"])
            }, {
                default: i( () => [u("span", {
                    innerHTML: k(e.code)
                }, null, 8, Yt)]),
                _: 2
            }, 1032, ["class"])]))), 128))])
        }
    }
}
  , xt = {
    class: "d-flex ms-auto flex-wrap justify-content-end fs-13 mt-3 d-print-none"
}
  , Wt = {
    __name: "ScrollToLegend",
    emits: ["navigate-page"],
    setup(o, {emit: $}) {
        const T = $;
        return (C, g) => (s(),
        a("div", xt, [g[6] || (g[6] = u("strong", {
            class: "ps-1"
        }, "Quick Links:", -1)), u("span", {
            class: "cursor-pointer text-primary ps-1",
            onClick: g[0] || (g[0] = k => T("navigate-page", "personal-info"))
        }, " Personal Information "), g[7] || (g[7] = u("span", {
            class: "ps-1"
        }, "/", -1)), u("span", {
            class: "cursor-pointer text-primary ps-1",
            onClick: g[1] || (g[1] = k => T("navigate-page", "summary"))
        }, " Summary "), g[8] || (g[8] = u("span", {
            class: "ps-1"
        }, "/", -1)), u("span", {
            class: "cursor-pointer text-primary ps-1",
            onClick: g[2] || (g[2] = k => T("navigate-page", "account-history"))
        }, " Account History "), g[9] || (g[9] = u("span", {
            class: "ps-1"
        }, "/", -1)), u("span", {
            class: "cursor-pointer text-primary ps-1",
            onClick: g[3] || (g[3] = k => T("navigate-page", "public-info"))
        }, " Public Information "), g[10] || (g[10] = u("span", {
            class: "ps-1"
        }, "/", -1)), u("span", {
            class: "cursor-pointer text-primary ps-1",
            onClick: g[4] || (g[4] = k => T("navigate-page", "inquiries"))
        }, " Inquiries "), g[11] || (g[11] = u("span", {
            class: "ps-1"
        }, "/", -1)), u("span", {
            class: "cursor-pointer text-primary ps-1",
            onClick: g[5] || (g[5] = k => T("navigate-page", "creditors"))
        }, " Creditors ")]))
    }
}
  , Zt = {
    class: "mx-0 py-3"
}
  , Jt = {
    class: "row container mx-auto p-0"
}
  , te = {
    class: "flex-1 text-center py-1 border-color-gray-100 border-l border-b"
}
  , ee = {
    __name: "ScoresHeading",
    props: {
        scores: {
            type: Object,
            required: !0
        },
        bureaus: {
            type: Array,
            required: !0
        }
    },
    setup(o) {
        return ($, T) => {
            const C = lt("sticky-nav");
            return ct((s(),
            a("div", Zt, [u("div", Jt, [(s(!0),
            a(l, null, R(o.bureaus, g => {
                var k, y, w, n;
                return s(),
                a("dl", {
                    key: g.code,
                    class: "col p-0 m-0"
                }, [u("dt", {
                    class: f([[`bg-${g.name}`], "text-white text-center text-capitalize"]),
                    "data-uw-ignore-translate": "true"
                }, [r(m(g.name), 1), T[0] || (T[0] = u("sup", null, "®", -1))], 2), u("dd", te, [u("h5", {
                    class: f(["fw-bold m-0 h-60px d-flex justify-content-center align-items-center", [(k = o.scores[g.code]) != null && k.riskScore && ((y = o.scores[g.code]) == null ? void 0 : y.riskScore) != 4 ? "h1" : "h3"]])
                }, [(w = o.scores[g.code]) != null && w.riskScore && ((n = o.scores[g.code]) == null ? void 0 : n.riskScore) != 4 ? (s(),
                a(l, {
                    key: 0
                }, [r(m(o.scores[g.code].riskScore), 1)], 64)) : (s(),
                a(l, {
                    key: 1
                }, [r(" can't be calculated ")], 64))], 2)])])
            }
            ), 128))])])), [[C]])
        }
    }
}
  , se = {
    key: 0,
    class: "container fadein original-view"
}
  , ae = {
    class: "credit-score-3"
}
  , re = {
    key: 0,
    class: "text-red-600 mt-3"
}
  , oe = {
    class: "list-unstyled"
}
  , ne = {
    class: "text-uppercase"
}
  , le = {
    class: "mt-5"
}
  , ce = {
    class: "d-flex justify-content-between align-items-baseline w-full flex-wrap mb-3"
}
  , de = {
    class: "mt-5"
}
  , ie = {
    class: "mt-5"
}
  , ue = {
    key: 0,
    class: "mt-3"
}
  , ye = {
    key: 1,
    class: "mt-5"
}
  , me = ["id"]
  , fe = {
    class: "mt-3 p-1 fs-12"
}
  , ge = {
    key: 2,
    class: "mt-3"
}
  , we = {
    key: 1
}
  , pe = {
    key: 0
}
  , ke = {
    class: "d-grid grid-cols-3 fs-12 bg-gray-100"
}
  , $e = {
    key: 1
}
  , ve = {
    class: "my-3"
}
  , Te = {
    class: "fw-bold"
}
  , Ce = {
    key: 0
}
  , be = {
    key: 1
}
  , Ae = {
    class: "d-grid grid-cols-3 fs-12 bg-gray-100"
}
  , Se = ["innerHTML"]
  , De = {
    key: 1
}
  , Pe = {
    __name: "ClassicView",
    props: {
        loading: Boolean,
        reportData: {
            type: Object,
            required: !0
        }
    },
    setup(o) {
        const $ = o
          , T = F({})
          , C = F(!0)
          , g = F({})
          , k = F(null)
          , y = F([])
          , w = F([])
          , n = F({
            m: [],
            r: [],
            i: [],
            o: [],
            c: [],
            y: [],
            u: []
        })
          , e = F([])
          , c = F(!1)
          , t = [{
            code: "TUC",
            name: "transunion"
        }, {
            code: "EXP",
            name: "experian"
        }, {
            code: "EQF",
            name: "equifax"
        }]
          , p = {
            m: "Real Estate Accounts",
            r: "Revolving Accounts",
            i: "Installment Accounts",
            o: "Other:",
            c: "Overdraft/reserve checking accounts/ line of credit",
            y: "Collection",
            u: "Unknown"
        }
          , P = {
            m: "Primary and secondary mortgages on your home",
            r: "Accounts with an open-end term",
            i: "Accounts comprised of fixed terms with regular payments",
            o: "Accounts in which the exact category is unknown"
        }
          , H = j( () => Object.keys(n.value).length)
          , Q = async () => {
            var S, v, B, b, L, U, A, h, M, V, N, X;
            g.value.TUC = (S = $.reportData.BundleComponent.find(E => E.Type === "TUCVantageScoreV6")) == null ? void 0 : S.CreditScoreType,
            g.value.EQF = (v = $.reportData.BundleComponent.find(E => E.Type === "EQFVantageScoreV6")) == null ? void 0 : v.CreditScoreType,
            g.value.EXP = (B = $.reportData.BundleComponent.find(E => E.Type === "EXPVantageScoreV6")) == null ? void 0 : B.CreditScoreType,
            k.value = $.reportData.BundleComponent.find(E => E.Type === "MergeCreditReports"),
            k.value = k.value.TrueLinkCreditReportType,
            G(),
            ((A = (U = (L = (b = k.value) == null ? void 0 : b.Summary) == null ? void 0 : L.PublicRecordSummary) == null ? void 0 : U.Merge) == null ? void 0 : A.NumberOfRecords) > 0 && st(),
            at((h = k.value) == null ? void 0 : h.TradeLinePartition),
            Array.isArray((M = k.value) == null ? void 0 : M.InquiryPartition) ? w.value = (V = k.value) == null ? void 0 : V.InquiryPartition : (N = k.value) != null && N.InquiryPartition && w.value.push((X = k.value) == null ? void 0 : X.InquiryPartition),
            C.value = !1
        }
          , G = () => {
            Object.keys(k.value.SB168Frozen).some(S => {
                k.value.SB168Frozen[S] === "true" && y.value.push(S)
            }
            )
        }
          , st = () => {
            var B, b, L, U;
            const S = [];
            let v = k.value.PulblicRecordPartition;
            if (v && Array.isArray(v)) {
                v = v.map(A => A.PublicRecord);
                for (const A of v)
                    if (Array.isArray(A)) {
                        const h = A[A.findIndex(N => N.bureau === "Experian")]
                          , M = A[A.findIndex(N => N.bureau === "Equifax")]
                          , V = A[A.findIndex(N => N.bureau === "TransUnion")];
                        S.push({
                            EXP: h,
                            EQF: M,
                            TUC: V
                        })
                    } else {
                        const h = (b = (B = A == null ? void 0 : A.Source) == null ? void 0 : B.Bureau) == null ? void 0 : b.symbol;
                        h && S.push({
                            [h]: A
                        })
                    }
            } else {
                const A = v == null ? void 0 : v.PublicRecord;
                if (Array.isArray(v.PublicRecord))
                    S.push({
                        EXP: A[A.findIndex(h => h.bureau === "Experian")],
                        EQF: A[A.findIndex(h => h.bureau === "Equifax")],
                        TUC: A[A.findIndex(h => h.bureau === "TransUnion")]
                    });
                else {
                    const h = (U = (L = A == null ? void 0 : A.Source) == null ? void 0 : L.Bureau) == null ? void 0 : U.symbol;
                    h && S.push({
                        [h]: A
                    })
                }
            }
            S && (e.value = S)
        }
          , at = S => {
            var B;
            const v = Array.isArray(S) ? S : S ? [S] : [];
            for (const b of v) {
                let L;
                b != null && b.accountTypeSymbol ? L = b.accountTypeSymbol.toLowerCase() : Array.isArray(b.Tradeline) && b.Tradeline.find(h => h == null ? void 0 : h.CollectionTrade) || (B = b.Tradeline) != null && B.CollectionTrade ? L = "y" : L = "u";
                const U = b.Tradeline.length ? b.Tradeline[0].creditorName : b.Tradeline.creditorName
                  , A = b.Tradeline.length ? b.Tradeline[0].accountNumber : b.Tradeline.accountNumber;
                n.value[L].push({
                    accountNumber: A,
                    creditorName: U,
                    EQF: Y(b.Tradeline, "Equifax"),
                    EXP: Y(b.Tradeline, "Experian"),
                    TUC: Y(b.Tradeline, "TransUnion")
                })
            }
            Object.keys(n.value).forEach(b => n.value[b].length === 0 && delete n.value[b])
        }
          , Y = (S, v) => {
            if (S.length) {
                const B = S.findIndex(b => b.bureau === v);
                return S[B]
            } else if (S.bureau === v)
                return S
        }
          , rt = S => {
            const v = T.value[S];
            if (v) {
                const B = window.innerWidth > 768 ? 300 : 440
                  , b = v.$el ? v.$el.offsetTop : v.offsetTop;
                window.scroll({
                    top: b - B,
                    left: 0,
                    behavior: "smooth"
                })
            }
        }
        ;
        return dt( () => {
            Q()
        }
        ),
        (S, v) => {
            const B = ee
              , b = Wt
              , L = Kt
              , U = Gt
              , A = It
              , h = Ot
              , M = Rt
              , V = St
              , N = vt
              , X = pt
              , E = z;
            return C.value ? I("", !0) : (s(),
            a("div", se, [u("section", ae, [d(B, {
                scores: g.value,
                bureaus: t
            }, null, 8, ["scores"]), v[2] || (v[2] = u("p", {
                class: "float-end"
            }, [u("small", null, "*Vantage Score® 3.0 credit score")], -1)), y.value.length ? (s(),
            a("div", re, [v[1] || (v[1] = u("p", null, [u("strong", null, "***SECURITY FREEZE:"), r(" THE FOLLOWING CREDIT BUREAUS REPORT THAT YOU HAVE PLACED A SECURITY FREEZE OR LOCK ON THIS FILE. HOWEVER, THE FILE HAS BEEN DELIVERED TO YOU UNDER THE APPLICABLE EXEMPTION PROVISIONS (PROVIDING A CONSUMER WITH A COPY OF HIS OR HER CREDIT REPORT UPON THE CONSUMER'S REQUEST): ")], -1)), u("ul", oe, [(s(!0),
            a(l, null, R(y.value, D => (s(),
            a("li", {
                key: D.index
            }, [u("span", ne, m(D), 1)]))), 128))])])) : I("", !0)]), u("section", le, [u("div", ce, [u("h5", {
                ref: D => {
                    T.value["personal-info"] = D
                }
                ,
                class: "m-0 fw-bold"
            }, " Personal Information ", 512), d(b, {
                onNavigatePage: rt
            })]), d(L, {
                scores: g.value,
                bureaus: t,
                borrower: k.value.Borrower
            }, null, 8, ["scores", "borrower"]), d(U, {
                bureaus: t,
                borrower: k.value.Borrower
            }, null, 8, ["borrower"])]), u("section", de, [u("h5", {
                ref: D => {
                    T.value.summary = D
                }
                ,
                class: "fw-bold"
            }, " Summary ", 512), d(A, {
                bureaus: t,
                summary: k.value.Summary
            }, null, 8, ["summary"])]), u("section", ie, [u("h5", {
                ref: D => {
                    T.value["account-history"] = D
                }
                ,
                class: "fw-bold"
            }, " Account History ", 512), O(H) ? (s(),
            a("div", ue, [v[3] || (v[3] = u("p", null, [u("strong", null, "At-a-glance viewing of your payment history")], -1)), d(h)])) : I("", !0), O(H) ? (s(),
            a("div", ye, [(s(!0),
            a(l, null, R(n.value, (D, q) => (s(),
            a("div", {
                key: q,
                class: f({
                    "mb-5": D.length > 0
                })
            }, [D.length > 0 ? (s(),
            a(l, {
                key: 0
            }, [u("p", {
                id: "type-" + q,
                class: "border-color-gray-100 border-b pb-1 pt-2 fs-14"
            }, [u("strong", null, m(p[q]), 1), P[q] ? (s(),
            a(l, {
                key: 0
            }, [r(" : " + m(P[q]), 1)], 64)) : I("", !0)], 8, me), (s(!0),
            a(l, null, R(D, (K, x) => (s(),
            a("div", {
                key: x,
                class: f([{
                    "pt-5": x !== 0
                }, "my-3 border-b border-5 border-color-gray-300"])
            }, [d(M, {
                bureaus: t,
                account: K,
                "account-type": p[q]
            }, null, 8, ["account", "account-type"]), u("div", fe, [v[4] || (v[4] = u("p", {
                class: "text-gray-800 mb-2 pb-1 border-color-gray-100 border-b"
            }, [u("strong", null, "Two-Year Payment History")], -1)), d(V, {
                bureaus: t,
                account: K
            }, null, 8, ["account"])]), u("div", null, [v[5] || (v[5] = u("p", {
                class: "text-gray-800 mb-2 pb-1 border-color-gray-100 border-b"
            }, [u("strong", null, "Days Late - 7 Year History")], -1)), d(N, {
                bureaus: t,
                account: K
            }, null, 8, ["account"])])], 2))), 128))], 64)) : I("", !0)], 2))), 128))])) : (s(),
            a("div", ge, "None Reported"))]), u("section", {
                ref: D => {
                    T.value["public-info"] = D
                }
                ,
                class: "mt-5"
            }, [v[6] || (v[6] = u("div", {
                class: "my-3"
            }, [u("h5", {
                class: "fw-bold"
            }, "Public Information")], -1)), e.value.length > 0 ? (s(),
            _(X, {
                key: 0,
                records: e.value,
                bureaus: t
            }, null, 8, ["records"])) : (s(),
            a("div", we, "None Reported"))], 512), u("section", {
                ref: D => {
                    T.value.inquiries = D
                }
                ,
                class: "mt-5"
            }, [v[10] || (v[10] = u("div", {
                class: "my-3"
            }, [u("h5", {
                class: "fw-bold"
            }, "Inquiries")], -1)), w.value.length ? (s(),
            a("div", pe, [u("div", ke, [d(E, {
                class: "font-bold"
            }, {
                default: i( () => v[7] || (v[7] = [r(" Creditor Name ")])),
                _: 1,
                __: [7]
            }), d(E, {
                class: "font-bold"
            }, {
                default: i( () => v[8] || (v[8] = [r(" Date of Inquiry ")])),
                _: 1,
                __: [8]
            }), d(E, {
                class: "font-bold"
            }, {
                default: i( () => v[9] || (v[9] = [r(" Credit Bureau ")])),
                _: 1,
                __: [9]
            })]), (s(!0),
            a(l, null, R(w.value, (D, q) => (s(),
            a("div", {
                key: q,
                class: "d-grid grid-cols-3 border-color-gray-100 border-b"
            }, [d(E, {
                "data-uw-ignore-translate": "true"
            }, {
                default: i( () => [r(m(D.Inquiry.subscriberName), 1)]),
                _: 2
            }, 1024), d(E, null, {
                default: i( () => [r(m(S.$filters.formatDate(D.Inquiry.inquiryDate)), 1)]),
                _: 2
            }, 1024), d(E, {
                "data-uw-ignore-translate": "true"
            }, {
                default: i( () => [r(m(D.Inquiry.bureau), 1)]),
                _: 2
            }, 1024)]))), 128))])) : (s(),
            a("div", $e, "None Reported"))], 512), u("section", {
                ref: D => {
                    T.value.creditors = D
                }
                ,
                class: "mt-5 border-color-gray-100 border-b"
            }, [u("div", ve, [u("h5", Te, [v[11] || (v[11] = r(" Creditor Contacts ")), Array.isArray(k.value.Subscriber) ? (s(),
            a("small", {
                key: 0,
                class: "creditor-toggle",
                onClick: v[0] || (v[0] = D => c.value = !c.value)
            }, [c.value ? (s(),
            a("span", Ce, "Hide")) : (s(),
            a("span", be, "Show"))])) : I("", !0)])]), Array.isArray(k.value.Subscriber) ? (s(),
            a("div", {
                key: 0,
                class: f(["creditor-contacts", {
                    expanded: c.value
                }])
            }, [u("div", Ae, [d(E, {
                class: "font-bold"
            }, {
                default: i( () => v[12] || (v[12] = [r(" Creditor Name ")])),
                _: 1,
                __: [12]
            }), d(E, {
                class: "font-bold"
            }, {
                default: i( () => v[13] || (v[13] = [r(" Address ")])),
                _: 1,
                __: [13]
            }), d(E, {
                class: "font-bold"
            }, {
                default: i( () => v[14] || (v[14] = [r(" Phone Number ")])),
                _: 1,
                __: [14]
            })]), (s(!0),
            a(l, null, R(k.value.Subscriber, (D, q) => (s(),
            a("div", {
                key: q,
                class: "d-grid grid-cols-3 border-color-gray-100 border-b"
            }, [d(E, {
                "data-uw-ignore-translate": "true"
            }, {
                default: i( () => [r(m(D.name), 1)]),
                _: 2
            }, 1024), d(E, {
                "data-uw-ignore-translate": "true"
            }, {
                default: i( () => [u("span", {
                    innerHTML: S.$filters.formatAddress(D.CreditAddress)
                }, null, 8, Se)]),
                _: 2
            }, 1024), d(E, null, {
                default: i( () => [r(m(D.telephone), 1)]),
                _: 2
            }, 1024)]))), 128))], 2)) : (s(),
            a("div", De, "None Reported"))], 512)]))
        }
    }
}
  , he = {
    key: 0,
    class: "text-center text-muted loader"
}
  , Re = {
    __name: "3b",
    props: {
        reportData: {
            type: Object,
            required: !0
        },
        loading: {
            type: Boolean,
            required: !0
        },
        actions3b: {
            type: Boolean,
            required: !0
        }
    },
    setup(o) {
        return ($, T) => {
            var g;
            const C = Pe;
            return s(),
            a(l, null, [o.loading ? (s(),
            a("div", he, T[0] || (T[0] = [u("h5", {
                class: "add-bottom"
            }, " Loading your 3-Bureau Credit Report & Scores... ", -1), u("i", {
                class: "fa fa-sync fa-spin fa-6x"
            }, null, -1)]))) : I("", !0), (g = o.reportData) != null && g.BundleComponent ? (s(),
            a("div", {
                key: 1,
                class: f(["report-container", {
                    fadein: !o.loading
                }])
            }, [(s(),
            _(it, null, [d(C, {
                "report-data": o.reportData
            }, null, 8, ["report-data"])], 1024))], 2)) : I("", !0)], 64)
        }
    }
};
typeof tt == "function" && tt(Re);
export {Re as default};
