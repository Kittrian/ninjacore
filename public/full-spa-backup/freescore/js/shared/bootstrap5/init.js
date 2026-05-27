const langRegex = new RegExp(/^[a-z]{2,3}(-[A-Z]{2})?$/);

window.addEventListener("load", async () => {
  await setSiteLanguage();
//   loadGTMScript();

  // Sidebar toggler
  let sidebarBtn = document.getElementById("sidebar-toggler"),
    sidebar = document.getElementById("sidebar");

  if (sidebarBtn) {
    sidebarBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (jQuery(".dropdown-menu").hasClass("show")) {
        jQuery(".dropdown-toggle").dropdown("hide");
      }
      sidebar.classList.toggle("moving");
      if (sidebar.classList.contains("show")) {
        document.removeEventListener("click", (e) => {
          outsideClickListener(e, sidebar);
        });
      } else {
        document.addEventListener("click", (e) => {
          outsideClickListener(e, sidebar);
        });
      }
      sidebar.classList.toggle("show");
      sidebar.classList.toggle("moving");
    });
  }

  /*
   * GDPR/CCPA cookie alert
   */
  if (!Cookies.get("cookie-disclaimer-alert")) {
    // const cookieAlert = document.getElementById("cookie-disclaimer-alert");
    // cookieAlert.classList.toggle("d-none");
    // cookieAlert.addEventListener("click", () => {
    //   create_display_cookie("cookie-disclaimer-alert", true, false, 30, "/");
    //   cookieAlert.classList.toggle("d-none");
    // });
  }

  /*
   * Init auto log out script for logged in members
   */
  if (
    document.body.classList.contains("logged-in") &&
    window.location == window.parent.location
  ) {
    // start_idletimeout();
  }

  /*
   * Initialize co-brand message popover.
   */

  if (document.getElementById("cobrand-message-container")) {
    let cobrandPopover = document.querySelectorAll(
      ".cobrand-parent .brand-link"
    );
    cobrandPopover.forEach((popover) => {
      new bootstrap.Popover(popover, {
        placement: "auto",
        offset: [0, 30],
        trigger: "focus",
        html: true,
        title: "Special Message",
        container: "body",
        content: document.getElementById("cobrand-message-container"),
        template:
          '<div class="popover cobrand-message" role="tooltip"><div class="popover-arrow"></div><h3 class="popover-header"></h3><div class="popover-body"></div></div>',
      });
    });
  }

  /*
   * Init reactivation link for closed pending members
   */
  $(".reactivate-link").click(function () {
    const reactivateBtn = document.getElementById("reactivate-link");
    reactivateBtn.disabled = true;
    reactivateBtn.textContent = reactivateBtn.dataset.loadingText;

    var companyName = $("#resubscribe-confirm-modal-company-name").text();

    $(document.body).append(
      `<div class="modal fade resubscribe-confirm-modal" id="success-modal" tabindex="-1" role="dialog" aria-label="Resubscribe confirmation">
            <div class="modal-dialog modal-dialog-centered" role="document">
                <div class="modal-body">
                   <button type="button" data-bs-dismiss="modal" aria-label="Close" class="close float-end">
                        <img src="/resources/images/sc/shared/header-x.svg" alt="Close">
                    </button>
                    <div class="resubscribe-confirm-modal-content">
                        <h3 class="modal-title mb-3">Your Account Has Been Reactivated.</h3><p class="remove-bottom mb-3">Thank you for being a valued member of ${companyName}. We're excited to continue helping you reach your full financial potential.</p>
                        <div class="mt-5">
                           <a href="/member/home/" class="btn btn-sc btn-lg d-block m-auto" data-dismiss="modal">Dismiss</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>`
    );
    $(document.body).append(
      `<div class="modal fade resubscribe-confirm-modal" id="failure-modal" tabindex="-1" role="dialog" aria-label="Resubscribe confirmation">
      <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-body">
             <button type="button" data-bs-dismiss="modal" aria-label="Close" class="close float-end">
                        <img src="/resources/images/sc/shared/header-x.svg" alt="Close">
                    </button>
              <div class="resubscribe-confirm-modal-content">
                  <h3 class="modal-title mb-3">Unable to Reactivate Account.</h3><p class="remove-bottom mb-3">TThere was a problem reactivating your account. Please contact customer support.</p>
                  <div class="mt-5">
                     <button type="button" class="btn btn-sc btn-lg d-block m-auto" type="button" data-dismiss="modal">Dismiss</button>
                  </div>
              </div>
          </div>
      </div>
  </div>`
    );

    const reactivateModal = bootstrap.Modal.getInstance(
      document.getElementById("resubscribe-confirm-modal")
    );
    const successModal = bootstrap.Modal.getOrCreateInstance(
      document.getElementById("success-modal")
    );
    const failureModal = bootstrap.Modal.getOrCreateInstance(
      document.getElementById("failure-modal")
    );

    $.ajax({
      type: "POST",
      url: "/member/account/reactivation/closed-pending",
      dataType: "json",
      context: $(this),
      success: function (data, textStatus) {
        if (data.success) {
          reactivateModal.hide();
          $("#header-alert").remove();
          sessionStorage.setItem("closeWizardReactivationMessage", "true");
          window.location.href = "/member/home/";
        } else {
          failureModal.show();
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        reactivateModal.hide();
        failureModal.show();
      },
    });
  });
});

