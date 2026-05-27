
/* ng-infinite-scroll - v1.0.0 - 2013-02-23 */
var expTradeLine = {};
expTradeLine["No Data"] = { name: "", css: 'hstry-unknown' };
expTradeLine["NoData"] = { name: "", css: 'hstry-unknown' };
expTradeLine["OK"] = { name: "OK", css: 'hstry-ok' };
expTradeLine["30"] = { name: "30", css: 'hstry-30' };
expTradeLine["30Late"] = { name: "30", css: 'hstry-30' };
expTradeLine["60"] = { name: "60", css: 'hstry-60' };
expTradeLine["60Late"] = { name: "60", css: 'hstry-60' };
expTradeLine["90"] = { name: "90", css: 'hstry-90' };
expTradeLine["90Late"] = { name: "90", css: 'hstry-90' };
expTradeLine["120"] = { name: "120", css: 'hstry-120' };
expTradeLine["120PlusLate"] = { name: "120", css: 'hstry-120' };
expTradeLine["150"] = { name: "150", css: 'hstry-150' };
expTradeLine["180"] = { name: "180", css: 'hstry-180' };
expTradeLine["PP"] = { name: "PP", css: 'hstry-other' };
expTradeLine["RF"] = { name: "RF", css: 'hstry-other' };
expTradeLine["CO"] = { name: "CO", css: 'hstry-other' };
expTradeLine["Collection"] = { name: "CO", css: 'hstry-other' };
expTradeLine["CURRENT"] = { name: "OK", css: 'hstry-ok' };
expTradeLine["DEROGATORY"] = { name: "60", css: 'hstry-60' };
expTradeLine["DELINQUENT"] = { name: "30", css: 'hstry-30' };
var expTradeLineStatus = expTradeLine;

var crHistoryMonth = [];
crHistoryMonth[0] = "january";
crHistoryMonth[1] = "february";
crHistoryMonth[2] = "march";
crHistoryMonth[3] = "april";
crHistoryMonth[4] = "may";
crHistoryMonth[5] = "june";
crHistoryMonth[6] = "july";
crHistoryMonth[7] = "august";
crHistoryMonth[8] = "september";
crHistoryMonth[9] = "october";
crHistoryMonth[10] = "november";
crHistoryMonth[11] = "december";


var crHistoryMonthIndex = {};
crHistoryMonthIndex["january"] = 0;
crHistoryMonthIndex["february"] = 1;
crHistoryMonthIndex["march"] = 2;
crHistoryMonthIndex["april"] = 3;
crHistoryMonthIndex["may"] = 4;
crHistoryMonthIndex["june"] = 5;
crHistoryMonthIndex["july"] = 6;
crHistoryMonthIndex["august"] = 7;
crHistoryMonthIndex["september"] = 8;
crHistoryMonthIndex["october"] = 9;
crHistoryMonthIndex["november"] = 10;
crHistoryMonthIndex["december"] = 11;


var tradeLine = {};
tradeLine["C"] = { name: "OK", css: 'hstry-ok' };
tradeLine["E"] = { name: "OK", css: 'hstry-ok' };
tradeLine["G"] = { name: "CO", css: 'hstry-other' };
tradeLine["H"] = { name: "RF", css: 'hstry-other' };
tradeLine["J"] = { name: "VS", css: 'hstry-other' };
tradeLine["K"] = { name: "RF", css: 'hstry-other' };
tradeLine["L"] = { name: "CO", css: 'hstry-other' };
tradeLine["U"] = { name: "", css: 'hstry-unknown' };
tradeLine["Y"] = { name: "", css: 'hstry-unknown' };
tradeLine["1"] = { name: "30", css: 'hstry-30' };
tradeLine["2"] = { name: "60", css: 'hstry-60' };
tradeLine["3"] = { name: "90", css: 'hstry-90' };
tradeLine["4"] = { name: "120", css: 'hstry-120' };
tradeLine["5"] = { name: "150", css: 'hstry-150' };
tradeLine["6"] = { name: "180", css: 'hstry-180' };
tradeLine["7"] = { name: "PP", css: 'hstry-other' };
tradeLine["8"] = { name: "RF", css: 'hstry-other' };
tradeLine["9"] = { name: "CO", css: 'hstry-other' };
var tradeLineStatus = tradeLine;

var tradeLineStatusEQF = {};
tradeLineStatusEQF["U"] = { name: "OK", css: 'hstry-ok' };
tradeLineStatusEQF["C"] = { name: "OK", css: 'hstry-ok' };
tradeLineStatusEQF["1"] = { name: "30", css: 'hstry-30' };
tradeLineStatusEQF["2"] = { name: "60", css: 'hstry-60' };
tradeLineStatusEQF["3"] = { name: "90", css: 'hstry-90' };
tradeLineStatusEQF["4"] = { name: "120", css: 'hstry-120' };
tradeLineStatusEQF["5"] = { name: "150", css: 'hstry-150' };
tradeLineStatusEQF["6"] = { name: "180", css: 'hstry-180' };
tradeLineStatusEQF["7"] = { name: "PP", css: 'hstry-other' };
tradeLineStatusEQF["8"] = { name: "RF", css: 'hstry-other' };
tradeLineStatusEQF["9"] = { name: "CO", css: 'hstry-other' };
tradeLineStatusEQF[" "] = { name: "", css: 'hstry-unknown' };

var monthStr = {}
monthStr[0] = { name: 'Jan', alt: "" };
monthStr[1] = { name: 'Feb', alt: "feb" };
monthStr[2] = { name: 'Mar', alt: "mar" };
monthStr[3] = { name: 'Apr', alt: "apr" };
monthStr[4] = { name: 'May', alt: "may" };
monthStr[5] = { name: 'Jun', alt: "jun" };
monthStr[6] = { name: 'Jul', alt: "jul" };
monthStr[7] = { name: 'Aug', alt: "aug" };
monthStr[8] = { name: 'Sep', alt: "sep" };
monthStr[9] = { name: 'Oct', alt: "oct" };
monthStr[10] = { name: 'Nov', alt: "nov" };
monthStr[11] = { name: 'Dec', alt: "dec" };

var openAccountType = {};
openAccountType["M"] = 11
openAccountType["R"] = 12
openAccountType["I"] = 13
openAccountType["C"] = 14
openAccountType["O"] = 15
openAccountType["U"] = 16
openAccountType["Y"] = 17

var closedAccountType = {};
closedAccountType["M"] = 21
closedAccountType["R"] = 22
closedAccountType["I"] = 23
closedAccountType["C"] = 24
closedAccountType["O"] = 25
closedAccountType["U"] = 26
closedAccountType["Y"] = 27

var classificationList = {};
//Experian
classificationList["COLLECTION"] = 1000;
classificationList["REAL ESTATE"] = 4000;
classificationList["INSTALLMENT"] = 5000;
classificationList["REVOLVING"] = 6000;
//classificationList["OTHER"] = 7000;
//Equifax
classificationList["Mortgage"] = 4000;
classificationList["Installment"] = 5000;
classificationList["Open Account"] = 5000;
classificationList["Revolving"] = 6000;
//classificationList["Line of Credit"] = 7000;
//TransUnion
classificationList["Mortgage account"] = 4000;
classificationList["Open account"] = 5000;
classificationList["Installment account"] = 5000;
classificationList["Revolving account"] = 6000;
//classificationList["Overdraft / reserve checking account"] = 7000;
//classificationList[""] = 7000;

