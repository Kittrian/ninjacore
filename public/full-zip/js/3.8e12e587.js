(window.webpackJsonp = window.webpackJsonp || []).push([
    [3], {
        "713b": function(t, e, a) {
            "use strict";
            a.r(e);
            a("e9f5"), a("ab43");
            var i = a("9224"),
                s = {
                    name: "SystemVersion",
                    computed: {
                        cVersion: () => i.version
                    }
                },
                o = a("2877"),
                n = a("58a8"),
                r = a("eebe"),
                l = a.n(r),
                c = Object(o.a)(s, (function() {
                    var t = this._self._c;
                    return t("div", {
                        staticClass: "text-caption text-center bg-grey-1 q-pa-sm"
                    }, [this._v("\n  Version :\n  "), t("q-badge", {
                        attrs: {
                            align: "middle",
                            color: "primary"
                        }
                    }, [this._v("\n    v" + this._s(this.cVersion) + "\n  ")])], 1)
                }), [], !1, null, null, null),
                u = c.exports;
            l()(c, "components", {
                QBadge: n.a
            });
            a("5c26");
            var d = {
                    name: "EssentialLink",
                    data: () => ({
                        menuAtivo: "dashboard"
                    }),
                    props: {
                        title: {
                            type: String,
                            required: !0
                        },
                        caption: {
                            type: String,
                            default: ""
                        },
                        color: {
                            type: String,
                            default: ""
                        },
                        routeName: {
                            type: String,
                            default: "dashboard"
                        },
                        icon: {
                            type: String,
                            default: ""
                        }
                    },
                    computed: {
                        cRouterName() {
                            return this.$route.name
                        }
                    }
                },
                p = (a("c164"), a("66e5")),
                m = a("4074"),
                v = a("0016"),
                f = a("0170"),
                h = a("714f"),
                g = Object(o.a)(d, (function() {
                    var t = this,
                        e = t._self._c;
                    return e("q-item", {
                        directives: [{
                            name: "ripple",
                            rawName: "v-ripple"
                        }],
                        staticClass: "houverList",
                        class: {
                            "text-negative text-bolder": "negative" === t.color
                        },
                        attrs: {
                            clickable: "",
                            active: t.routeName == t.cRouterName,
                            "active-class": "bg-blue-1 text-grey-8 text-bold menu-link-active-item-top"
                        },
                        on: {
                            click: () => t.routeName != t.cRouterName ? t.$router.push({
                                name: t.routeName
                            }) : ""
                        }
                    }, [t.icon ? e("q-item-section", {
                        attrs: {
                            avatar: ""
                        }
                    }, [e("q-icon", {
                        attrs: {
                            name: "negative" === t.color ? "mdi-cellphone-nfc-off" : t.icon
                        }
                    })], 1) : t._e(), e("q-item-section", [e("q-item-label", [t._v(t._s(t.title))])], 1)], 1)
                }), [], !1, null, null, null),
                b = g.exports;
            l()(g, "components", {
                QItem: p.a,
                QItemSection: m.a,
                QIcon: v.a,
                QItemLabel: f.a
            }), l()(g, "directives", {
                Ripple: h.a
            });
            var q = a("5d20"),
                x = a("86e2"),
                y = a.n(x),
                S = a("b166"),
                k = a("25c4"),
                w = a("2f62"),
                _ = a("73ad"),
                O = a("7963"),
                N = a("7884"),
                I = (a("f665"), {
                    name: "cUserStatus",
                    props: {
                        usuario: {
                            type: Object,
                            default: () => {}
                        }
                    },
                    computed: {
                        cStatus() {
                            const t = this.usuario;
                            return this.statusOptions.find(e => e.value == t.status) || {}
                        }
                    },
                    data: () => ({
                        status: {},
                        statusOptions: [{
                            label: "Online",
                            value: "online",
                            icon: "mdi-account-check",
                            color: "positive"
                        }, {
                            label: "Offline",
                            value: "offline",
                            icon: "mdi-account-off",
                            color: "negative"
                        }]
                    }),
                    methods: {
                        updateStatus(t) {
                            const e = { ...this.usuario,
                                status: t
                            };
                            localStorage.setItem("usuario", JSON.stringify(e)), this.$emit("update:usuario", e), console.log("usuario", e)
                        }
                    }
                }),
                C = a("ddd8"),
                D = a("b047"),
                Q = a("cb32"),
                U = Object(o.a)(I, (function() {
                    var t = this,
                        e = t._self._c;
                    return e("div", [e("q-select", {
                        attrs: {
                            borderless: "",
                            dense: "",
                            rounded: "",
                            options: t.statusOptions,
                            "map-options": "",
                            "emit-value": ""
                        },
                        on: {
                            input: t.updateStatus
                        },
                        scopedSlots: t._u([{
                            key: "selected",
                            fn: function() {
                                return [e("div", {
                                    staticClass: "row full-width justify-center"
                                }, [e("q-chip", {
                                    staticClass: "q-my-none q-ml-sm q-mr-none q-py-md",
                                    attrs: {
                                        color: "grey-3",
                                        "text-color": "primary"
                                    }
                                }, [e("q-avatar", {
                                    attrs: {
                                        color: t.cStatus.color,
                                        "text-color": "white",
                                        size: "40px",
                                        icon: t.cStatus.icon,
                                        rounded: ""
                                    }
                                }), t._v("\n          " + t._s(t.cStatus.label) + "\n        ")], 1)], 1)]
                            },
                            proxy: !0
                        }]),
                        model: {
                            value: t.usuario.status,
                            callback: function(e) {
                                t.$set(t.usuario, "status", e)
                            },
                            expression: "usuario.status"
                        }
                    })], 1)
                }), [], !1, null, null, null),
                A = U.exports;
            l()(U, "components", {
                QSelect: C.a,
                QChip: D.a,
                QAvatar: Q.a
            });
            var $ = a("29b2");
            const L = localStorage.getItem("username"),
                P = Object($.a)(),
                E = [{
                    title: "Clients",
                    caption: "List of clients",
                    icon: "mdi-card-account-mail",
                    routeName: "clients"
                }, {
                    title: "Letters",
                    caption: "List of letters",
                    icon: "mdi-mail",
                    routeName: "letters"
                }, {
                    title: "Dispute Template",
                    caption: "List of dispute template",
                    icon: "mdi-mail",
                    routeName: "template"
                }, {
                    title: "Alternate Letters",
                    caption: "List of alternate letters",
                    icon: "mdi-mail",
                    routeName: "alternate"
                }, {
                    title: "Creditor Contacts",
                    caption: "List of creaditor contacts",
                    icon: "mdi-mail",
                    routeName: "creditor"
                }],
                j = [{
                    title: "Users",
                    caption: "User admin",
                    icon: "mdi-account-group",
                    routeName: "usuarios"
                }];
            var M = {
                    name: "MainLayout",
                    mixins: [q.a],
                    components: {
                        EssentialLink: b,
                        ModalUsuario: k.a,
                        cStatusUsuario: A,
                        cSystemVersion: u
                    },
                    data: () => ({
                        username: L,
                        domainExperimentalsMenus: ["@mercy.io"],
                        miniState: !0,
                        userProfile: "user",
                        modalUsuario: !1,
                        usuario: {},
                        alertSound: y.a,
                        leftDrawerOpen: !1,
                        menuData: E,
                        options: [],
                        menuDataAdmin: j,
                        search: "",
                        params: {
                            sortBy: "nextReminder",
                            descending: !0,
                            pageNumber: 1,
                            searchParam: "",
                            hasMore: !0
                        }
                    }),
                    computed: { ...Object(w.b)(["whatsapps"]),
                        cProblemaConexao() {
                            return -1 !== this.whatsapps.findIndex(t => ["PAIRING", "TIMEOUT", "DISCONNECTED"].includes(t.status))
                        },
                        cQrCode() {
                            return -1 !== this.whatsapps.findIndex(t => "qrcode" === t.status || "DESTROYED" === t.status)
                        },
                        cOpening() {
                            return -1 !== this.whatsapps.findIndex(t => "OPENING" === t.status)
                        },
                        cUsersApp() {
                            return this.$store.state.usersApp
                        },
                        cObjMenu() {
                            return this.cProblemaConexao ? E.map(t => ("sessoes" === t.routeName && (t.color = "negative"), t)) : E
                        }
                    },
                    methods: {
                        searchResult(t) {
                            t && this.$router.push({
                                name: "dispute",
                                params: {
                                    clientId: t.id
                                }
                            })
                        },
                        getLastSsn(t) {
                            const e = t.ssn;
                            let a = "";
                            if (e) {
                                const t = null == e ? void 0 : e.split("-");
                                a += "SSN - " + t[t.length - 1]
                            }
                            a += " // DOB ";
                            return a += Object(S.a)(new Date(t.dob), "MM-dd-yyyy"), a
                        },
                        async filterFn(t, e) {
                            if ("" === t) return void e(() => {
                                this.options = []
                            });
                            this.params.searchParam = t;
                            const {
                                data: a
                            } = await Object(_.i)(this.params);
                            e(() => {
                                var t;
                                this.options = null === (t = a.clients) || void 0 === t ? void 0 : t.map(t => (t.name = t.first_name + " " + t.last_name, t))
                            })
                        },
                        exibirMenuBeta(t) {
                            if (null == t || !t.isBeta) return !0;
                            for (const t of this.domainExperimentalsMenus) {
                                var e;
                                if (null !== (e = this.usuario) && void 0 !== e && e.email && -1 !== this.usuario.email.indexOf(t)) return !0
                            }
                            return !1
                        },
                        async listarWhatsapps() {
                            this.$store.commit("LOAD_WHATSAPPS", [])
                        },
                        handlerNotifications(t) {
                            const {
                                message: e,
                                contact: a,
                                ticket: i
                            } = t, s = {
                                body: `${e.body} - ${Object(S.a)(new Date,"HH:mm")}`,
                                icon: a.profilePicUrl,
                                tag: i.id,
                                renotify: !0
                            };
                            new Notification("Mensagem de " + a.name, s).onclick = t => {
                                t.preventDefault(), window.focus(), this.$store.dispatch("AbrirChatMensagens", i), this.$router.push({
                                    name: "atendimento"
                                })
                            }, this.$nextTick(() => {
                                this.$refs.audioNotification.play()
                            })
                        },
                        async abrirModalUsuario() {
                            this.modalUsuario = !0
                        },
                        async efetuarLogout() {
                            try {
                                await Object(N.b)(this.usuario), localStorage.removeItem("token"), localStorage.removeItem("username"), localStorage.removeItem("profile"), localStorage.removeItem("userId"), localStorage.removeItem("queues"), localStorage.removeItem("usuario"), localStorage.removeItem("filtrosAtendimento"), null != P && P.connected && (null == P || P.disconnect()), this.$router.go({
                                    name: "login",
                                    replace: !0
                                })
                            } catch (t) {
                                this.$notificarErro("Tidak dapat melakukan logout", t)
                            }
                        },
                        async listarConfiguracoes() {
                            const {
                                data: t
                            } = await Object(O.b)();
                            localStorage.setItem("configuracoes", JSON.stringify(t))
                        },
                        conectarSocket(t) {
                            t && t.tenantId ? null == P || P.on(t.tenantId + ":chat:updateOnlineBubbles", t => {
                                this.$store.commit("SET_USERS_APP", t)
                            }) : console.warn("Usuario atau tenantId tidak tersedia untuk koneksi socket di MainLayout.")
                        },
                        atualizarUsuario() {
                            const t = localStorage.getItem("usuario");
                            t && (this.usuario = JSON.parse(t), "offline" === this.usuario.status ? null == P || P.emit(this.usuario.tenantId + ":setUserIdle") : "online" === this.usuario.status && (null == P || P.emit(this.usuario.tenantId + ":setUserActive")))
                        }
                    },
                    async mounted() {
                        this.atualizarUsuario(), await this.listarWhatsapps(), "Notification" in window && Notification.requestPermission(), null != P && P.connected || null == P || P.connect(), this.usuario = JSON.parse(localStorage.getItem("usuario")), this.userProfile = localStorage.getItem("profile"), await this.conectarSocket(this.usuario)
                    }
                },
                T = a("4d5a"),
                R = a("e359"),
                B = a("65c6"),
                z = a("9c40"),
                J = a("05c0"),
                H = a("068f"),
                V = a("2c91"),
                F = a("4e73"),
                W = a("1c1c"),
                G = a("9564"),
                Y = a("eb85"),
                K = a("9404"),
                X = a("4983"),
                Z = a("09e3"),
                tt = a("9989"),
                et = a("7f67"),
                at = Object(o.a)(M, (function() {
                    var t, e, a, i = this,
                        s = i._self._c;
                    return s("q-layout", {
                        attrs: {
                            view: "hHh Lpr lFf"
                        }
                    }, [s("q-header", {
                        staticClass: "bg-white text-grey-8 q-py-xs",
                        attrs: {
                            "height-hint": "58",
                            bordered: ""
                        }
                    }, [s("q-toolbar", [s("q-btn", {
                        attrs: {
                            flat: "",
                            dense: "",
                            round: "",
                            "aria-label": "Menu",
                            icon: "menu"
                        },
                        on: {
                            click: function(t) {
                                i.leftDrawerOpen = !i.leftDrawerOpen
                            }
                        }
                    }, [s("q-tooltip", [i._v("Menu")])], 1), i.$q.screen.gt.xs ? s("q-btn", {
                        staticClass: "q-ml-sm q-pa-none",
                        attrs: {
                            flat: "",
                            "no-caps": "",
                            "no-wrap": "",
                            dense: ""
                        }
                    }, [i.$q.dark.isActive ? s("q-img", {
                        staticStyle: {
                            "max-height": "50px !important",
                            width: "180px",
                            "margin-right": "-45px"
                        },
                        attrs: {
                            src: "/logo3-no-bg.png",
                            "spinner-color": "primary",
                            fit: "contain"
                        }
                    }) : s("q-img", {
                        staticStyle: {
                            "max-height": "50px !important",
                            width: "180px",
                            "margin-right": "-45px"
                        },
                        attrs: {
                            src: "/logo3.png",
                            "spinner-color": "primary",
                            fit: "contain"
                        }
                    })], 1) : i._e(), s("q-space"), s("q-select", {
                        staticStyle: {
                            width: "400px",
                            "max-width": "50vw"
                        },
                        attrs: {
                            outlined: "",
                            dense: "",
                            rounded: "",
                            "use-input": "",
                            "input-debounce": "500",
                            label: "Search Client",
                            options: i.options,
                            behavior: "menu",
                            "option-label": "name",
                            "emit-value": "",
                            "map-options": "",
                            "hide-dropdown-icon": "",
                            clearable: ""
                        },
                        on: {
                            filter: i.filterFn,
                            input: i.searchResult
                        },
                        scopedSlots: i._u([{
                            key: "prepend",
                            fn: function() {
                                return [s("q-icon", {
                                    attrs: {
                                        name: "search"
                                    }
                                })]
                            },
                            proxy: !0
                        }, {
                            key: "no-option",
                            fn: function() {
                                return [s("q-item", [s("q-item-section", {
                                    staticClass: "text-grey"
                                }, [i._v(" Client not found ")])], 1)]
                            },
                            proxy: !0
                        }, {
                            key: "option",
                            fn: function(t) {
                                return [s("q-item", i._g(i._b({}, "q-item", t.itemProps, !1), t.itemEvents), [s("q-item-section", {
                                    attrs: {
                                        avatar: ""
                                    }
                                }, [s("q-icon", {
                                    attrs: {
                                        name: "img:account.png"
                                    }
                                })], 1), s("q-item-section", [s("q-item-label", [i._v(i._s(t.opt.first_name) + " " + i._s(t.opt.last_name))]), s("q-item-label", {
                                    attrs: {
                                        caption: ""
                                    }
                                }, [i._v(i._s(i.getLastSsn(t.opt)) + " ")])], 1)], 1)]
                            }
                        }]),
                        model: {
                            value: i.search,
                            callback: function(t) {
                                i.search = t
                            },
                            expression: "search"
                        }
                    }), s("q-space"), s("div", {
                        staticClass: "q-gutter-sm row items-center no-wrap"
                    }, [s("q-btn", {
                        attrs: {
                            round: "",
                            dense: "",
                            flat: "",
                            color: "grey-8",
                            icon: "notifications"
                        }
                    }, [s("q-badge", {
                        attrs: {
                            color: "red",
                            "text-color": "white",
                            floating: ""
                        }
                    }, [i._v(" 2 ")]), s("q-tooltip", [i._v("Notifications (coming soon)")])], 1), s("q-avatar", {
                        staticClass: "q-ml-lg",
                        attrs: {
                            color: "offline" === (null === (t = i.usuario) || void 0 === t ? void 0 : t.status) ? "negative" : "positive",
                            "text-color": "white",
                            size: "25px",
                            icon: "offline" === (null === (e = i.usuario) || void 0 === e ? void 0 : e.status) ? "mdi-account-off" : "mdi-account-check",
                            rounded: ""
                        }
                    }, [s("q-tooltip", [i._v("\n            " + i._s("offline" === (null === (a = i.usuario) || void 0 === a ? void 0 : a.status) ? "User Offline" : "User Online") + "\n          ")])], 1), s("q-btn", {
                        staticClass: "bg-padrao text-bold q-mx-sm q-ml-lg",
                        attrs: {
                            round: "",
                            flat: ""
                        }
                    }, [s("q-avatar", {
                        attrs: {
                            size: "26px"
                        }
                    }, [i._v("\n            " + i._s(i.$iniciaisString(i.username)) + "\n          ")]), s("q-menu", [s("q-list", {
                        staticStyle: {
                            "min-width": "100px"
                        }
                    }, [s("q-item-label", {
                        attrs: {
                            header: ""
                        }
                    }, [i._v("\n                Hello! "), s("b", [i._v(" " + i._s(i.username) + " ")])]), s("q-item", {
                        directives: [{
                            name: "close-popup",
                            rawName: "v-close-popup"
                        }],
                        attrs: {
                            clickable: ""
                        }
                    }, [s("q-item-section", [s("q-toggle", {
                        attrs: {
                            color: "blue",
                            value: i.$q.dark.isActive,
                            label: "Dark mode"
                        },
                        on: {
                            input: function(t) {
                                return i.$setConfigsUsuario({
                                    isDark: !i.$q.dark.isActive
                                })
                            }
                        }
                    })], 1)], 1), s("cStatusUsuario", {
                        attrs: {
                            usuario: i.usuario
                        },
                        on: {
                            "update:usuario": i.atualizarUsuario
                        }
                    }), s("q-item", {
                        directives: [{
                            name: "close-popup",
                            rawName: "v-close-popup"
                        }],
                        attrs: {
                            clickable: ""
                        },
                        on: {
                            click: i.abrirModalUsuario
                        }
                    }, [s("q-item-section", [i._v("Profile")])], 1), s("q-item", {
                        directives: [{
                            name: "close-popup",
                            rawName: "v-close-popup"
                        }],
                        attrs: {
                            clickable: ""
                        },
                        on: {
                            click: i.efetuarLogout
                        }
                    }, [s("q-item-section", [i._v("Logout")])], 1), s("q-separator"), s("q-item", [s("q-item-section", [s("cSystemVersion")], 1)], 1)], 1)], 1), s("q-tooltip", [i._v("User")])], 1)], 1)], 1)], 1), s("q-drawer", {
                        attrs: {
                            "show-if-above": "",
                            bordered: "",
                            mini: i.miniState,
                            "mini-to-overlay": "",
                            "content-class": "bg-white text-grey-9"
                        },
                        on: {
                            mouseover: function(t) {
                                i.miniState = !1
                            },
                            mouseout: function(t) {
                                i.miniState = !0
                            }
                        },
                        model: {
                            value: i.leftDrawerOpen,
                            callback: function(t) {
                                i.leftDrawerOpen = t
                            },
                            expression: "leftDrawerOpen"
                        }
                    }, [s("q-scroll-area", {
                        staticClass: "fit"
                    }, [s("q-list", {
                        key: i.userProfile,
                        attrs: {
                            padding: ""
                        }
                    }, [s("q-item-label", {
                        staticClass: "text-grey-8",
                        attrs: {
                            header: ""
                        }
                    }, [i._v(" Menu ")]), i._l(i.menuData, (function(t) {
                        return s("EssentialLink", i._b({
                            key: t.title
                        }, "EssentialLink", t, !1))
                    })), "admin" === i.userProfile ? s("div", [s("q-separator", {
                        attrs: {
                            spaced: ""
                        }
                    }), s("div", {
                        staticClass: "q-mb-lg"
                    }), i._l(i.menuDataAdmin, (function(t) {
                        return [i.exibirMenuBeta(t) ? s("EssentialLink", i._b({
                            key: t.title
                        }, "EssentialLink", t, !1)) : i._e()]
                    }))], 2) : i._e()], 2)], 1), s("div", {
                        staticClass: "absolute-bottom text-center row justify-start",
                        class: {
                            "bg-grey-3": i.$q.dark.isActive
                        },
                        staticStyle: {
                            height: "40px"
                        }
                    }, [s("q-toggle", {
                        staticClass: "text-bold q-ml-xs",
                        attrs: {
                            size: "xl",
                            "keep-color": "",
                            dense: "",
                            "icon-color": i.$q.dark.isActive ? "black" : "white",
                            value: i.$q.dark.isActive,
                            color: i.$q.dark.isActive ? "grey-3" : "black",
                            "checked-icon": "mdi-white-balance-sunny",
                            "unchecked-icon": "mdi-weather-sunny"
                        },
                        on: {
                            input: function(t) {
                                return i.$setConfigsUsuario({
                                    isDark: !i.$q.dark.isActive
                                })
                            }
                        }
                    }, [s("q-tooltip", {
                        attrs: {
                            "content-class": "text-body1 hide-scrollbar"
                        }
                    }, [i._v("\n          " + i._s(i.$q.dark.isActive ? "Deactivated" : "Activated") + " Dark Mode\n        ")])], 1)], 1)], 1), s("q-page-container", [s("q-page", {
                        staticClass: "q-pa-xs"
                    }, [s("router-view")], 1)], 1), s("audio", {
                        ref: "audioNotification"
                    }, [s("source", {
                        attrs: {
                            src: i.alertSound,
                            type: "audio/mp3"
                        }
                    })]), s("ModalUsuario", {
                        attrs: {
                            isProfile: !0,
                            modalUsuario: i.modalUsuario,
                            usuarioEdicao: i.usuario
                        },
                        on: {
                            "update:modalUsuario": function(t) {
                                i.modalUsuario = t
                            },
                            "update:modal-usuario": function(t) {
                                i.modalUsuario = t
                            },
                            "update:usuarioEdicao": function(t) {
                                i.usuario = t
                            },
                            "update:usuario-edicao": function(t) {
                                i.usuario = t
                            }
                        }
                    })], 1)
                }), [], !1, null, null, null);
            e.default = at.exports;
            l()(at, "components", {
                QLayout: T.a,
                QHeader: R.a,
                QToolbar: B.a,
                QBtn: z.a,
                QTooltip: J.a,
                QImg: H.a,
                QSpace: V.a,
                QSelect: C.a,
                QIcon: v.a,
                QItem: p.a,
                QItemSection: m.a,
                QItemLabel: f.a,
                QBadge: n.a,
                QAvatar: Q.a,
                QMenu: F.a,
                QList: W.a,
                QToggle: G.a,
                QSeparator: Y.a,
                QDrawer: K.a,
                QScrollArea: X.a,
                QPageContainer: Z.a,
                QPage: tt.a
            }), l()(at, "directives", {
                ClosePopup: et.a
            })
        },
        9224: function(t) {
            t.exports = JSON.parse('{"name":"mercy","version":"1.9.0","description":"Bureau Credit Report & Scores | Dispute - Ninja","productName":"mercy","author":"Durans <lumardyelson@gmail.com>","private":false,"scripts":{"lint":"eslint --ext .js,.vue ./","test":"echo \\"No test specified\\" && exit 0","d":"set NODE_OPTIONS=--openssl-legacy-provider && quasar build","w":"set NODE_OPTIONS=--openssl-legacy-provider && quasar dev","q":"export NODE_OPTIONS=--openssl-legacy-provider && quasar dev","m":"export NODE_OPTIONS=--openssl-legacy-provider && quasar build","start":"serve -s dist/spa -l 4449"},"dependencies":{"@quasar/extras":"^1.15.6","apexcharts":"^3.32.0","axios":"^0.18.1","core-js":"^3.6.5","country-codes-list":"^1.6.10","date-fns":"^2.16.1","dotenv":"^16.0.3","drawflow":"0.0.53","html2pdf.js":"0.9.1","js-base64":"^3.7.2","katex":"^0.11.1","libphonenumber-js":"^1.10.30","lodash":"^4.17.20","mermaid":"^8.4.8","mic-recorder-to-mp3":"^2.2.2","mustache":"^4.2.0","printd":"^1.4.2","prosemirror-tables":"^1.1.1","prosemirror-utils":"^1.0.0-0","qrcode.vue":"^1.7.0","quasar":"^1.22.2","quasar-tiptap":"^1.4.2","sass":"^1.63.6","socket.io-client":"^3.0.5","tiptap":"^1.26.8","tiptap-extension-font-size":"^1.2.0","tiptap-extensions":"^1.28.8","v-emoji-picker":"^2.3.1","vdata-parser":"^0.1.5","vue":"^2.6.11","vue-apexcharts":"^1.6.2","vue-codemirror":"^4.0.6","vue-easy-lightbox":"^0.14.0","vue-facebook-login-component":"^4.0.2","vue-html2pdf":"^1.8.0","vue-infinite-loading":"^2.4.5","vue-linkify":"^1.0.1","vue-loader":"^15.10.1","vuedraggable":"^2.24.3","vuelidate":"^0.7.6","vuelidate-error-extractor":"^2.4.1","xlsx":"^0.16.9"},"devDependencies":{"@babel/plugin-proposal-optional-chaining":"^7.18.9","@quasar/app":"^2.4.3","babel-eslint":"^10.0.1","eslint":"^6.8.0","eslint-config-standard":"^14.1.0","eslint-loader":"^3.0.3","eslint-plugin-import":"^2.14.0","eslint-plugin-node":"^11.0.0","eslint-plugin-promise":"^4.0.1","eslint-plugin-standard":"^4.0.0","eslint-plugin-vue":"^6.1.2","html-webpack-inline-source-plugin":"1.0.0-beta.2","html-webpack-plugin":"4.0.0-beta.4","quasar-app-extension-qdatetimepicker":"^1.0.0-rc.17","workbox-webpack-plugin":"^5.1.4"},"browserslist":["last 10 Chrome versions","last 10 Firefox versions","last 4 Edge versions","last 7 Safari versions","last 8 Android versions","last 8 ChromeAndroid versions","last 8 FirefoxAndroid versions","last 10 iOS versions","last 5 Opera versions"],"engines":{"node":">= 10.18.1","npm":">= 6.13.4","yarn":">= 1.21.1"}}')
        },
        bd58: function(t, e, a) {},
        c164: function(t, e, a) {
            "use strict";
            a("bd58")
        }
    }
]);