function updateForLangChange(lang) {
  //Desktop
  document.querySelector("header .active-lang-code").textContent =
    languages[lang].displayCode;

  if (!document.getElementById("translated-disclaimer")) {
    const headerLanguageDropdown = document.querySelector(
      "header .language-dropdown ul"
    );
    const newHeaderLi = document.createElement("li");
    newHeaderLi.id = "translated-disclaimer";
    newHeaderLi.style.borderTop = "1px solid #EAECF0";
    newHeaderLi.style.fontSize = "13px";
    newHeaderLi.style.fontWeight = "normal";
    newHeaderLi.style.margin = "0 20px";
    newHeaderLi.style.padding = "15px 0";
    newHeaderLi.textContent = "SmartCredit.com is Written in English";
    headerLanguageDropdown.appendChild(newHeaderLi);
  }

  const existingLi = Array.from(
    document.querySelectorAll("header .language-dropdown li a")
  ).find((a) => a.dataset.lang === lang)?.parentElement;

  if (existingLi) {
    const dropdownHeader = document.querySelector("header .dropdown-header");
    dropdownHeader.insertAdjacentElement("afterend", existingLi);
    const activeLang = document.querySelector("header .active-lang");
    activeLang.querySelector("a").href =
      "?lang=" + activeLang.querySelector("a").dataset.lang;
    activeLang.classList.remove("active-lang");
    existingLi.classList.add("active-lang");
  } else {
    const activeLang = document.querySelector("header .active-lang");
    const newLi = activeLang.cloneNode(true);
    newLi.classList.remove("active-lang");
    newLi.querySelector("a").href =
      "?lang=" + newLi.querySelector("a").dataset.lang;
    activeLang.querySelector("span").textContent = languages[lang].displayText;
    activeLang.querySelector("a").dataset.lang = lang;
    activeLang.insertAdjacentElement("afterend", newLi);
  }

  // Mobile
  document.querySelector("#sidebar .active-lang-code").textContent =
    languages[lang].displayCode;

  if (!document.getElementById("translated-disclaimer-mobile")) {
    const sidebarLanguageDropdown = document.querySelector(
      "#sidebar .language-dropdown ul"
    );
    const newSidebarLi = document.createElement("li");
    newSidebarLi.id = "translated-disclaimer-mobile";
    newSidebarLi.style.borderTop = "1px solid #EAECF0";
    newSidebarLi.style.fontSize = "13px";
    newSidebarLi.style.fontWeight = "normal";
    newSidebarLi.style.margin = "0 15px";
    newSidebarLi.style.padding = "15px 0";
    newSidebarLi.textContent = "SmartCredit.com is Written in English";
    sidebarLanguageDropdown.appendChild(newSidebarLi);
  }

  const existingLiMobile = Array.from(
    document.querySelectorAll("#sidebar .language-dropdown li a")
  ).find((a) => a.dataset.lang === lang)?.parentElement;

  if (existingLiMobile) {
    const dropdownHeaderMobile = document.querySelector(
      "#sidebar .dropdown-header"
    );
    dropdownHeaderMobile.insertAdjacentElement("afterend", existingLiMobile);
    const activeLangMobile = document.querySelector("#sidebar .active-lang");
    activeLangMobile.querySelector("a").href =
      "?lang=" + activeLangMobile.querySelector("a").dataset.lang;
    activeLangMobile.classList.remove("active-lang");
    existingLiMobile.classList.add("active-lang");
  } else {
    const activeLangMobile = document.querySelector("#sidebar .active-lang");
    const newLiMobile = activeLangMobile.cloneNode(true);
    newLiMobile.classList.remove("active-lang");
    newLiMobile.querySelector("a").href =
      "?lang=" + newLiMobile.querySelector("a").dataset.lang;
    activeLangMobile.querySelector("span").textContent =
      languages[lang].displayText;
    activeLangMobile.querySelector("a").dataset.lang = lang;
    activeLangMobile.insertAdjacentElement("afterend", newLiMobile);
  }

  const params = new URLSearchParams(document.location.search)
  
  if (typeof dataLayer != "undefined" && !params.has("lang")) {
    dataLayer.push({
      event: "languageSelectionMade",
      language: lang,
    });
  }

  params.delete('lang')

  window.history.replaceState({}, document.title, `${window.location.pathname}?${params.toString()}`);
}