var mod;

mod = angular.module('infinite-scroll', []);

mod.directive('infiniteScroll', [
    '$rootScope', '$window', '$timeout', function ($rootScope, $window, $timeout) {
        return {
            link: function (scope, elem, attrs) {
                var checkWhenEnabled, handler, scrollDistance, scrollEnabled;
                $window = angular.element($window);
                scrollDistance = 0;
                if (attrs.infiniteScrollDistance != null) {
                    scope.$watch(attrs.infiniteScrollDistance, function (value) {
                        return scrollDistance = parseInt(value, 10);
                    });
                }
                scrollEnabled = true;
                checkWhenEnabled = false;
                if (attrs.infiniteScrollDisabled != null) {
                    scope.$watch(attrs.infiniteScrollDisabled, function (value) {
                        scrollEnabled = !value;
                        if (scrollEnabled && checkWhenEnabled) {
                            checkWhenEnabled = false;
                            return handler();
                        }
                    });
                }
                handler = function () {
                    var elementBottom, remaining, shouldScroll, windowBottom;
                    var windowEl = $window[0];
                    //windowBottom = $window.height() + $window.scrollTop();
                    windowBottom = windowEl.innerHeight + windowEl.pageYOffset;
                    var elemDom = elem[0];
                    var rect = elemDom.getBoundingClientRect();

                    elementBottom = rect.top + windowEl.pageYOffset + elemDom.offsetHeight;

                    remaining = elementBottom - windowBottom;
                    shouldScroll = remaining <= windowEl.innerHeight * scrollDistance;

                    if (shouldScroll && scrollEnabled) {
                        if ($rootScope.$$phase) {
                            return scope.$eval(attrs.infiniteScroll);
                        } else {
                            return scope.$apply(attrs.infiniteScroll);
                        }
                    } else if (shouldScroll) {
                        return checkWhenEnabled = true;
                    }
                };
                $window.on('scroll', handler);
                scope.$on('$destroy', function () {
                    return $window.off('scroll', handler);
                });
                return $timeout((function () {
                    if (attrs.infiniteScrollImmediateCheck) {
                        if (scope.$eval(attrs.infiniteScrollImmediateCheck)) {
                            return handler();
                        }
                    } else {
                        return handler();
                    }
                }), 0);
            }
        };
    }
]);
var app = angular.module('creditReport', ['infinite-scroll']);

app.filter('trim', function () {
    return function (input) {
        if (!input) {
            return input;
        }
        return input.replace(/(^\s+|\s+$)/g, '');
    };
});
app.filter('zipcode', function (trimFilter) {
    return function (input) {
        if (!input) {
            return input;
        }
        input = trimFilter(input);
        if (input.toString().length === 9) {
            return input.toString().slice(0, 5) + "-" + input.toString().slice(5);
        } else if (input.toString().length === 5) {
            return input.toString();
        } else {
            return input;
        }
    };
});
app.filter('currencyIgnoreEmpty', function ($filter) {
    var currencyFilterFn = $filter('currency');
    return function (data) {
        if (data == "" || data == undefined) {
            return "-";
        }
        return currencyFilterFn(data);
    };
});
app.filter('dateIgnoreTimezone', function ($filter) {
    var dateFilterFn = $filter('date');
    return function (data, format) {
        if (data == "" || data == undefined) {
            return "-";
        }
        if (data.indexOf('T') != -1) {
            data = data.split('T');
            data = data[0];
        }
        return dateFilterFn(data, format);
    };
});
app.filter('orderObjectBy', function () {
    return function (items, field, reverse) {
        var filtered = [];
        angular.forEach(items, function (item) {
            filtered.push(item);
        });
        filtered.sort(function (a, b) {
            return (a[field] > b[field] ? 1 : -1);
        });
        if (reverse) filtered.reverse();
        return filtered;
    };
});
app.filter('telephone', function () {
    return function (tel) {
        if (!tel) { return ''; }

        var value = tel.toString().trim().replace(/^\+/, '');

        if (value.match(/[^0-9]/)) {
            return tel;
        }

        var country, city, number;

        switch (value.length) {
            case 10: // +1PPP####### -> C (PPP) ###-####
                country = 1;
                city = value.slice(0, 3);
                number = value.slice(3);
                break;

            case 11: // +CPPP####### -> CCC (PP) ###-####
                country = value[0];
                city = value.slice(1, 4);
                number = value.slice(4);
                break;

            case 12: // +CCCPP####### -> CCC (PP) ###-####
                country = value.slice(0, 3);
                city = value.slice(3, 5);
                number = value.slice(5);
                break;

            default:
                return tel;
        }

        if (country == 1) {
            country = "";
        }

        number = number.slice(0, 3) + '-' + number.slice(3);

        return (country + " (" + city + ") " + number).trim();
    };
});

app.filter("history2year", function ($filter) {
    return function (tpartition) {
        var recenttPaymentDate;
        if (!tpartition.history) {
            var history = []
            tpartition.history = history;
            var tucPayHistory = [];
            var expPayHistory = [];
            var eqfPayHistory = [];
            $.each(angular.isArray(tpartition.Tradeline) ? tpartition.Tradeline : [tpartition.Tradeline], function (i, d) {
                var pd = "";
                if (d.GrantedTrade && d.GrantedTrade.PayStatusHistory) {
                    if (d.Source.Bureau["@symbol"] == 'TUC') {
                        tucPayHistory = d.GrantedTrade.PayStatusHistory.MonthlyPayStatus
                    }
                    if (d.Source.Bureau["@symbol"] == 'EXP') {
                        expPayHistory = d.GrantedTrade.PayStatusHistory.MonthlyPayStatus
                    }
                    if (d.Source.Bureau["@symbol"] == 'EQF') {
                        eqfPayHistory = d.GrantedTrade.PayStatusHistory.MonthlyPayStatus
                    }
                    pd = d.GrantedTrade.PayStatusHistory['@startDate'];
                    if (pd) {
                        pd = new Date(pd.replace(/-/g, "/"));
                    }
                }

                if (!recenttPaymentDate || (recenttPaymentDate < pd)) {
                    recenttPaymentDate = pd;
                }
            })
            if (!recenttPaymentDate) {
                recenttPaymentDate = new Date();
            }
            for (var i = 0; i <= 23; i++) {
                var date = new Date(recenttPaymentDate.setMonth(recenttPaymentDate.getMonth() - (i > 0 ? 1 : 0), 1));
                var dateStr = date.getFullYear() + '-' + prefixZero(date.getMonth() + 1);
                var filterObj = { "@date": dateStr };
                var tuc = $filter('filter')(tucPayHistory, filterObj);
                var exp = $filter('filter')(expPayHistory, filterObj);
                var eqf = $filter('filter')(eqfPayHistory, filterObj);
                var monthName = monthStr[date.getMonth()];
                history.push({
                    month: monthName ? monthName.name : "",
                    year: date ? date.getFullYear().toString().substring(2, 4) : "",
                    tuc: tuc.length > 0 ? tradeLineStatus[tuc[0]["@status"]] : "",
                    exp: exp.length > 0 ? tradeLineStatus[exp[0]["@status"]] : "",
                    eqf: eqf.length > 0 ? tradeLineStatusEQF[eqf[0]["@status"]] : ""
                })
            }
        }

        return tpartition.history;
    }

});

app.filter("expHistory2year", function ($filter) {
    return function (tpartition) {

        var recenttPaymentDate;
        if (!tpartition.history) {
            var history = []
            tpartition.history = history;
            var tucPayHistory = [];
            var expPayHistory = [];
            var eqfPayHistory = [];

            var pd = "";
            if (tpartition['TUC'] && tpartition['TUC']['payment_histories']) {
                tucPayHistory = tpartition['TUC']['payment_histories']
                if (tucPayHistory.length > 0) {
                    var yearMonths = Object.getOwnPropertyNames(tucPayHistory[0]);
                    pd = new Date(tucPayHistory[0]["calendar_year"], crHistoryMonthIndex[yearMonths[yearMonths.length - 1]]);
                    if (!recenttPaymentDate || (recenttPaymentDate < pd)) {
                        recenttPaymentDate = pd;
                    }
                }

            }
            if (tpartition['EXP'] && tpartition['EXP']['payment_histories']) {
                expPayHistory = tpartition['EXP']['payment_histories']
                if (expPayHistory.length > 0) {
                    var yearMonths = Object.getOwnPropertyNames(expPayHistory[0]);
                    pd = new Date(expPayHistory[0]["calendar_year"], crHistoryMonthIndex[yearMonths[yearMonths.length - 1]]);
                    if (!recenttPaymentDate || (recenttPaymentDate < pd)) {
                        recenttPaymentDate = pd;
                    }
                }
            }
            if (tpartition['EQF'] && tpartition['EQF']['payment_histories']) {
                eqfPayHistory = tpartition['EQF']['payment_histories']
                if (eqfPayHistory.length > 0) {
                    var yearMonths = Object.getOwnPropertyNames(eqfPayHistory[0]);
                    pd = new Date(eqfPayHistory[0]["calendar_year"], crHistoryMonthIndex[yearMonths[yearMonths.length - 1]]);
                    if (!recenttPaymentDate || (recenttPaymentDate < pd)) {
                        recenttPaymentDate = pd;
                    }
                }
            }

            if (!recenttPaymentDate) {
                recenttPaymentDate = new Date();
            }
            for (var i = 0; i <= 23; i++) {
                var date = new Date(recenttPaymentDate.setMonth(recenttPaymentDate.getMonth() - (i > 0 ? 1 : 0), 1));
                var yearStr = date.getFullYear();
                var crMonthStr = crHistoryMonth[date.getMonth()];
                var filterObj = { "calendar_year": yearStr };
                var tuc = $filter('filter')(tucPayHistory, filterObj);
                var exp = $filter('filter')(expPayHistory, filterObj);
                var eqf = $filter('filter')(eqfPayHistory, filterObj);
                var monthName = monthStr[date.getMonth()];
                history.push({
                    month: monthName ? monthName.name : "",
                    year: date ? date.getFullYear().toString().substring(2, 4) : "",
                    tuc: tuc.length > 0 ? expTradeLineStatus[tuc[0][crMonthStr]] : "",
                    exp: exp.length > 0 ? expTradeLineStatus[exp[0][crMonthStr]] : "",
                    eqf: eqf.length > 0 ? expTradeLineStatus[eqf[0][crMonthStr]] : ""
                })
            }
        }

        return tpartition.history;
    }

});
app.factory('safeApply', [function ($rootScope) {
    return function ($scope, fn) {
        var phase = $scope.$root.$$phase;
        if (phase == '$apply' || phase == '$digest') {
            if (fn) {
                $scope.$eval(fn);
            }
        } else {
            if (fn) {
                $scope.$apply(fn);
            } else {
                $scope.$apply();
            }
        }
    }
}])
var prefixZero = function (data) {
    if (data < 10) {
        return "0" + data
    }
    return data;
}