function showTranslatedDisclaimer() {
  if (!document.getElementById("translated-disclaimer")) return;

  document.getElementById("translated-disclaimer").classList.remove("hidden");

  document
    .getElementById("close-disclaimer")
    .addEventListener("click", function () {
      document.getElementById("translated-disclaimer").classList.add("hidden");
      sessionStorage.setItem("smartcredito-disclaimer", "false");
    });
}

function languageChangeWatcher() {
  const targetNode = document.querySelector(".more-languages-btn");

  if (targetNode) {
    // Create an observer instance
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "characterData") {
          updateForLangChange(localStorage.getItem("userway-selectedLang"));
        }
      }
    });

    // Configure the observer
    const config = {
      childList: true,
      subtree: true,
      characterData: true,
    };

    // Start observing
    observer.observe(targetNode, config);
  }
}

function handleLangChange(e) {
  if (e.currentTarget.classList.contains("more-languages-btn")) {
    return;
  }

  e.preventDefault();
  const lang = e.currentTarget.dataset.lang;

  if (langRegex.test(lang)) {
    localStorage.setItem("userway-selectedSiteLang", lang);
    localStorage.setItem("userway-selectedLang", lang);
  }

  location.reload();
}

const setSiteLanguage = () => {
  const langLinks = document.querySelectorAll("[data-lang]");

  langLinks.forEach((el) => el.addEventListener("click", handleLangChange));

  if (sessionStorage.getItem("smartcredito-disclaimer") === "true") {
    showTranslatedDisclaimer();
  }

  return new Promise((resolve) => {
    /**
     * Language switcher for UserWay
     */
    const params = new URLSearchParams(document.location.search);
    const lang =
      params.get("lang") || localStorage.getItem("userway-selectedLang");

    if (langRegex.test(lang)) {
      localStorage.setItem("userway-selectedSiteLang", lang);
      localStorage.setItem("userway-selectedLang", lang);

      // smartcredito redirect
      if (params.get("lang") === "es") {
        sessionStorage.setItem("smartcredito-disclaimer", "true");
        showTranslatedDisclaimer();
      }
    }

    languageChangeWatcher();

    resolve();
  });
};

const outsideClickListener = (e, target) => {
  if (!target.contains(e.target)) {
    target.classList.remove("show");
  }
};

/**
 * Shortcut to create and store a display cookie
 * using the jquery cookie library.  Display
 * cookies are useful for screens that popup on
 * page load and can be dismissed.
 */
const create_display_cookie = (id, visible, session, expires, path) => {
  if (typeof Cookies == "function") {
    var parameters = { path: path, secure: true, sameSite: "None" };
    if (!session) parameters.expires = expires != null ? expires : 30;
    Cookies.set(id, visible, parameters);
  }
};