app.controller("CreditReportController", ['$rootScope', '$scope', '$http', 'zipcodeFilter', 'trimFilter', '$location', '$anchorScroll', '$filter', 'safeApply', function ($rootScope, $scope, $http, zipcodeFilter, trimFilter, $location, $anchorScroll, $filter, safeApply) {
    var self = this;
    var scope = $scope;
    $scope.isLoaded = false;
    $scope.is3B = false;
    $scope.valid = false;
    var infinite_scroll_length = 0;
    $scope.orderedTradeLines = [];
    var tradeLinePartitions = [];
    var RptType = '3B';
    var referenceNo = 'M67071770';
    var IsTuRpt = 'True';
    var reportUrl = 'https://consumerconnect.tui.transunion.com/dsply.aspx?pdt=2fd3c855-62f9-4a41-9333-cb9781d77975&xsl=CC2IDENTITYIQ_GENERIC_JSON';
    var rptServiceProvider = "TUC";
    if (!rptServiceProvider) {
        rptServiceProvider = "TUC";
    }
    var chooseReportTemplate = function (bureau) {
        $scope.showExperianReport = bureau == "EXP" ? true : false;
        $scope.showTransunionReport = bureau == "TUC" ? true : false;
    }
    chooseReportTemplate(rptServiceProvider);

    const placeMostRecentReferenceInHistory = (history, reference) => {
        if (!history || history.length == 0) {
            return history;
        }
        // Find the index of most recent date
        let mostRecentDate = history.reduce((a, b) => (a.Date > b.Date ? a : b));
        let mostRecentIndex = history.indexOf(mostRecentDate);
        let activeReportWithProvider = history[mostRecentIndex].Id.split('~');
        let serviceProvider = activeReportWithProvider[1];
        // update history with proper reference
        history[mostRecentIndex].Id = `${reference}~${serviceProvider}`;
        return history;
    }

    const cleanReportHistory = (rhist, referenceNo) => {
        if (!rhist || rhist.length == 0) {
            return [];
        }

        // filter reports with duplicate dates, and maintain reference report
        const referenceReport = rhist.find(rpt => rpt.Id.includes(referenceNo));
        const uniqueDateReportList = rhist.filter((value, index, self) => index === self.findIndex(t => (t.Date === value.Date)));
        const isReferenceRptInUniqueList = uniqueDateReportList.find(rpt => rpt.Id.includes(referenceNo));
        const addReferenceToHistory = referenceReport ?
            uniqueDateReportList.map(rpt => [referenceReport].find(o => o?.Date === rpt.Date) || rpt) :
            placeMostRecentReferenceInHistory(uniqueDateReportList, referenceNo);

        return isReferenceRptInUniqueList ?
            uniqueDateReportList :
            addReferenceToHistory;
    }

    $scope.reportHistory = cleanReportHistory(angular.fromJson([{ "Id": "M67071770~TUC", "Date": "09/23/2025 - 3B" }, { "Id": "M66044150~TUC", "Date": "08/18/2025 - 3B" }, { "Id": "M65042801~TUC", "Date": "07/10/2025 - 3B" }, { "Id": "M64082557~TUC", "Date": "06/04/2025 - 3B" }, { "Id": "M63086242~TUC", "Date": "04/25/2025 - 3B" }, { "Id": "M62019106~TUC", "Date": "03/20/2025 - 3B" }, { "Id": "M61067185~TUC", "Date": "02/11/2025 - 3B" }, { "Id": "M60239173~TUC", "Date": "01/06/2025 - 3B" }, { "Id": "M59522993~TUC", "Date": "11/29/2024 - 3B" }, { "Id": "M58661174~TUC", "Date": "10/21/2024 - 3B" }]), referenceNo);

    var findSelectedHistory = function (activeRef) {
        var selHistory = {};

        return selHistory;
    }
    $scope.activeReportReference = referenceNo;
    var activeCReport = findSelectedHistory(referenceNo);
    $scope.selectedHistory = activeCReport;
    function updateCReportReportType(activeCReportFilterDate) {
        var activeCReportDateSplit = activeCReportFilterDate.split("-")
        if (activeCReportDateSplit.length == 2) {
            RptType = $.trim(activeCReportDateSplit[1]);
            //$scope.is3B = RptType == "3B";
        }
    }
    if (activeCReport && activeCReport.Date) {
        updateCReportReportType(activeCReport.Date);
    }
    $scope.reportHistoryChanged = function () {
        /*var $reprtOuter = $("#divReprtOuter");
        var reprtOuterHeight = $reprtOuter.height();
        $reprtOuter.css({height:reprtOuterHeight});*/
        $scope.isLoaded = false;
        safeApply($scope);
        var activeReportWithProvider = $("select[name='ddlReportHistory']").val();
        var activeReportWithDateType = $("select[name='ddlReportHistory'] option:selected").text();
        var memberId = $("input#hdnMemberid").val();
        var membershipNo = $("input#hdnmemberno").val();
        activeReportWithProvider = activeReportWithProvider.split('~');
        var activeReport = activeReportWithProvider[0];
        var serviceProvider = activeReportWithProvider[1];
        if (activeReportWithDateType) { updateCReportReportType(activeReportWithDateType); }
        chooseReportTemplate(serviceProvider);
        $.ajax({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            url: "/CreditReport.aspx/GetReportForHistory",
            data: JSON.stringify({ reportId: activeReport, memberId: memberId, membershipno: membershipNo, serviceProvider: serviceProvider }),
            dataType: "json",
            success: function (response) {
                //safeApply($scope);
                response = response.d;
                $scope.referenceNo = activeReport;
                $scope.activeReportReference = activeReport;
                $scope.selectedHistory = findSelectedHistory(activeReport);
                if (response.Content) {
                    prevReferenceNo = activeReport;
                    $scope.valid = true;
                    //$scope.is3B = (response.Type == '3B' ? true : false);
                    gettingTransunionReport(response.Content);

                } else {
                    $scope.isLoaded = true;
                    $scope.valid = false;
                    $scope.referenceNo = prevReferenceNo;
                    $scope.selectedHistory = findSelectedHistory(prevReferenceNo);
                    safeApply($scope);
                    alert(response.ErrorMsg ? response.ErrorMsg : "You have an issue with viewing your Credit Report - " + activeReport + ". Please contact customer service ");
                }

            },
            error: function () {
                $scope.isLoaded = true;
                $scope.valid = false;
                safeApply($scope);
            }
        });
    }
    if (RptType == '3B') {
        $scope.is3B = true;
    }
    $scope.brwType = detectBrowserType();
    $scope.referenceNo = referenceNo;
    var prevReferenceNo = referenceNo;
    $scope.zipcode = zipcodeFilter;
    $scope.trim = trimFilter;
    $scope.isArray = angular.isArray;
    $scope.makeArray = function (obj) {
        if (obj) {
            return angular.isArray(obj) ? obj : [obj];
        } else {
            return [];
        }
    };
    /* date sorting*/
    $scope.sortInquiryDate = function (inquiryPartition) {
        return new Date(inquiryPartition.Inquiry['@inquiryDate']);
    };
    $scope.sortExperianInquiryDate = function (inquiry) {
        return new Date(inquiry['date_of_inquiry']);
    };
    $scope.getBirthDate = function (birth) {
        var birthday = [];
        if (birth && birth.BirthDate) {
            birthday.push(birth.BirthDate["@month"]);
            birthday.push(birth.BirthDate["@day"]);
            birthday.push(birth.BirthDate["@year"]);
            birthday = birthday.filter(Boolean);
        }
        return birthday.join("/")
    },
        $scope.combineTUCAddressLine = function (addr) {
            var houseNumber = trimFilter(addr.CreditAddress['@houseNumber']);
            var unit = trimFilter(addr.CreditAddress['@unit']);
            var direction = trimFilter(addr.CreditAddress['@direction']);
            var streetName = trimFilter(addr.CreditAddress['@streetName']);
            var streetType = trimFilter(addr.CreditAddress['@streetType']);
            var addressLine = [];
            if (houseNumber) {
                addressLine.push(houseNumber)
            }
            if (direction) {
                addressLine.push(direction)
            }
            if (streetName) {
                addressLine.push(streetName)
            }
            if (streetType) {
                addressLine.push(streetType)
            }
            if (unit) {
                addressLine.push(unit)
            }
            return addressLine.join(" ");

        }
    $scope.findDerogatoryCount = function (TradeLinePartition, bureau) {
        var count = 0;
        var tPartitions = $scope.makeArray(TradeLinePartition);
        $.each(tPartitions, function (index, tp) {
            if (tp["@accountTypeSymbol"] == "Y") {
                tradLine = $scope.makeArray(tp.Tradeline);
                $.each(tradLine, function (i, tl) {
                    if (tl.Source.Bureau["@symbol"] == bureau) {
                        count = count + 1;
                    }
                });
            }
        })
        return count;
    }
    $scope.findDerogatoryIndicator = function (tPartition, bureau, cssClass) {
        var count = 0;
        if (tPartition) {
            tradLine = $scope.makeArray(tPartition.Tradeline);
            $.each(tradLine, function (i, tl) {
                var gradeTrade = tl.GrantedTrade;
                if (tl.Source.Bureau["@symbol"] == bureau && gradeTrade) {
                    var late90Count = parseInt(gradeTrade["@late90Count"]);
                    var late60Count = parseInt(gradeTrade["@late60Count"]);
                    var late30Count = parseInt(gradeTrade["@late30Count"]);
                    late90Count = isNaN(late90Count) ? 0 : late90Count;
                    late60Count = isNaN(late60Count) ? 0 : late60Count;
                    late30Count = isNaN(late30Count) ? 0 : late30Count;
                    var totalPayStatus = 0;
                    var payStatusHtry = gradeTrade.PayStatusHistory;
                    if (payStatusHtry) {
                        var payStatus = payStatusHtry["@status"];
                        payStatus = payStatus ? (payStatus.substring(0, 24)).match(/[1,2,3,4,5]/ig) : null;
                        if (payStatus) {
                            totalPayStatus = payStatus.length;
                        }
                        if ((late90Count + late60Count + late30Count) > totalPayStatus) {
                            cssClass = "header" + bureau;

                        }
                    }
                }
            });
        }

        return ["label", "leftHeader", cssClass];
    }
    $scope.sortInquiryDate = function (inquiryPartition) {
        return new Date(inquiryPartition.Inquiry['@inquiryDate']);
    };
    $scope.sortSourceInquiryDate = function (source) { source.InquiryDate["$"]; }

    var tradeLineAccountCondition = function (item) {
        return [$scope.makeArray(item.Tradeline)[0].AccountCondition['@symbol'], item['@accountTypeSymbol']];
    }
    var tradeLineAccountConditionCmpr = function (item1, item2) {
        var v1 = item1.value[0] == "O" ? (openAccountType[item1.value[2]] || 10) : (item1.value[0] == "C" ? (closedAccountType[item1.value[2]] || 20) : 30);
        var v2 = item2.value[0] == "O" ? (openAccountType[item2.value[2]] || 10) : (item2.value[0] == "C" ? (closedAccountType[item2.value[2]] || 20) : 30);
        return v1 == v2 ? 0 : (v1 > v2 ? 1 : -1);
    }
    $scope.TUCVantageScore;
    $scope.EXPVantageScore;
    $scope.EQFVantageScore;
    $scope.isTUCFactorText = function (text) {
        return !/^explain:|factor:|cando:|No Adverse Action Reasons/ig.test(text["$"]);
    }
    $scope.isTUCFactorTextExplain = function (text) {
        return /^explain:/ig.test(text["$"]);
    }
    $scope.isTUCFactorTextFactor = function (text) {
        return /^factor:/ig.test(text["$"]);
    }
    $scope.vantageScoreFactorGrade = function (score) {
        if (score) {
            score = parseInt(score);
            score = isNaN(score) ? 0 : score;
            if (score <= 499) {
                return "Deficient";
            }
            else if (score >= 500 && score <= 600) {
                return "Unfavorable";
            }
            else if (score >= 601 && score <= 660) {
                return "Fair";
            }
            else if (score >= 661 && score <= 720) {
                return "Good";
            }
            else if (score >= 721 && score <= 780) {
                return "Great";
            }
            else if (score >= 781) {
                return "Excellent";
            }
        }
        return "";
    }
    $scope.scrollTo = function (id) {
        $location.hash(id);
        $anchorScroll();
    }
    $scope.showAllDescription = function () {
        $scope.show = !$scope.show;
    }
    $scope.checkForScoreView = function () {
        var isScoreView = $location.absUrl();
        if (/isScoreView=true/ig.test(isScoreView)) {
            $scope.scrollTo('CreditScore');
        }
    }
    $scope.combineAddressLine = function (addr) {
        var houseNumber = trimFilter(addr['house_number']);
        var pre_directional = trimFilter(addr['pre_directional']);
        var unit = trimFilter(addr['unit']);
        var streetName = trimFilter(addr['street_name']);
        var suffix = trimFilter(addr['suffix']);
        var post_directional = trimFilter(addr['post_directional']);

        var addressLine = [];
        if (houseNumber) {
            addressLine.push(houseNumber)
        }
        if (pre_directional) {
            addressLine.push(pre_directional)
        }
        if (streetName) {
            addressLine.push(streetName)
        }
        if (suffix) {
            addressLine.push(suffix)
        }
        if (post_directional) {
            addressLine.push(post_directional)
        }
        if (unit) {
            addressLine.push(unit)
        }
        return addressLine.join(" ");
    }
    $scope.removeLeadingZeros = function (data) {
        return $.trim(data.replace(/^0+/, ''));
    }
    $scope.expFindDerogatoryIndicator = function (tPartition, bureau, cssClass) {
        var count = 0;
        if (tPartition) {
            var gradeTrade = tPartition[bureau];
            if (tPartition[bureau]) {
                var late90Count = parseInt(gradeTrade["delinquent_90_days_count"]);
                var late60Count = parseInt(gradeTrade["delinquent_60_days_count"]);
                var late30Count = parseInt(gradeTrade["delinquent_30_days_count"]);
                late90Count = isNaN(late90Count) ? 0 : late90Count;
                late60Count = isNaN(late60Count) ? 0 : late60Count;
                late30Count = isNaN(late30Count) ? 0 : late30Count;
                var totalPayStatus = 0;
                if ((late90Count + late60Count + late30Count) > totalPayStatus) {
                    cssClass = "header" + bureau;

                }
            }
            return ["label", "leftHeader", cssClass];
        }
    }
    var expTradeLineAccountCondition = function (item) {
        var rptType = item['EXP'] || item['EQF'] || item['TUC']
        var compareTo = classificationList[rptType['classification']];
        if (compareTo == undefined) { compareTo = 9000; }
        var delinguentCount = rptType['delinquent_30_days_count'] + rptType['delinquent_60_days_count'] + rptType['delinquent_90_days_count']
        if (delinguentCount > 0 || (rptType['type_definition_flags'] && rptType['type_definition_flags']['historical_derogatory'] == 'Negative')) {
            var lead = compareTo / 100;
            compareTo = 3000 + lead;
        }
        if (rptType['type_definition_flags']['account_status'] == 'Open') {
            compareTo += 100;
        }
        else if (rptType['type_definition_flags']['account_status'] == 'Closed') {
            compareTo += 700;
        } else {
            compareTo += 300;
        }
        var charASCII = parseInt((item['name'].charAt(0)).toUpperCase().charCodeAt(0));
        charASCII = isNaN(charASCII) ? 0 : charASCII;
        return [compareTo + charASCII];
    }
    var expCreditorContactCondition = function (item) {
        return [parseInt((item['name'].charAt(0)).toUpperCase().charCodeAt(0))];
    }
    var expTradeLineAccountConditionCmpr = function (item1, item2) {
        return item1.value == item2.value ? 0 : (item1.value > item2.value ? 1 : -1);
    }
    var expFirstCharASCIIConditionCmpr = function (item1, item2) {
        var v1 = item1.value;
        var v2 = item2.value;
        return v1 == v2 ? 0 : (v1 > v2 ? 1 : -1);
    }
    if (!IsTuRpt) {
        $scope.isLoaded = true;
        $scope.valid = false;
        return;
    }

    var gettingTransunionReport = async function () {
        const json = window.clientData
        var content = $scope.makeArray(json)
        infinite_scroll_length = 0;
        $scope.orderedTradeLines = [];
        if (content) {
            try {
                const component = content[0]
                console.log($scope)
                $scope.reports = component;
                $scope.TUCVantageScore = component.creditScore['TransUnion'];
                $scope.EXPVantageScore = component.creditScore['Experian'];;
                $scope.EQFVantageScore = component.creditScore['Equifax'];;
                tradeLinePartitions = $filter('orderBy')($scope.makeArray($scope.reports.TradeLinePartition, tradeLineAccountCondition), false, tradeLineAccountConditionCmpr);
                $scope.valid = true;
                if (component.CreditScoreType) {
                    if (component.CreditScoreType["@scoreName"] == 'VantageScore3' && component.CreditScoreType.Source.Bureau["@symbol"] == 'TUC')
                        $scope.TUCVantageScore = component.CreditScoreType;

                    $scope.valid = true;
                }
                $scope.isLoaded = true;
                //safeApply($scope);
                $scope.checkForScoreView();
            } catch (ex) {
                console.log({ ex })
                saveTUErrorResponse(window.location.href, angular.toJson(ex));
            }
        } else {
            saveTUErrorResponse(window.location.href, "1B Report content is empty");
        }
        safeApply($scope);

    }
    $scope.renderExperianReport = function (response) {

        $scope.isLoaded = true;
        if (response.length > 0 && response[0].data) {
            data = response[0].data;
            $scope.db = data
            $scope.valid = true;
            var reports = {};
            var bureauCodes = {
                "TransUnion": "TUC",
                "Experian": "EXP",
                "Equifax": "EQF"
            };

            var creditorNames = [];
            var creditors = [];
            var inquiries = [];
            var score_details = {};
            var account_summary = {};
            account_summary['TUC'] = {};
            account_summary['EXP'] = {};
            account_summary['EQF'] = {};
            account_summary['TUC']['total_count'] = account_summary['TUC']['open_count'] = account_summary['TUC']['closed_count'] = account_summary['TUC']['collection'] = account_summary['TUC']['payment'] = account_summary['TUC']['balance'] = 0;
            account_summary['EXP']['total_count'] = account_summary['EXP']['open_count'] = account_summary['EXP']['closed_count'] = account_summary['EXP']['collection'] = account_summary['EXP']['payment'] = account_summary['EXP']['balance'] = 0;
            account_summary['EQF']['total_count'] = account_summary['EQF']['open_count'] = account_summary['EQF']['closed_count'] = account_summary['EQF']['collection'] = account_summary['EQF']['payment'] = account_summary['EQF']['balance'] = 0;
            account_summary['TUC']['delinquent'] = 0;
            account_summary['EXP']['delinquent'] = 0;
            account_summary['EQF']['delinquent'] = 0;
            account_summary['TUC']['inquires'] = 0;
            account_summary['EXP']['inquires'] = 0;
            account_summary['EQF']['inquires'] = 0;
            account_summary['TUC']['public_record'] = 0;
            account_summary['EXP']['public_record'] = 0;
            account_summary['EQF']['public_record'] = 0;

            var inquire_count = {};
            var inquire_year_recent = 0;
            var public_records = [];
            var consumer_statements = {};
            consumer_statements['TUC'] = [];
            consumer_statements['EXP'] = [];
            consumer_statements['EQF'] = [];
            var accounts = [];

            if (!$scope.is3B) {
                data = data.filter(function (b) { return b.bureau == "Experian" });
            }

            for (var i = 0; i < data.length; i++) {
                var bureauCode = bureauCodes[data[i]["bureau"]];
                reports[bureauCode] = data[i];
                var accountList = $scope.makeArray(data[i]["accounts"]);
                for (var j = 0; j < accountList.length; j++) {
                    var creditor = accountList[j]["creditor"];
                    if (jQuery.inArray(creditor["name"], creditorNames) == -1 && creditor["name"]) {
                        creditorNames.push(creditor["name"]);
                        creditors.push(creditor);
                    }
                    var currentAccount = accountList[j];
                    new MergeAccountLogic(currentAccount, accounts, bureauCode);

                    account_summary[bureauCode] = account_summary[bureauCode] || {};

                    account_summary[bureauCode]['total_count'] = account_summary[bureauCode]['total_count'] + 1;

                    var delinquent_count = accountList[j]['delinquent_30_days_count'] + accountList[j]['delinquent_60_days_count'] + accountList[j]['delinquent_90_days_count'];
                    if (delinquent_count > 0) {
                        account_summary[bureauCode]['delinquent'] = account_summary[bureauCode]['delinquent'] + 1;
                    }
                    var monthly_payment = parseFloat(accountList[j]['monthly_payment']);
                    var balance = parseFloat(accountList[j]['balance']);
                    if (!isNaN(monthly_payment)) {
                        account_summary[bureauCode]['payment'] = account_summary[bureauCode]['payment'] + monthly_payment;
                    }
                    if (!isNaN(balance)) {
                        account_summary[bureauCode]['balance'] = account_summary[bureauCode]['balance'] + balance;
                    }

                    if (accountList[j]['type_definition_flags']) {
                        if (bureauCode != "EXP") {
                            if (accountList[j]['type_definition_flags']['account_status'] == 'Closed') {
                                account_summary[bureauCode]['closed_count'] = account_summary[bureauCode]['closed_count'] + 1;
                            } else if (accountList[j]['type_definition_flags']['account_status'] == 'Open') {
                                account_summary[bureauCode]['open_count'] = account_summary[bureauCode]['open_count'] + 1;
                            }
                        }
                        if (accountList[j]['type_definition_flags']['is_external_collection']) {
                            account_summary[bureauCode]['collection'] = account_summary[bureauCode]['collection'] + 1;
                        }
                        if (accountList[j]['type_definition_flags']['historical_derogatory'] == "Negative" || accountList[j]['type_definition_flags']['is_external_collection']) {
                            account_summary[bureauCode]['derogatory'] = (account_summary[bureauCode]['derogatory'] || 0) + 1;
                        }
                    }
                    if (bureauCode == "EXP") {
                        if (accountList[j]['open_closed'] == 'Closed') {
                            account_summary[bureauCode]['closed_count'] = account_summary[bureauCode]['closed_count'] + 1;
                        } else if (accountList[j]['open_closed'] == 'Open') {
                            account_summary[bureauCode]['open_count'] = account_summary[bureauCode]['open_count'] + 1;
                        }
                    }

                }
                var inquiryList = $scope.makeArray(data[i]["inquiries"]);
                for (var j = 0; j < inquiryList.length; j++) {
                    inquiryList[j]["bureau"] = data[i]["bureau"];
                    inquiries.push(inquiryList[j]);
                    var inquiryDate = new Date(inquiryList[j]['date_of_inquiry']);
                    var inquiryYear = inquiryDate.getFullYear();
                    if (inquiryYear > inquire_year_recent) {
                        inquire_year_recent = inquiryYear;
                    }

                    inquire_count[bureauCode] = inquire_count[bureauCode] || {};
                    inquire_count[bureauCode][inquiryYear] = (inquire_count[bureauCode][inquiryYear] || 0) + 1;

                    var creditor = inquiryList[j]["creditor"];
                    if (creditor && creditor["name"]) {
                        if (jQuery.inArray(creditor["name"], creditorNames) == -1 && creditor["name"]) {
                            creditorNames.push(creditor["name"]);
                            creditors.push(creditor);
                        }
                    }
                }
                var scoreList = $scope.makeArray(data[i]["score_details"]);
                for (var j = 0; j < scoreList.length; j++) {
                    score_details[bureauCode] = scoreList[j];
                }

                var publicRecordList = $scope.makeArray(data[i]["public_records"]);
                for (var j = 0; j < publicRecordList.length; j++) {
                    var court_name = publicRecordList[j]["court"];
                    var publicRecord = {};
                    publicRecord["title"] = court_name;
                    publicRecord[bureauCode] = publicRecordList[j];
                    public_records.push(publicRecord);
                    account_summary[bureauCode]['public_record'] = (account_summary[bureauCode]['public_record'] || 0) + 1;
                    account_summary[bureauCode]['derogatory'] = (account_summary[bureauCode]['derogatory'] || 0) + 1
                }

                consumer_statements[bureauCode] = data[i]['consumer_statements'];
            }
            var currentDate = new Date();
            var twoYearsAgo = currentDate.setFullYear(currentDate.getFullYear() - 2);
            if (inquire_year_recent > 0) {
                if (inquire_count['TUC']) {
                    account_summary['TUC']['inquires'] = inquiries.filter(inquiry => inquiry["bureau"] == "TransUnion" && twoYearsAgo < new Date(inquiry["date_of_inquiry"])).length;
                }
                if (inquire_count['EXP']) {
                    account_summary['EXP']['inquires'] = inquiries.filter(inquiry => inquiry["bureau"] == "Experian" && twoYearsAgo < new Date(inquiry["date_of_inquiry"])).length;
                }
                if (inquire_count['EQF']) {
                    account_summary['EQF']['inquires'] = inquiries.filter(inquiry => inquiry["bureau"] == "Equifax" && twoYearsAgo < new Date(inquiry["date_of_inquiry"])).length;
                }
            }
            //account_summary['TUC']['open_count'] = (account_summary['TUC']['total_count'] - account_summary['TUC']['closed_count']);
            //account_summary['EXP']['open_count'] = (account_summary['EXP']['total_count'] - account_summary['EXP']['closed_count']);
            //account_summary['EQF']['open_count'] = (account_summary['EQF']['total_count'] - account_summary['EQF']['closed_count']);


            $scope.reports = reports;
            $scope.reports.creditors = null;
            $scope.reports.inquiries = null;
            $scope.reports.accounts = null;
            $scope.creditors = $filter('orderBy')(creditors, expCreditorContactCondition, false, expFirstCharASCIIConditionCmpr);
            $scope.inquiries = inquiries.filter(inquiry => twoYearsAgo < new Date(inquiry["date_of_inquiry"]));
            $scope.accounts = accounts;
            $scope.account_summary = account_summary;
            $scope.score_details = score_details;
            $scope.public_records = public_records;
            $scope.consumer_statements = consumer_statements;

            tradeLinePartitions = $filter('orderBy')($scope.accounts, expTradeLineAccountCondition, false, expTradeLineAccountConditionCmpr);
            $scope.valid = true;
        } else {
            saveTUErrorResponse(window.location.href, angular.toJson(data));
            $scope.valid = false;
        }
        safeApply($scope);
    }

    function MergeAccountLogic(account, accountList, bureauCode) {
        var accname = $.trim(account["name"]);
        var accdate_opened = new Date(account["date_opened"]);
        var accdate_opened_monthYear = "";
        if (accdate_opened) {
            accdate_opened_monthYear = accdate_opened.getMonth() + "" + accdate_opened.getFullYear()
        }
        var accNumber = $.trim(account["number"]);
        var accmonthly_payment = parseFloat(account["monthly_payment"]);
        var accbalance = parseFloat(account["balance"]);
        var acchigh_balance = parseFloat(account["high_balance"]);
        var accoriginal_amount = parseFloat(account["original_amount"]);
        var acclimit = parseFloat(account["limit"]);

        if (isNaN(acchigh_balance) && !isNaN(accoriginal_amount)) {
            acchigh_balance = accoriginal_amount;
        }
        var mergeAccount = null;
        var ignoreBureauInSearch = [bureauCode];
        if (accountList.length > 0) {
            var filteredAccounts = accountList.filter(function (fltAccount) {
                if (!fltAccount[bureauCode]) {
                    var is_valid_merge = false;
                    var selectedBureauCodes = Object.keys(fltAccount).filter(function (k) { return k != "name" && k != "original_creditor" });
                    for (var m = 0; m < selectedBureauCodes.length; m++) {
                        var lstAccount = fltAccount[selectedBureauCodes[m]];
                        if (!lstAccount) {
                            continue;
                        }
                        var lstNumber = $.trim(lstAccount["number"]);
                        var lstdate_opened = new Date(lstAccount["date_opened"]);
                        var lstdate_opened_monthYear = "";
                        if (lstdate_opened) {
                            lstdate_opened_monthYear = lstdate_opened.getMonth() + "" + lstdate_opened.getFullYear()
                        }
                        if (accNumber == lstNumber && (accdate_opened_monthYear == lstdate_opened_monthYear)) {
                            is_valid_merge = true;
                        }
                    }
                    return is_valid_merge;
                }

            });
            ignoreBureauInSearch = getIgnoreBureauInSearch(filteredAccounts, ignoreBureauInSearch);
            var filteredAccountsByAcc2Match = accountList.filter(function (fltAccount) {
                var is_valid_merge = false;
                var selectedBureauCodes = Object.keys(fltAccount).filter(function (k) { return k != "name" && k != "original_creditor" && ignoreBureauInSearch.indexOf(k) == -1 });
                for (var m = 0; m < selectedBureauCodes.length; m++) {
                    var lstAccount = fltAccount[selectedBureauCodes[m]];
                    if (!lstAccount) {
                        continue;
                    }
                    var lstNumber = $.trim(lstAccount["number"]);
                    var lstdate_opened = new Date(lstAccount["date_opened"]);
                    var lstdate_opened_monthYear = "";
                    if (lstdate_opened) {
                        lstdate_opened_monthYear = lstdate_opened.getMonth() + "" + lstdate_opened.getFullYear()
                    }
                    var lstmonthly_payment = parseFloat(lstAccount["monthly_payment"]);
                    var lstbalance = parseFloat(lstAccount["balance"]);
                    var lsthigh_balance = parseFloat(lstAccount["high_balance"]);
                    var lstoriginal_amount = parseFloat(lstAccount["original_amount"]);
                    var lstlimit = parseFloat(lstAccount["limit"]);
                    if (isNaN(lsthigh_balance) && !isNaN(lstoriginal_amount)) {
                        lsthigh_balance = lstoriginal_amount;
                    }
                    var domatch = !isNaN(accdate_opened_monthYear) && !isNaN(lstdate_opened_monthYear) && accdate_opened_monthYear == lstdate_opened_monthYear ? 1 : 0;
                    var mpmatch = !isNaN(accmonthly_payment) && !isNaN(lstmonthly_payment) && accmonthly_payment == lstmonthly_payment ? 1 : 0;
                    var blmatch = !isNaN(accbalance) && !isNaN(lstbalance) && accbalance == lstbalance ? 1 : 0;
                    var hbmatch = !isNaN(acchigh_balance) && !isNaN(lsthigh_balance) && acchigh_balance == lsthigh_balance ? 1 : 0;
                    var ltmatch = !isNaN(acclimit) && !isNaN(lstlimit) && acclimit == lstlimit ? 1 : 0;
                    var totalMatch = domatch + mpmatch + blmatch + hbmatch + ltmatch;
                    if (accNumber.substring(0, 5) == lstNumber.substring(0, 5) && totalMatch >= 2) {
                        is_valid_merge = true;
                    }
                }
                return is_valid_merge;
            });
            if (filteredAccountsByAcc2Match.length > 0) {
                filteredAccounts = filteredAccounts.concat(filteredAccountsByAcc2Match);
                ignoreBureauInSearch = getIgnoreBureauInSearch(filteredAccountsByAcc2Match, ignoreBureauInSearch);
            }
            var filteredAccountsBy4Match = accountList.filter(function (fltAccount) {
                var is_valid_merge = false;
                var selectedBureauCodes = Object.keys(fltAccount).filter(function (k) { return k != "name" && k != "original_creditor" && ignoreBureauInSearch.indexOf(k) == -1 });
                for (var m = 0; m < selectedBureauCodes.length; m++) {
                    var lstAccount = fltAccount[selectedBureauCodes[m]];
                    if (!lstAccount) {
                        continue;
                    }
                    var lstdate_opened = new Date(lstAccount["date_opened"]);
                    var lstdate_opened_monthYear = "";
                    if (lstdate_opened) {
                        lstdate_opened_monthYear = lstdate_opened.getMonth() + "" + lstdate_opened.getFullYear()
                    }
                    var lstmonthly_payment = parseFloat(lstAccount["monthly_payment"]);
                    var lstbalance = parseFloat(lstAccount["balance"]);
                    var lsthigh_balance = parseFloat(lstAccount["high_balance"]);
                    var lstoriginal_amount = parseFloat(lstAccount["original_amount"]);
                    var lstlimit = parseFloat(lstAccount["limit"]);
                    if (isNaN(lsthigh_balance) && !isNaN(lstoriginal_amount)) {
                        lsthigh_balance = lstoriginal_amount;
                    }
                    var domatch = !isNaN(accdate_opened_monthYear) && !isNaN(lstdate_opened_monthYear) && accdate_opened_monthYear == lstdate_opened_monthYear ? 1 : 0;
                    var mpmatch = !isNaN(accmonthly_payment) && !isNaN(lstmonthly_payment) && accmonthly_payment == lstmonthly_payment ? 1 : 0;
                    var blmatch = !isNaN(accbalance) && !isNaN(lstbalance) && accbalance == lstbalance ? 1 : 0;
                    var hbmatch = !isNaN(acchigh_balance) && !isNaN(lsthigh_balance) && acchigh_balance == lsthigh_balance ? 1 : 0;
                    var ltmatch = !isNaN(acclimit) && !isNaN(lstlimit) && acclimit == lstlimit ? 1 : 0;
                    var totalMatch = domatch + mpmatch + blmatch + hbmatch + ltmatch;
                    if (totalMatch >= 4) {
                        is_valid_merge = true;
                    }
                }
                return is_valid_merge;

            });
            if (filteredAccountsBy4Match.length > 0) {
                filteredAccounts = filteredAccounts.concat(filteredAccountsBy4Match);
            }
            if (filteredAccounts && filteredAccounts.length > 0) {
                var firstIndex = accountList.indexOf(filteredAccounts[0]);
                var mergeAccount = accountList[firstIndex];
                if (filteredAccounts.length == 2) {
                    var lastIndex = accountList.indexOf(filteredAccounts[1]);
                    var secoundAccount = accountList[lastIndex];
                    var selectBureauCode = Object.keys(secoundAccount).filter(function (k) { return k != "name" && k != "original_creditor" });
                    mergeAccount[selectBureauCode] = secoundAccount[selectBureauCode];
                    accountList.splice(lastIndex, 1);
                }
                if (mergeAccount) {
                    mergeAccount[bureauCode] = account;
                    mergeAccount["name"] = mergeAccount['EXP'] ? mergeAccount['EXP']["name"] : (mergeAccount['TUC'] ? mergeAccount['TUC']["name"] : mergeAccount['EQF'] ? mergeAccount['EQF']["name"] : "");
                    mergeAccount["original_creditor"] = mergeAccount['EXP'] ? mergeAccount['EXP']["original_creditor"] : (mergeAccount['TUC'] ? mergeAccount['TUC']["original_creditor"] : mergeAccount['EQF'] ? mergeAccount['EQF']["original_creditor"] : "");
                }
            }
        }
        if (!mergeAccount) {
            var accountObj = {};
            accountObj["name"] = accname;
            accountObj["original_creditor"] = account["original_creditor"];
            accountObj[bureauCode] = account;
            accountList.push(accountObj);
        }

    }
    var content = document.getElementById("hdnRptContent")?.value;
    var url = reportUrl;

    gettingTransunionReport(content);


    $scope.loadTradlineList = function () {
        $scope.loadLimitedTradlineList(false);
    }
    $scope.loadLimitedTradlineList = function (all) {
        var count = 0, length = tradeLinePartitions.length;
        for (var i = infinite_scroll_length; i < length; i++) {
            $scope.orderedTradeLines.push(tradeLinePartitions[i]);
            infinite_scroll_length++;
            count++;
            if (count == 3 && !all) {
                break;
            }
        }
    }
    function getIgnoreBureauInSearch(accounts, ignoreBureauInSearch) {
        for (var i = 0; i < accounts.length; i++) {
            ignoreBureauInSearch = ignoreBureauInSearch.concat(Object.keys(accounts[i]).filter(function (k) { return k != "name" && k != "original_creditor" }));
        }
        return ignoreBureauInSearch;
    }

}])
var IMC = {};
IMC["TUI"] = {};
IMC["TUI"]["Integration"] = {};

IMC["TUI"]["Integration"]["_callback"] = function (response) {

    // MENGAMBIL $scope DARI ELEMEN DOM
    var $scope = angular.element(document.getElementById('ctrlCreditReport')).scope();

    // *** PERBAIKAN: Selalu Cek $scope sebelum digunakan! ***
    if ($scope) {
        // PENTING: Gunakan $scope.$apply()
        $scope.$apply(function () {
            // Memanggil fungsi pada $scope yang terikat ke Controller
            $scope.renderExperianReport(response);
        });
    } else {
        // Tampilkan pesan kesalahan yang jelas
        console.error("Gagal mendapatkan $scope dari elemen 'ctrlCreditReport'.");
        console.error("Pastikan ng-controller dan ID elemen sudah terpasang dan Angular telah dimuat.");
    }
};

let clientData = undefined;

// --- LOGIKA BARU: Mengambil data dari elemen <script type="application/json"> ---
// Kita asumsikan server (EJS) merender tag: 
// <script id="initial-data-json" type="application/json"> { ... JSON mentah ... } </script>
const dataElement = document.getElementById('initial-data-json');

if (dataElement) {
    try {
        // Ambil konten teksnya dan parse dari JSON string menjadi objek JavaScript
        const jsonText = dataElement.textContent;
        window.clientData = JSON.parse(jsonText);
        console.log('Main.js: Data berhasil diakses dari elemen JSON.', clientData);
    } catch (e) {
        console.error("Main.js: Gagal mem-parse data JSON dari elemen.", e);
    }
} else if (typeof window.db !== 'undefined') {
    // --- LOGIKA LAMA (FALLBACK): Mengambil dari window.db ---
    clientData = window.db;
}