const start_idletimeout = () => {
  $.sessionTimeout({
    keepAliveUrl: "/keepalive.jsp",
    redirUrl: "/auto-logout.htm?role=" + role,
    warnAfter: 900000,
    redirAfter: 960000,
    keepAliveInterval: 200000,
    title: "You are about to be signed out",
    modalTitle: "Auto Logout",
    keepAliveButton: "Stay Logged In",
  });
};

/**
 ********************************************************
 * Sets header alert functionality and initializes
 ********************************************************
 */
const initHeaderAlertScripts = () => {
  if (
    localStorage.getItem("headerAlertClosed") !== "true" &&
    document.location.pathname !== "/member/account/membership-options/"
  ) {
    $("#header-alert").show();
  }

  $("#header-alert .header-alert__close").click(function () {
    $("#header-alert").slideUp();
    localStorage.setItem("headerAlertClosed", "true");
  });
};

window.addEventListener("load", (event) => {
  if ($("#header-alert").length) {
    initHeaderAlertScripts();
  }
});
const languages = {
  "en-US": {
    displayCode: "EN",
    displayText: "English (USA)",
  },
  az: {
    displayCode: "AZ",
    displayText: "Azerbaijani (Azeri)",
  },
  id: {
    displayCode: "ID",
    displayText: "Bahasa Indonesia (Indonesian)",
  },
  eu: {
    displayCode: "EU",
    displayText: "Basque (Basque)",
  },
  ca: {
    displayCode: "CA",
    displayText: "Catalan (CatalÃ )",
  },
  ceb: {
    displayCode: "CE",
    displayText: "Cebuano (Filipino)",
  },
  cs: {
    displayCode: "CS",
    displayText: "ÄŒeÅ¡tina (Czech)",
  },
  ht: {
    displayCode: "HT",
    displayText: "Creole (Haitian)",
  },
  mgo: {
    displayCode: "ME",
    displayText: "Crnogorski (Montenegrin)",
  },
  cy: {
    displayCode: "CY",
    displayText: "Cymraeg (Welsh)",
  },
  da: {
    displayCode: "DA",
    displayText: "Dansk (Danish)",
  },
  de: {
    displayCode: "DE",
    displayText: "Deutsch (German)",
  },
  et: {
    displayCode: "ET",
    displayText: "Eesti keel (Estonian)",
  },
  "en-AU": {
    displayCode: "AU",
    displayText: "English (Australian)",
  },
  "en-GB": {
    displayCode: "GB",
    displayText: "English (United Kingdom)",
  },
  "es-MX": {
    displayCode: "MX",
    displayText: "EspaÃ±ol (Mexico)",
  },
  es: {
    displayCode: "ES",
    displayText: "EspaÃ±ol (Spanish)",
  },
  fo: {
    displayCode: "FO",
    displayText: "FÃ¸royskt (Faroese)",
  },
  fr: {
    displayCode: "FR",
    displayText: "FranÃ§ais (French)",
  },
  sm: {
    displayCode: "SM",
    displayText: "Gagana faÊ»a SÄmoa (Samoan)",
  },
  hmn: {
    displayCode: "HMN",
    displayText: "Hmong (Hmong)",
  },
  hr: {
    displayCode: "HR",
    displayText: "Hrvatski (Croatian)",
  },
  haw: {
    displayCode: "HA",
    displayText: "Ê»ÅŒlelo HawaiÊ»i (Hawaiian)",
  },
  ilo: {
    displayCode: "ILO",
    displayText: "Ilocano (Filipino)",
  },
  it: {
    displayCode: "IT",
    displayText: "Italiano (Italian)",
  },
  lv: {
    displayCode: "LV",
    displayText: "LatvieÅ¡u (Latvian)",
  },
  lt: {
    displayCode: "LT",
    displayText: "LietuviÅ³ (Lithuanian)",
  },
  hu: {
    displayCode: "HU",
    displayText: "Magyar (Hungarian)",
  },
  nl: {
    displayCode: "NL",
    displayText: "Nederlands (Dutch)",
  },
  no: {
    displayCode: "NO",
    displayText: "Norsk (Norwegian)",
  },
  pl: {
    displayCode: "PL",
    displayText: "Polski (Polish)",
  },
  "pt-BR": {
    displayCode: "BR",
    displayText: "PortuguÃªs (Brazil)",
  },
  pt: {
    displayCode: "PT",
    displayText: "PortuguÃªs (Portugal)",
  },
  ro: {
    displayCode: "RO",
    displayText: "RomÃ¢nÄƒ (Romanian)",
  },
  "sr-Latn": {
    displayCode: "SR",
    displayText: "Serbian (Latin)",
  },
  sl: {
    displayCode: "SL",
    displayText: "SlovenÅ¡Äina (Slovenian)",
  },
  sk: {
    displayCode: "SK",
    displayText: "SlovenskÃ½ (Slovak)",
  },
  fi: {
    displayCode: "FI",
    displayText: "Suomi (Finnish)",
  },
  sv: {
    displayCode: "SV",
    displayText: "Svenska (Swedish)",
  },
  tl: {
    displayCode: "TL",
    displayText: "Tagalog (Filipino)",
  },
  tr: {
    displayCode: "TR",
    displayText: "TÃ¼rkÃ§e (Turkish)",
  },
  vi: {
    displayCode: "VI",
    displayText: "Viá»‡t Nam (Vietnamese)",
  },
  el: {
    displayCode: "EL",
    displayText: "Î•Î»Î»Î·Î½Î¹ÎºÎ¬ (Greek)",
  },
  bg: {
    displayCode: "BG",
    displayText: "Ð‘ÑŠÐ»Ð³Ð°Ñ€ÑÐºÐ¸ (Bulgarian)",
  },
  ru: {
    displayCode: "RU",
    displayText: "Ð ÑƒÑÑÐºÐ¸Ð¹ (Russian)",
  },
  sr: {
    displayCode: "SR",
    displayText: "Ð¡Ñ€Ð¿ÑÐºÐ¸ (Serbian)",
  },
  uk: {
    displayCode: "UK",
    displayText: "Ð£ÐºÑ€Ð°Ñ—Ð½ÑÑŒÐºÐ° (Ukrainian)",
  },
  ka: {
    displayCode: "KA",
    displayText: "áƒ¥áƒáƒ áƒ—áƒ£áƒšáƒ˜ (Georgian)",
  },
  hy: {
    displayCode: "HY",
    displayText: "Õ°Õ¡ÕµÕ¸Ö Õ¬Õ¥Õ¦Õ¸Ö‚ (Armenian)",
  },
  he: {
    displayCode: "HE",
    displayText: "×¢×‘×¨×™×ª (Hebrew)",
  },
  ps: {
    displayCode: "PS",
    displayText: "Ù¾ÚšØªÙˆ (Pashto)",
  },
  prs: {
    displayCode: "PRS",
    displayText: "Ø¯Ø±ÛŒ (Dari)",
  },
  ar: {
    displayCode: "AR",
    displayText: "Ø¹Ø±Ø¨Ù‰ (Arabic)",
  },
  fa: {
    displayCode: "FA",
    displayText: "ÙØ§Ø±Ø³ÛŒ (Persian)",
  },
  hi: {
    displayCode: "HI",
    displayText: "à¤¹à¤¿à¤‚à¤¦à¥€ (Hindi)",
  },
  bn: {
    displayCode: "BN",
    displayText: "à¦¬à¦¾à¦™à¦¾à¦²à¦¿ (Bengali)",
  },
  pa: {
    displayCode: "PA",
    displayText: "à¨ªà©°à¨œà¨¾à¨¬à©€ (Punjabi)",
  },
  th: {
    displayCode: "TH",
    displayText: "à¸ à¸²à¸©à¸²à¹„à¸—à¸¢ (Thai)",
  },
  ko: {
    displayCode: "KO",
    displayText: "í•œêµ­ì–´ (Korean)",
  },
  zh: {
    displayCode: "ZH",
    displayText: "ä¸­æ–‡ (Chinese)",
  },
  ja: {
    displayCode: "JA",
    displayText: "æ—¥æœ¬èªž (Japanese)",
  },
  "zh-TW": {
    displayCode: "TW",
    displayText: "æ¼¢èªž (Chinese Traditional)",
  },
};