async function loadReportJson() {
    try {
        // 2. Ubah respons menjadi objek JavaScript
        const json = window.clientData

        setTimeout(function () {
            IMC["TUI"]["Integration"]["_callback"]([{ data: json }]);
        }, 100);

    } catch (error) {
        console.error("Gagal memuat atau memproses report.json:", error);
        // Anda bisa menangani kasus gagal di sini (misalnya, menampilkan pesan error)
    }
}
function scrollToSection(id) {
    var target = document.getElementById(id);
    if (target) {
        window.scrollTo({
            top: target.offsetTop,
            behavior: 'smooth'
        });
    }
}

function detectBrowserType() {
    var brsType = {};
    var ua = navigator.userAgent;

    brsType.ISFF = ua.indexOf('Firefox') != -1;
    brsType.ISOPERA = ua.indexOf('Opera') != -1;
    brsType.ISCHROME = ua.indexOf('Chrome') != -1;
    brsType.ISSAFARI = ua.indexOf('Safari') != -1 && !brsType.ISCHROME;
    brsType.ISWEBKIT = ua.indexOf('WebKit') != -1;

    brsType.ISIE = ua.indexOf('Trident') > 0 || navigator.userAgent.indexOf('MSIE') > 0;
    brsType.ISIE6 = ua.indexOf('MSIE 6') > 0;
    brsType.ISIE7 = ua.indexOf('MSIE 7') > 0;
    brsType.ISIE8 = ua.indexOf('MSIE 8') > 0;
    brsType.ISIE9 = ua.indexOf('MSIE 9') > 0;
    brsType.ISIE10 = ua.indexOf('MSIE 10') > 0;
    brsType.ISOLD = brsType.ISIE6 || brsType.ISIE7 || brsType.ISIE8; // MUST be here

    brsType.ISIE11UP = ua.indexOf('MSIE') == -1 && ua.indexOf('Trident') > 0;
    brsType.ISIE10UP = brsType.ISIE10 || brsType.ISIE11UP;
    brsType.ISIE9UP = brsType.ISIE9 || brsType.ISIE10UP;

    brsType.ext = brsType.ISFF ? "FF" : (brsType.ISCHROME ? "CHRM" : (brsType.ISSAFARI ? "SFR" : (brsType.ISIE ? "IE" : "")));

    return brsType;
}
